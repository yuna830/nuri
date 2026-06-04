"""
NHANES 2017-2018 데이터를 K-FRAIL 임상 척도 기반으로 라벨링하여 학습 CSV를 생성합니다.

K-FRAIL (5개 항목):
  1. 피로/탈진   : PFQ061F (집안일) or PFQ061G (식사 준비) >= 3
  2. 근력 저하   : PFQ061E (들기/운반) >= 3
  3. 보행 저하   : PFQ061B (1/4마일 걷기) >= 3
  4. 다중 만성질환: 질환 수 >= 5
  5. 신체활동 저하: PFQ061C (계단) >= 3 AND PFQ061D (웅크리기) >= 3

  점수 0 → 양호 / 1~2 → 주의 / 3~5 → 위험

피처용 PFQ 항목 (K-FRAIL 라벨과 겹치지 않음):
  - walking_limited    : PFQ061H (같은 층 방 사이 걷기) >= 2
  - fine_motor_limited : PFQ061K (포크/칼 사용) >= 2

라벨 생성에 쓰인 PFQ061 항목(B,C,D,E,F,G)은 피처에서 제외하여
데이터 순환(label leakage)을 방지합니다.
"""

import argparse
import csv
import urllib.request
from pathlib import Path

import pandas as pd


NHANES_2017_FILES = {
    "DEMO_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DEMO_J.XPT",
    "MCQ_J":  "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/MCQ_J.XPT",
    "PFQ_J":  "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/PFQ_J.XPT",
    "DIQ_J":  "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/DIQ_J.XPT",
    "BPQ_J":  "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BPQ_J.XPT",
    "RXQ_RX_J": "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/RXQ_RX_J.XPT",
    "BMX_J":  "https://wwwn.cdc.gov/Nchs/Data/Nhanes/Public/2017/DataFiles/BMX_J.XPT",
}

OUTPUT_COLUMNS = [
    "label",
    "kfrail_score",
    "label_reason",
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
    "walking_limited",
    "fine_motor_limited",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build K-FRAIL labeled health status training data from NHANES 2017-2018."
    )
    parser.add_argument("--raw-dir", default="data/nhanes_raw", help="NHANES XPT 파일 저장 경로")
    parser.add_argument("--output", default="data/nhanes_health_status_training.csv", help="출력 CSV 경로")
    parser.add_argument("--min-age", type=int, default=60, help="최소 나이 (기본 60세)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)

    print("NHANES 파일 다운로드 중 (이미 있으면 건너뜀)...")
    paths = {name: download_if_missing(name, url, raw_dir) for name, url in NHANES_2017_FILES.items()}

    print("데이터 로드 및 병합 중...")
    demo = read_xpt(paths["DEMO_J"])
    mcq  = read_xpt(paths["MCQ_J"])
    pfq  = read_xpt(paths["PFQ_J"])
    diq  = read_xpt(paths["DIQ_J"])
    bpq  = read_xpt(paths["BPQ_J"])
    bmx  = read_xpt(paths["BMX_J"])
    rxq  = read_xpt(paths["RXQ_RX_J"])

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
    print(f"60세 이상 대상자: {len(seniors)}명")

    rows = []
    for _, row in seniors.iterrows():
        record = build_record(row)
        if record is not None:
            rows.append(record)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    label_counts  = pd.Series([r["label"] for r in rows]).value_counts().to_dict()
    kfrail_counts = pd.Series([r["kfrail_score"] for r in rows]).value_counts().sort_index().to_dict()

    print(f"출력 행 수: {len(rows)}")
    print(f"라벨 분포: {label_counts}")
    print(f"K-FRAIL 점수 분포: {kfrail_counts}")
    print(f"저장 경로: {output}")


# ---------------------------------------------------------------------------
# 레코드 생성
# ---------------------------------------------------------------------------

def build_record(row: pd.Series) -> dict | None:
    diseases = collect_diseases(row)
    medicine_count = int(row.get("medicine_count_num", 0) or 0)
    disease_count  = sum(1 for v in diseases.values() if v == "있음")

    kfrail_score, label, reason = compute_kfrail(row, disease_count)

    # 피처용 PFQ 항목 (K-FRAIL 라벨 항목 B,C,D,E,F,G 와 겹치지 않음)
    walking_limited    = pfq_any_difficulty(row.get("PFQ061H"))  # 같은 층 방 사이 걷기
    fine_motor_limited = pfq_any_difficulty(row.get("PFQ061K"))  # 포크/칼 사용

    height_val = blank_or_number(row.get("BMXHT"))
    weight_val = blank_or_number(row.get("BMXWT"))

    return {
        "label":            label,
        "kfrail_score":     kfrail_score,
        "label_reason":     reason,
        "person_id":        f"NHANES-{int(row['SEQN'])}",
        "age":              int(row["RIDAGEYR"]),
        "gender":           "남성" if _int(row.get("RIAGENDR")) == 1 else "여성",
        "height":           height_val,
        "weight":           weight_val,
        "medicine_count":   medicine_count,
        "hypertension":     diseases["hypertension"],
        "diabetes":         diseases["diabetes"],
        "heart_disease":    diseases["heart_disease"],
        "joint_disease":    diseases["joint_disease"],
        "stroke":           diseases["stroke"],
        "kidney_disease":   diseases["kidney_disease"],
        "lung_disease":     diseases["lung_disease"],
        "liver_disease":    diseases["liver_disease"],
        "cancer":           diseases["cancer"],
        "dementia":         diseases["dementia"],
        "walking_limited":  "있음" if walking_limited else "없음",
        "fine_motor_limited": "있음" if fine_motor_limited else "없음",
    }


# ---------------------------------------------------------------------------
# K-FRAIL 계산  (라벨 전용 — 모델 피처에서 재사용 금지)
# ---------------------------------------------------------------------------

def compute_kfrail(row: pd.Series, disease_count: int) -> tuple[int, str, str]:
    """
    K-FRAIL 5항목 점수 계산.
    사용 PFQ 항목: PFQ061B, C, D, E, F, G  → 피처에서 제외
    """
    score = 0
    components: list[str] = []

    # 1. 피로/탈진: 집안일 또는 식사 준비 어려움 (심함 이상)
    if pfq_severe(row.get("PFQ061F")) or pfq_severe(row.get("PFQ061G")):
        score += 1
        components.append("피로/탈진")

    # 2. 근력 저하: 물건 들기/운반 어려움 (심함 이상)
    if pfq_severe(row.get("PFQ061E")):
        score += 1
        components.append("근력저하")

    # 3. 보행 저하: 1/4마일 걷기 어려움 (심함 이상)
    if pfq_severe(row.get("PFQ061B")):
        score += 1
        components.append("보행저하")

    # 4. 다중 만성질환: 5개 이상
    if disease_count >= 5:
        score += 1
        components.append(f"다중만성질환({disease_count}개)")

    # 5. 신체활동 저하: 계단 + 웅크리기 둘 다 어려움
    if pfq_severe(row.get("PFQ061C")) and pfq_severe(row.get("PFQ061D")):
        score += 1
        components.append("신체활동저하")

    if score == 0:
        label = "양호"
    elif score <= 2:
        label = "주의"
    else:
        label = "위험"

    reason = f"K-FRAIL {score}/5" + (
        f" ({', '.join(components)})" if components else " (모두 정상)"
    )
    return score, label, reason


# ---------------------------------------------------------------------------
# 질환 수집 (MCQ, BPQ, DIQ 기반 — PFQ 항목 없음)
# ---------------------------------------------------------------------------

def collect_diseases(row: pd.Series) -> dict[str, str]:
    return {
        "hypertension":  "있음" if yes(row.get("BPQ020")) else "없음",
        "diabetes":      "있음" if (yes(row.get("DIQ010")) or _int(row.get("DIQ010")) == 3) else "없음",
        "heart_disease": "있음" if any(yes(row.get(c)) for c in ["MCQ160B", "MCQ160C", "MCQ160D", "MCQ160E"]) else "없음",
        "joint_disease": "있음" if yes(row.get("MCQ160A")) else "없음",
        "stroke":        "있음" if yes(row.get("MCQ160F")) else "없음",
        "kidney_disease":"있음" if yes(row.get("MCQ160M")) else "없음",
        "lung_disease":  "있음" if any(yes(row.get(c)) for c in ["MCQ160G", "MCQ160K"]) else "없음",
        "liver_disease": "있음" if yes(row.get("MCQ160L")) else "없음",
        "cancer":        "있음" if yes(row.get("MCQ220")) else "없음",
        "dementia":      "없음",  # NHANES 2017-2018에 치매 문항 없음
    }


# ---------------------------------------------------------------------------
# PFQ 응답값 해석 헬퍼
# ---------------------------------------------------------------------------

def pfq_severe(value: object) -> bool:
    """응답 3(Much difficulty) 또는 4(Unable) → True"""
    v = _int(value)
    return v is not None and v >= 3


def pfq_any_difficulty(value: object) -> bool:
    """응답 2(Some difficulty) 이상 → True (피처용, K-FRAIL 미사용 항목)"""
    v = _int(value)
    return v is not None and v >= 2


# ---------------------------------------------------------------------------
# 공통 유틸
# ---------------------------------------------------------------------------

def yes(value: object) -> bool:
    return pd.notna(value) and _int(value) == 1


def _int(value: object) -> int | None:
    if pd.isna(value) if not isinstance(value, str) else False:
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def blank_or_number(value: object) -> str:
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    try:
        return str(round(float(value), 1))
    except (ValueError, TypeError):
        return ""


def download_if_missing(name: str, url: str, raw_dir: Path) -> Path:
    path = raw_dir / f"{name}.XPT"
    if not path.exists():
        print(f"  다운로드: {name} ...")
        urllib.request.urlretrieve(url, path)
    return path


def read_xpt(path: Path) -> pd.DataFrame:
    return pd.read_sas(path, format="xport")


if __name__ == "__main__":
    main()
