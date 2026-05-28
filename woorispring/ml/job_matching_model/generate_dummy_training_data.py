import argparse
import csv
import random
from pathlib import Path

from job_match_features import REQUIRED_COLUMNS


REGIONS = [
    "도서관 자료 정리",
    "복지관 안내 보조",
    "급식 배식 보조",
    "공원 환경 정비",
    "실내 사무 보조",
    "물품 정리 보조",
]

FIT_JOBS = [
    ("공익활동", "실내", "낮음", "반복 작업"),
    ("사무 보조", "실내", "낮음", "자료 정리 반복 작업"),
    ("안내", "실내", "낮음", "고객 응대"),
    ("급식 조리 보조", "실내", "낮음", "반복 작업"),
]

REVIEW_JOBS = [
    ("공익활동", "혼합", "중간", "이동 많음"),
    ("급식 조리 보조", "실내", "중간", "장시간 서있기"),
    ("환경 정비", "야외", "낮음", "반복 작업"),
    ("안내", "실내", "낮음", "고객 응대 이동 많음"),
]

UNFIT_JOBS = [
    ("환경 정비", "야외", "높음", "이동 많음 계단"),
    ("물류 보조", "실내", "높음", "무거운 물건 운반"),
    ("배송 보조", "야외", "중간", "이동 많음 무거운 물건 운반"),
    ("공원 순찰", "야외", "높음", "순찰 장시간 서있기"),
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate dummy job matching training data.")
    parser.add_argument("--rows", type=int, default=300, help="Total rows to generate. Rounded down by label groups.")
    parser.add_argument("--output", default="data/job_matching_dummy_300.csv", help="Output CSV path.")
    parser.add_argument("--seed", type=int, default=42, help="Random seed.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    random.seed(args.seed)

    per_label = max(1, args.rows // 3)
    rows = []
    for index in range(per_label):
        rows.append(fit_row(index))
        rows.append(review_row(index))
        rows.append(unfit_row(index))

    random.shuffle(rows)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=REQUIRED_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)

    print(f"generated={len(rows)}")
    print(f"output={output}")
    print(f"labels=적합:{per_label},검토:{per_label},부적합:{per_label}")


def fit_row(index: int) -> dict[str, object]:
    job_type, environment, intensity, tags = random.choice(FIT_JOBS)
    max_hours = random.choice([4, 5, 6])
    daily_hours = random.choice([2, 3, min(4, max_hours)])
    return base_row(
        label="적합",
        health_status=random.choice(["양호", "양호", "주의"]),
        medicine_count=random.choice(["없음", "1개", "2개"]),
        walking_aid="없음",
        recent_fall="없음",
        disabled_work=random.choice(["실내 선호", "가벼운 업무", "무리 없는 업무"]),
        max_hours=str(max_hours),
        max_distance=random.choice(["도보 30분 이내", "대중교통 30분 이내"]),
        disease_text=random.choice(["없음", "고혈압 관리중", "당뇨 관리중"]),
        hope_job_type=job_type,
        hope_condition=random.choice(["가벼운 실내 업무", "반복 작업", "안전한 업무"]),
        job_type=job_type,
        work_environment=environment,
        physical_intensity=intensity,
        daily_hours=str(daily_hours),
        commute_level=random.choice(["도보 10분 이내", "도보 30분 이내"]),
        task_tags=tags,
        closed=False,
    )


def review_row(index: int) -> dict[str, object]:
    job_type, environment, intensity, tags = random.choice(REVIEW_JOBS)
    max_hours = random.choice([3, 4])
    daily_hours = random.choice([3, 4, 5])
    return base_row(
        label="검토",
        health_status="주의",
        medicine_count=random.choice(["2개", "3개", "3~5개"]),
        walking_aid=random.choice(["없음", "없음", "보행 보조기 사용"]),
        recent_fall=random.choice(["없음", "1회 낙상"]),
        disabled_work=random.choice(["실내 선호", "장시간 서있기 어려움", "야외 오래 하기 어려움"]),
        max_hours=str(max_hours),
        max_distance=random.choice(["도보 10분 이내", "도보 30분 이내"]),
        disease_text=random.choice(["고혈압 관리중", "당뇨 관리중", "관절 통증 경미"]),
        hope_job_type=random.choice([job_type, "공익활동", "사무 보조"]),
        hope_condition=random.choice(["가벼운 업무", "실내 업무", "짧은 시간 업무"]),
        job_type=job_type,
        work_environment=environment,
        physical_intensity=intensity,
        daily_hours=str(daily_hours),
        commute_level=random.choice(["도보 30분 이내", "대중교통 30분 이내"]),
        task_tags=tags,
        closed=False,
    )


def unfit_row(index: int) -> dict[str, object]:
    job_type, environment, intensity, tags = random.choice(UNFIT_JOBS)
    return base_row(
        label="부적합",
        health_status=random.choice(["위험", "위험", "주의"]),
        medicine_count=random.choice(["4개", "5개", "3~5개"]),
        walking_aid=random.choice(["보행 보조기 사용", "보행 불편", "없음"]),
        recent_fall=random.choice(["최근 낙상 있음", "2회 낙상", "3회 낙상"]),
        disabled_work=random.choice(["야외 불가", "무거운 물건 운반 어려움", "계단 이동 어려움"]),
        max_hours=random.choice(["2", "3"]),
        max_distance=random.choice(["도보 10분 이내", "도보 30분 이내"]),
        disease_text=random.choice(["관절질환 중증 활동 제한", "심장질환 치료 필요", "호흡기질환 작업 제한"]),
        hope_job_type=random.choice(["사무 보조", "공익활동", "안내"]),
        hope_condition=random.choice(["실내 업무", "가벼운 업무", "무리 없는 업무"]),
        job_type=job_type,
        work_environment=environment,
        physical_intensity=intensity,
        daily_hours=random.choice(["4", "5", "6"]),
        commute_level=random.choice(["대중교통 30분 이내", "대중교통 1시간 이내"]),
        task_tags=tags,
        closed=index % 20 == 0,
    )


def base_row(**values: object) -> dict[str, object]:
    row = {column: "" for column in REQUIRED_COLUMNS}
    row.update(values)
    row["closed"] = str(row["closed"]).lower()
    return row


if __name__ == "__main__":
    main()
