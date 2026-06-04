import argparse
import csv
import random
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
}

OUTPUT_COLUMNS = [
    "person_id",
    "health_status",
    "medicine_count",
    "walking_aid",
    "recent_fall",
    "disabled_work",
    "max_hours",
    "max_distance",
    "disease_text",
    "hope_job_type",
    "hope_condition",
]

HOPE_JOB_TYPES = ["사무 보조", "안내", "급식 조리 보조", "환경 정비", "물류 보조", "공익활동"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build normalized senior health rows from public NHANES data.")
    parser.add_argument("--raw-dir", default="data/nhanes_raw", help="Directory for downloaded NHANES XPT files.")
    parser.add_argument("--output", default="data/nhanes_health_rows.csv", help="Output normalized health CSV.")
    parser.add_argument("--min-age", type=int, default=60, help="Minimum age to keep.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for preference generation.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    paths = {name: download_if_missing(name, url, raw_dir) for name, url in NHANES_2017_FILES.items()}

    demo = read_xpt(paths["DEMO_J"])
    mcq = read_xpt(paths["MCQ_J"])
    pfq = read_xpt(paths["PFQ_J"])
    diq = read_xpt(paths["DIQ_J"])
    bpq = read_xpt(paths["BPQ_J"])
    rxq = read_xpt(paths["RXQ_RX_J"])

    rx_counts = rxq.groupby("SEQN").size().rename("medicine_count_num")
    merged = (
        demo.merge(mcq, on="SEQN", how="left")
        .merge(pfq, on="SEQN", how="left")
        .merge(diq, on="SEQN", how="left")
        .merge(bpq, on="SEQN", how="left")
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

    status_counts = pd.Series([row["health_status"] for row in rows]).value_counts().to_dict()
    print(f"downloaded_files={len(paths)}")
    print(f"senior_rows={len(rows)}")
    print(f"health_status_distribution={status_counts}")
    print(f"output={output}")


def download_if_missing(name: str, url: str, raw_dir: Path) -> Path:
    path = raw_dir / f"{name}.XPT"
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    return path


def read_xpt(path: Path) -> pd.DataFrame:
    return pd.read_sas(path, format="xport")


def normalize_person(row: pd.Series) -> dict[str, str]:
    diseases = collect_diseases(row)
    limitation_count = physical_limitation_count(row)
    medicine_count = int(row.get("medicine_count_num", 0) or 0)
    serious_disease_count = sum(1 for disease in diseases if any(key in disease for key in ["심장", "뇌졸중", "호흡기", "암"]))

    if serious_disease_count >= 2 or limitation_count >= 4:
        health_status = "위험"
        max_hours = "2"
        max_distance = "도보 10분 이내"
    elif diseases or medicine_count >= 3 or limitation_count >= 1:
        health_status = "주의"
        max_hours = "3" if limitation_count >= 2 else "4"
        max_distance = "도보 10분 이내" if limitation_count >= 2 else "도보 30분 이내"
    else:
        health_status = "양호"
        max_hours = "5"
        max_distance = "대중교통 30분 이내"

    walking_aid = "보행 불편" if limitation_count >= 2 else "없음"
    disabled_work = infer_disabled_work(health_status, diseases, limitation_count)
    hope_job_type = infer_hope_job_type(health_status, diseases, limitation_count)
    hope_condition = infer_hope_condition(health_status, limitation_count)
    medicine_text = "없음" if medicine_count == 0 else f"{medicine_count}개"

    return {
        "person_id": f"NHANES-{int(row['SEQN'])}",
        "health_status": health_status,
        "medicine_count": medicine_text,
        "walking_aid": walking_aid,
        "recent_fall": "없음",
        "disabled_work": disabled_work,
        "max_hours": max_hours,
        "max_distance": max_distance,
        "disease_text": ", ".join(diseases) if diseases else "없음",
        "hope_job_type": hope_job_type,
        "hope_condition": hope_condition,
    }


def collect_diseases(row: pd.Series) -> list[str]:
    diseases = []
    if yes(row.get("BPQ020")):
        diseases.append("고혈압 관리중")
    if yes(row.get("DIQ010")) or row.get("DIQ010") == 3:
        diseases.append("당뇨 관리중")
    if yes(row.get("MCQ160A")):
        diseases.append("관절질환")
    heart_columns = ["MCQ160B", "MCQ160C", "MCQ160D", "MCQ160E"]
    if any(yes(row.get(column)) for column in heart_columns):
        diseases.append("심장질환 치료 필요")
    if yes(row.get("MCQ160F")):
        diseases.append("뇌졸중 이력")
    if yes(row.get("MCQ160L")):
        diseases.append("호흡기질환 작업 제한")
    if yes(row.get("MCQ220")):
        diseases.append("암 진단 이력")
    return diseases


def physical_limitation_count(row: pd.Series) -> int:
    count = 0
    if yes(row.get("PFQ020")):
        count += 1
    difficulty_columns = [
        column
        for column in row.index
        if column.startswith("PFQ0") and column not in {"PFQ020", "PFQ030", "PFQ090"}
    ]
    for column in difficulty_columns:
        value = row.get(column)
        if pd.notna(value) and value in {3, 4}:
            count += 1
    return count


def infer_disabled_work(health_status: str, diseases: list[str], limitation_count: int) -> str:
    if health_status == "위험":
        if any("심장" in disease or "호흡기" in disease for disease in diseases):
            return "고강도 업무 어려움"
        return "야외 불가"
    if limitation_count >= 2:
        return "장시간 서있기 어려움"
    if any("관절" in disease for disease in diseases):
        return "무거운 물건 운반 어려움"
    return "가벼운 업무"


def infer_hope_job_type(health_status: str, diseases: list[str], limitation_count: int) -> str:
    if health_status == "위험" or limitation_count >= 2:
        return random.choice(["사무 보조", "안내"])
    if any("관절" in disease for disease in diseases):
        return random.choice(["사무 보조", "안내", "공익활동"])
    return random.choice(HOPE_JOB_TYPES)


def infer_hope_condition(health_status: str, limitation_count: int) -> str:
    if health_status == "위험":
        return "가벼운 실내 업무"
    if limitation_count >= 2:
        return "짧은 시간 업무"
    return random.choice(["실내 반복 작업", "고객 응대", "가벼운 업무", "무리 없는 업무"])


def yes(value: object) -> bool:
    return pd.notna(value) and int(value) == 1


if __name__ == "__main__":
    main()
