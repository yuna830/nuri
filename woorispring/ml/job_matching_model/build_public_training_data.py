import argparse
import csv
import random
from pathlib import Path

import pandas as pd

from job_match_features import REQUIRED_COLUMNS, commute_rank, extract_max_number, has_any, has_limited_value


HEALTH_COLUMNS = [
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

JOB_COLUMNS = [
    "job_id",
    "title",
    "organization",
    "job_type",
    "work_environment",
    "physical_intensity",
    "daily_hours",
    "commute_level",
    "task_tags",
    "closed",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build weak-labeled job matching training data from public health rows and public job postings."
    )
    parser.add_argument("--health", default="data/public_health_rows.example.csv", help="Normalized public health CSV.")
    parser.add_argument("--jobs", default="data/senuri_jobs.example.csv", help="Normalized job postings CSV.")
    parser.add_argument("--output", default="data/public_job_matching_training.csv", help="Output training CSV.")
    parser.add_argument("--max-pairs", type=int, default=5000, help="Maximum health/job pairs to write.")
    parser.add_argument(
        "--max-per-label",
        type=int,
        default=0,
        help="Optional balanced sampling cap per label. Example: 1000 makes up to 1000 rows each for 적합/검토/부적합.",
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed for pair sampling.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    health = read_csv(args.health)
    jobs = read_csv(args.jobs)
    validate_columns(health, HEALTH_COLUMNS, "health")
    validate_columns(jobs, JOB_COLUMNS, "jobs")

    if args.max_per_label > 0:
        pairs = build_balanced_rows(health, jobs, args.max_per_label)
        max_pairs_label = f"max_per_label={args.max_per_label}"
    else:
        pairs = build_all_rows(health, jobs)
        if len(pairs) > args.max_pairs:
            pairs = random.sample(pairs, args.max_pairs)
            max_pairs_label = f"max_pairs={args.max_pairs}"
        else:
            max_pairs_label = "all_pairs"

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "person_id",
        "job_id",
        "title",
        "organization",
        "weak_score",
        "weak_label_reason",
        *REQUIRED_COLUMNS,
    ]
    with output.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(pairs)

    label_counts = pd.Series([row["label"] for row in pairs]).value_counts().to_dict()
    print(f"health_rows={len(health)}")
    print(f"job_rows={len(jobs)}")
    print(f"sampling={max_pairs_label}")
    print(f"training_rows={len(pairs)}")
    print(f"label_distribution={label_counts}")
    print(f"output={output}")


def build_all_rows(health: pd.DataFrame, jobs: pd.DataFrame) -> list[dict[str, object]]:
    pairs = []
    for health_row in health.to_dict("records"):
        for job_row in jobs.to_dict("records"):
            pairs.append(build_training_row(health_row, job_row))
    return pairs


def sample_per_label(rows: list[dict[str, object]], max_per_label: int) -> list[dict[str, object]]:
    grouped: dict[str, list[dict[str, object]]] = {}
    for row in rows:
        grouped.setdefault(str(row["label"]), []).append(row)

    sampled = []
    for label in ["적합", "검토", "부적합"]:
        label_rows = grouped.get(label, [])
        if len(label_rows) > max_per_label:
            label_rows = random.sample(label_rows, max_per_label)
        sampled.extend(label_rows)

    random.shuffle(sampled)
    return sampled


def build_balanced_rows(health: pd.DataFrame, jobs: pd.DataFrame, max_per_label: int) -> list[dict[str, object]]:
    health_records = health.to_dict("records")
    job_records = jobs.to_dict("records")
    random.shuffle(health_records)
    random.shuffle(job_records)

    grouped = {"적합": [], "검토": [], "부적합": []}
    for health_row in health_records:
        for job_row in job_records:
            row = build_training_row(health_row, job_row)
            label = str(row["label"])
            if label in grouped and len(grouped[label]) < max_per_label:
                grouped[label].append(row)
            if all(len(rows) >= max_per_label for rows in grouped.values()):
                sampled = [item for rows in grouped.values() for item in rows]
                random.shuffle(sampled)
                return sampled

    sampled = [item for rows in grouped.values() for item in rows]
    random.shuffle(sampled)
    return sampled


def read_csv(path: str) -> pd.DataFrame:
    return pd.read_csv(path, encoding="utf-8-sig").fillna("")


def validate_columns(df: pd.DataFrame, required_columns: list[str], name: str) -> None:
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"{name} CSV missing columns: {', '.join(missing)}")


def build_training_row(health: pd.Series, job: pd.Series) -> dict[str, object]:
    score, reasons = weak_score(health, job)
    label = score_to_label(score)
    return {
        "person_id": health["person_id"],
        "job_id": job["job_id"],
        "title": job["title"],
        "organization": job["organization"],
        "weak_score": score,
        "weak_label_reason": " | ".join(reasons),
        "label": label,
        "health_status": health["health_status"],
        "medicine_count": health["medicine_count"],
        "walking_aid": health["walking_aid"],
        "recent_fall": health["recent_fall"],
        "disabled_work": health["disabled_work"],
        "max_hours": health["max_hours"],
        "max_distance": health["max_distance"],
        "disease_text": health["disease_text"],
        "hope_job_type": health["hope_job_type"],
        "hope_condition": health["hope_condition"],
        "job_type": job["job_type"],
        "work_environment": job["work_environment"],
        "physical_intensity": job["physical_intensity"],
        "daily_hours": job["daily_hours"],
        "commute_level": job["commute_level"],
        "task_tags": job["task_tags"],
        "closed": job["closed"],
    }


def weak_score(health: pd.Series, job: pd.Series) -> tuple[int, list[str]]:
    reasons = []
    if to_bool(job["closed"]):
        return 0, ["마감 공고 제외"]

    score = 50
    if job_type_matches(health["hope_job_type"], job["job_type"]):
        score += 20
        reasons.append("희망 직종 일치 +20")

    max_hours = extract_max_number(health["max_hours"]) or 0
    daily_hours = extract_max_number(job["daily_hours"]) or 0
    if max_hours and daily_hours and max_hours >= daily_hours:
        score += 20
        reasons.append("활동 가능 시간 충족 +20")
    elif max_hours and daily_hours and max_hours < daily_hours:
        score -= 20
        reasons.append("활동 가능 시간 초과 -20")

    max_commute = commute_rank(health["max_distance"]) or 0
    job_commute = commute_rank(job["commute_level"]) or 0
    if max_commute and job_commute and max_commute >= job_commute:
        score += 15
        reasons.append("이동 가능 거리 충족 +15")
    elif max_commute and job_commute and max_commute < job_commute:
        score -= 15
        reasons.append("이동 가능 거리 초과 -15")

    if text_contains(" ".join([job["work_environment"], job["task_tags"], job["job_type"]]), health["hope_condition"]):
        score += 10
        reasons.append("희망 근무 조건 일부 일치 +10")

    if has_any(health["disabled_work"], ["실내 선호", "야외 불가", "야외 어려"]) and has_any(
        job["work_environment"], ["실내", "혼합"]
    ):
        score += 10
        reasons.append("실내/안전 선호와 공고 환경 일치 +10")

    if has_any(health["disabled_work"], ["야외 불가", "야외 어려", "실내 선호"]) and has_any(job["work_environment"], ["야외"]):
        score -= 30
        reasons.append("야외 작업 어려움 -30")

    if has_any(" ".join([health["disabled_work"], health["disease_text"]]), ["장시간 서", "오래 서", "관절 통증"]) and has_any(
        job["task_tags"], ["장시간 서", "서있기", "오래 서"]
    ):
        score -= 25
        reasons.append("장시간 서있기 부담 -25")

    if has_any(" ".join([health["disabled_work"], health["disease_text"]]), ["무거운", "운반 어려", "근력 제한"]) and has_any(
        job["task_tags"], ["무거운", "운반", "상하차"]
    ):
        score -= 30
        reasons.append("무거운 물건 운반 부담 -30")

    if has_limited_value(health["walking_aid"]) and has_any(job["task_tags"], ["이동 많음", "계단", "순찰", "배달"]):
        score -= 25
        reasons.append("보행 제한과 이동 업무 충돌 -25")

    if has_any(health["health_status"], ["위험"]) and has_any(job["physical_intensity"], ["높음", "고강도"]):
        score -= 40
        reasons.append("위험 건강 상태와 고강도 업무 충돌 -40")

    if has_any(health["disease_text"], ["중증", "활동 제한", "치료 필요", "작업 제한"]) and has_any(
        job["physical_intensity"], ["중간", "높음", "고강도"]
    ):
        score -= 20
        reasons.append("중증 질환과 업무 강도 충돌 -20")

    if multiple_falls(health["recent_fall"]) and has_any(job["task_tags"], ["이동 많음", "계단", "순찰", "배달"]):
        score -= 15
        reasons.append("낙상 이력과 이동 업무 충돌 -15")

    medicine_count = extract_max_number(health["medicine_count"]) or 0
    if medicine_count >= 5 and has_any(job["physical_intensity"], ["중간", "높음"]):
        score -= 10
        reasons.append("복약 수 많음과 업무 강도 주의 -10")

    score = max(0, min(100, score))
    if not reasons:
        reasons.append("명확한 충돌 조건 없음")
    return int(score), reasons


def score_to_label(score: int) -> str:
    if score >= 80:
        return "적합"
    if score >= 60:
        return "검토"
    return "부적합"


def text_contains(target: object, source: object) -> bool:
    target_text = str(target)
    tokens = [
        token
        for token in str(source).replace(",", " ").replace("/", " ").split()
        if len(token) >= 2 and token not in GENERIC_TOKENS
    ]
    return any(token in target_text for token in tokens)


def job_type_matches(hope_job_type: object, actual_job_type: object) -> bool:
    hope = normalize_job_category(hope_job_type)
    actual = normalize_job_category(actual_job_type)
    return bool(hope and actual and hope == actual)


def normalize_job_category(value: object) -> str:
    text = str(value)
    category_keywords = {
        "사무": "사무",
        "문서": "사무",
        "자료": "사무",
        "안내": "안내",
        "상담": "안내",
        "민원": "안내",
        "급식": "급식",
        "배식": "급식",
        "조리": "급식",
        "환경": "환경",
        "청소": "환경",
        "공원": "환경",
        "물류": "물류",
        "운반": "물류",
        "배송": "물류",
        "공익": "공익",
    }
    for keyword, category in category_keywords.items():
        if keyword in text:
            return category
    return text.strip()


def multiple_falls(value: object) -> bool:
    text = str(value)
    if has_any(text, ["없음", "없다", "0회", "아니오"]):
        return False
    number = extract_max_number(text)
    return bool(number and number >= 2) or has_any(text, ["여러", "반복", "자주"])


def to_bool(value: object) -> bool:
    return str(value).strip().lower() in {"1", "true", "yes", "y", "마감", "마감됨"}


GENERIC_TOKENS = {"보조", "업무", "활동", "일자리", "근무", "작업"}


if __name__ == "__main__":
    main()
