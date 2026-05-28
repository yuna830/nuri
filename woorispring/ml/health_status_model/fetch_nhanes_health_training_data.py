import argparse
import csv
import urllib.request
from pathlib import Path

import pandas as pd


NHANES_2017_FILES = {
    "DEMO_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DEMO_J.XPT",
    "MCQ_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/MCQ_J.XPT",
    "PFQ_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/PFQ_J.XPT",
    "DIQ_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DIQ_J.XPT",
    "BPQ_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BPQ_J.XPT",
    "RXQ_RX_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/RXQ_RX_J.XPT",
    "BMX_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BMX_J.XPT",
}

OUTPUT_COLUMNS = [
    "label",
    "person_id",
    "age",
    "gender",
    "height",
    "weight",
    "medicine_count",
    "hypertension",
    "diabetes",
    "heart_disease",
    "joint_disease",
    "stroke",
    "kidney_disease",
    "lung_disease",
    "liver_disease",
    "cancer",
    "dementia",
    "walking_aid",
    "vision",
    "hearing",
    "recent_fall",
    "has_surgery",
    "physical_limitation_count",
    "max_hours",
    "label_reason",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build weak-labeled health status training data from NHANES.")
    parser.add_argument("--raw-dir", default="data/nhanes_raw", help="Directory for downloaded NHANES XPT files.")
    parser.add_argument("--output", default="data/nhanes_health_status_training.csv", help="Output training CSV.")
    parser.add_argument("--min-age", type=int, default=60, help="Minimum age to keep.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    paths = {name: download_if_missing(name, url, raw_dir) for name, url in NHANES_2017_FILES.items()}

    demo = read_xpt(paths["DEMO_J"])
    mcq = read_xpt(paths["MCQ_J"])
    pfq = read_xpt(paths["PFQ_J"])
    diq = read_xpt(paths["DIQ_J"])
    bpq = read_xpt(paths["BPQ_J"])
    bmx = read_xpt(paths["BMX_J"])
    rxq = read_xpt(paths["RXQ_RX_J"])
    rx_counts = rxq.groupby("SEQN").size().rename("medicine_count_num")

    merged = (
        demo.merge(mcq, on="SEQN", how="left")
        .merge(pfq, on="SEQN", how="left")
        .merge(diq, on="SEQN", how="left")
        .merge(bpq, on="SEQN", how="left")
        .merge(bmx, on="SEQN", how="left")
        .merge(rx_counts, on="SEQN", how="left")
    )
    seniors = merged[merged["RIDAGEYR"] >= args.min_age].copy()
    seniors["medicine_count_num"] = seniors["medicine_count_num"].fillna(0).astype(int)

    rows = [normalize_person(row) for _, row in seniors.iterrows()]
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    label_counts = pd.Series([row["label"] for row in rows]).value_counts().to_dict()
    print(f"downloaded_files={len(paths)}")
    print(f"rows={len(rows)}")
    print(f"label_distribution={label_counts}")
    print(f"output={output}")


def download_if_missing(name: str, url: str, raw_dir: Path) -> Path:
    path = raw_dir / f"{name}.XPT"
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    return path


def read_xpt(path: Path) -> pd.DataFrame:
    return pd.read_sas(path, format="xport")


def normalize_person(row: pd.Series) -> dict[str, object]:
    diseases = collect_diseases(row)
    physical_limitations = physical_limitation_count(row)
    medicine_count = int(row.get("medicine_count_num", 0) or 0)
    serious_count = sum(
        1
        for key in ["heart_disease", "stroke", "kidney_disease", "lung_disease", "cancer", "dementia"]
        if diseases[key] != "없음"
    )
    disease_count = sum(1 for value in diseases.values() if value != "없음")

    label, reason = evaluate_label(disease_count, serious_count, medicine_count, physical_limitations)
    max_hours = infer_max_hours(label, physical_limitations)

    return {
        "label": label,
        "person_id": f"NHANES-{int(row['SEQN'])}",
        "age": int(row["RIDAGEYR"]),
        "gender": "남성" if int(row.get("RIAGENDR", 0) or 0) == 1 else "여성",
        "height": blank_or_number(row.get("BMXHT")),
        "weight": blank_or_number(row.get("BMXWT")),
        "medicine_count": "없음" if medicine_count == 0 else f"{medicine_count}개",
        "hypertension": diseases["hypertension"],
        "diabetes": diseases["diabetes"],
        "heart_disease": diseases["heart_disease"],
        "joint_disease": diseases["joint_disease"],
        "stroke": diseases["stroke"],
        "kidney_disease": diseases["kidney_disease"],
        "lung_disease": diseases["lung_disease"],
        "liver_disease": diseases["liver_disease"],
        "cancer": diseases["cancer"],
        "dementia": diseases["dementia"],
        "walking_aid": "보행 불편" if physical_limitations >= 2 else "없음",
        "vision": "정상",
        "hearing": "정상",
        "recent_fall": "없음",
        "has_surgery": "없음",
        "physical_limitation_count": physical_limitations,
        "max_hours": max_hours,
        "label_reason": reason,
    }


def collect_diseases(row: pd.Series) -> dict[str, str]:
    return {
        "hypertension": "고혈압 관리중" if yes(row.get("BPQ020")) else "없음",
        "diabetes": "당뇨 관리중" if yes(row.get("DIQ010")) or row.get("DIQ010") == 3 else "없음",
        "heart_disease": "심장질환 치료 필요"
        if any(yes(row.get(column)) for column in ["MCQ160B", "MCQ160C", "MCQ160D", "MCQ160E"])
        else "없음",
        "joint_disease": "관절질환" if yes(row.get("MCQ160A")) else "없음",
        "stroke": "뇌졸중 이력" if yes(row.get("MCQ160F")) else "없음",
        "kidney_disease": "신장질환" if yes(row.get("MCQ160M")) else "없음",
        "lung_disease": "호흡기질환 작업 제한"
        if any(yes(row.get(column)) for column in ["MCQ160G", "MCQ160K", "MCQ160L"])
        else "없음",
        "liver_disease": "간질환" if yes(row.get("MCQ160L")) else "없음",
        "cancer": "암 진단 이력" if yes(row.get("MCQ220")) else "없음",
        "dementia": "없음",
    }


def physical_limitation_count(row: pd.Series) -> int:
    count = 0
    if yes(row.get("PFQ020")):
        count += 1
    for column in [column for column in row.index if column.startswith("PFQ0")]:
        value = row.get(column)
        if pd.notna(value) and value in {3, 4}:
            count += 1
    return count


def evaluate_label(disease_count: int, serious_count: int, medicine_count: int, limitation_count: int) -> tuple[str, str]:
    risk_reasons = []
    if serious_count >= 2:
        risk_reasons.append("중요 질환 2개 이상")
    if limitation_count >= 4:
        risk_reasons.append("신체 기능 제한 4개 이상")
    if serious_count >= 1 and limitation_count >= 2:
        risk_reasons.append("중요 질환과 기능 제한 동반")
    if medicine_count >= 6 and disease_count >= 2:
        risk_reasons.append("복약 6개 이상 및 복합질환")
    if risk_reasons:
        return "위험", ", ".join(risk_reasons)

    caution_reasons = []
    if disease_count >= 1:
        caution_reasons.append("만성질환 보유")
    if medicine_count >= 3:
        caution_reasons.append("복약 3개 이상")
    if limitation_count >= 1:
        caution_reasons.append("신체 기능 제한")
    if caution_reasons:
        return "주의", ", ".join(caution_reasons)

    return "양호", "위험/주의 조건 없음"


def infer_max_hours(label: str, limitation_count: int) -> str:
    if label == "위험":
        return "2"
    if label == "주의":
        return "3" if limitation_count >= 2 else "4"
    return "5"


def yes(value: object) -> bool:
    return pd.notna(value) and int(value) == 1


def blank_or_number(value: object) -> str:
    if pd.isna(value):
        return ""
    return str(round(float(value), 1))


if __name__ == "__main__":
    main()
