import argparse
import random
from pathlib import Path

import pandas as pd

from health_features import REQUIRED_COLUMNS


SERIOUS_DISEASES = [
    "heart_disease",
    "stroke",
    "kidney_disease",
    "lung_disease",
    "cancer",
    "dementia",
]

CHRONIC_DISEASES = [
    "hypertension",
    "diabetes",
    "joint_disease",
    "liver_disease",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate service-policy training rows for the health status ML model."
    )
    parser.add_argument(
        "--output",
        default="data/processed/health_status_policy_training_samples.csv",
    )
    parser.add_argument("--rows", type=int, default=60000)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = generate_policy_rows(args.rows)

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame(rows, columns=REQUIRED_COLUMNS)
    df.to_csv(output, index=False, encoding="utf-8-sig")

    print(
        {
            "output": str(output),
            "rows": len(df),
            "label_distribution": df["label"].value_counts().to_dict(),
        }
    )


def generate_policy_rows(total_rows: int) -> list[dict]:
    rng = random.Random(42)
    good_target = max(1000, total_rows // 5)
    caution_target = max(1000, (total_rows * 2) // 5)
    risk_target = total_rows - good_target - caution_target

    rows = []
    rows.extend(random_good_case(rng) for _ in range(good_target))
    rows.extend(random_caution_case(rng) for _ in range(caution_target))
    rows.extend(random_risk_case(rng) for _ in range(risk_target))
    rng.shuffle(rows)
    return rows


def random_good_case(rng: random.Random) -> dict:
    row = base_row(
        "양호",
        age=rng.randint(65, 84),
        gender=random_gender(rng),
        height=rng.randint(148, 176),
        weight=rng.randint(48, 78),
        medicine_count=rng.randint(0, 2),
        max_hours=rng.randint(4, 6),
    )
    if rng.random() < 0.08:
        set_surgery(
            row,
            rng,
            recent_1y="없음",
            recent_3y=rng.choice(["없음", "있음"]),
            recovery="회복완료",
            detail=rng.choice(["백내장 수술 회복완료", "담낭 수술 회복완료", "오래전 수술 회복완료"]),
        )
    return row


def random_caution_case(rng: random.Random) -> dict:
    row = base_row(
        "주의",
        age=rng.randint(65, 90),
        gender=random_gender(rng),
        height=rng.randint(148, 176),
        weight=rng.randint(48, 82),
        medicine_count=rng.randint(0, 2),
        max_hours=rng.randint(4, 6),
    )
    trigger = rng.choice([
        "serious_one",
        "chronic_one",
        "chronic_multi",
        "medication",
        "limitation",
        "sensory_one",
        "sensory_one",
        "sensory_one",
        "sensory_one",
        "sensory_one",
        "short_hours",
        "surgery_recent",
        "surgery_recovering",
    ])
    if trigger == "serious_one":
        set_disease_count(row, SERIOUS_DISEASES, 1, rng)
    elif trigger == "chronic_one":
        set_disease_count(row, CHRONIC_DISEASES, 1, rng)
    elif trigger == "chronic_multi":
        set_disease_count(row, CHRONIC_DISEASES, rng.randint(2, len(CHRONIC_DISEASES)), rng)
    elif trigger == "medication":
        row["medicine_count"] = rng.randint(3, 5)
    elif trigger == "limitation":
        set_limitation_count(row, rng.randint(1, 3), rng)
    elif trigger == "sensory_one":
        field = rng.choice(["vision", "hearing", "walking_aid"])
        if field in {"vision", "hearing"}:
            row[field] = rng.choice(["저하", "limited", "yes"])
        else:
            row[field] = rng.choice(["지팡이 사용", "보조기 사용", "yes"])
    elif trigger == "short_hours":
        row["max_hours"] = 3
    elif trigger == "surgery_recent":
        set_surgery(
            row,
            rng,
            recent_1y=rng.choice(["있음", "없음"]),
            recent_3y="있음",
            recovery=rng.choice(["회복완료", "회복중"]),
            detail=rng.choice(["관절 수술", "척추 수술", "심장 시술", "암 수술"]),
        )
        row["max_hours"] = rng.randint(3, 5)
    elif trigger == "surgery_recovering":
        set_surgery(
            row,
            rng,
            recent_1y="있음",
            recent_3y="있음",
            recovery=rng.choice(["회복중", "모름"]),
            detail=rng.choice(["무릎 수술 후 회복중", "허리 수술 후 재활", "골절 수술 후 회복중"]),
        )
        row["max_hours"] = rng.randint(3, 4)
    return row


def random_risk_case(rng: random.Random) -> dict:
    row = base_row(
        "위험",
        age=rng.randint(65, 94),
        gender=random_gender(rng),
        height=rng.randint(148, 176),
        weight=rng.randint(45, 86),
        medicine_count=rng.randint(0, 7),
        max_hours=rng.randint(3, 6),
    )
    trigger = rng.choice(["recent_fall", "two_serious", "four_limitations", "surgery_unrecovered"])
    if trigger == "recent_fall":
        row["recent_fall"] = rng.choice(["있음", "yes", "1"])
    elif trigger == "two_serious":
        set_disease_count(row, SERIOUS_DISEASES, rng.randint(2, 4), rng)
    elif trigger == "four_limitations":
        set_limitation_count(row, rng.randint(4, 5), rng)
    elif trigger == "surgery_unrecovered":
        set_surgery(
            row,
            rng,
            recent_1y="있음",
            recent_3y="있음",
            recovery=rng.choice(["회복중", "미회복"]),
            detail=rng.choice(["고관절 수술 후 보행 제한", "척추 수술 후 활동 제한", "심장 수술 후 회복중", "암 수술 후 치료 중"]),
        )
        row["max_hours"] = rng.randint(1, 3)
        set_limitation_count(row, rng.randint(1, 3), rng)
    return row


def random_gender(rng: random.Random) -> str:
    return rng.choice(["여성", "남성", "F", "M"])


def set_disease_count(row: dict, columns: list[str], count: int, rng: random.Random) -> None:
    for column in rng.sample(columns, k=min(count, len(columns))):
        row[column] = rng.choice(["있음", "yes", "1"])


def set_limitation_count(row: dict, count: int, rng: random.Random) -> None:
    limitation_fields = ["walking_limited", "fine_motor_limited", "walking_aid", "vision", "hearing"]
    for field in rng.sample(limitation_fields, k=min(count, len(limitation_fields))):
        if field in {"vision", "hearing"}:
            row[field] = rng.choice(["저하", "limited", "yes"])
        elif field == "walking_aid":
            row[field] = rng.choice(["지팡이 사용", "보조기 사용", "yes"])
        else:
            row[field] = rng.choice(["있음", "yes", "1"])


def set_surgery(
    row: dict,
    rng: random.Random,
    recent_1y: str,
    recent_3y: str,
    recovery: str,
    detail: str,
) -> None:
    row["has_surgery"] = "있음"
    row["surgery_count"] = rng.randint(1, 2)
    row["recent_surgery_1y"] = recent_1y
    row["recent_surgery_3y"] = recent_3y
    row["surgery_recovery"] = recovery
    row["surgery_detail"] = detail


def good_cases() -> list[dict]:
    rows = []
    for i in range(1000):
        rows.append(
            base_row(
                "양호",
                age=65 + (i % 18),
                gender="남성" if i % 2 else "여성",
                height=152 + (i % 24),
                weight=50 + (i % 28),
                medicine_count=i % 3,
                max_hours=4 + (i % 3),
            )
        )
    return rows


def caution_cases() -> list[dict]:
    rows = []

    for i in range(2000):
        disease = CHRONIC_DISEASES[i % len(CHRONIC_DISEASES)]
        rows.append(base_row("주의", age=66 + (i % 20), **{disease: "있음"}))

    for i in range(1200):
        disease = SERIOUS_DISEASES[i % len(SERIOUS_DISEASES)]
        rows.append(base_row("주의", age=68 + (i % 18), medicine_count=i % 3, **{disease: "있음"}))

    for i in range(2500):
        rows.append(
            base_row(
                "주의",
                age=65 + (i % 24),
                medicine_count=3 + (i % 3),
                max_hours=4 + (i % 2),
            )
        )

    limitation_updates = [
        {"walking_limited": "있음"},
        {"fine_motor_limited": "있음"},
        {"walking_aid": "지팡이 사용"},
        {"vision": "저하"},
        {"hearing": "저하"},
    ]
    for i in range(1200):
        rows.append(base_row("주의", age=70 + (i % 18), **limitation_updates[i % len(limitation_updates)]))

    for i in range(800):
        rows.append(base_row("주의", age=70 + (i % 18), max_hours=3, medicine_count=i % 3))

    return rows


def risk_cases() -> list[dict]:
    rows = []

    for i in range(3500):
        rows.append(base_row("위험", age=70 + (i % 22), recent_fall="있음", max_hours=3 + (i % 2)))

    for i in range(2500):
        first = SERIOUS_DISEASES[i % len(SERIOUS_DISEASES)]
        second = SERIOUS_DISEASES[(i + 1) % len(SERIOUS_DISEASES)]
        rows.append(base_row("위험", age=70 + (i % 22), medicine_count=1 + (i % 4), **{first: "있음", second: "있음"}))

    for i in range(3500):
        rows.append(
            base_row(
                "위험",
                age=68 + (i % 24),
                walking_limited="있음",
                fine_motor_limited="있음",
                walking_aid="지팡이 사용",
                vision="저하",
                hearing="정상" if i % 2 else "저하",
                max_hours=4,
            )
        )

    for i in range(1200):
        disease = SERIOUS_DISEASES[i % len(SERIOUS_DISEASES)]
        rows.append(base_row("위험", age=72 + (i % 20), max_hours=1 + (i % 2), **{disease: "있음"}))

    for i in range(1200):
        chronic = CHRONIC_DISEASES[i % len(CHRONIC_DISEASES)]
        serious = SERIOUS_DISEASES[i % len(SERIOUS_DISEASES)]
        rows.append(base_row("위험", age=70 + (i % 20), medicine_count=6 + (i % 3), **{chronic: "있음", serious: "있음"}))

    return rows


def base_row(label: str, **overrides) -> dict:
    row = {
        "label": label,
        "age": overrides.pop("age", 72),
        "gender": overrides.pop("gender", "여성"),
        "height": overrides.pop("height", 160),
        "weight": overrides.pop("weight", 58),
        "medicine_count": overrides.pop("medicine_count", 0),
        "hypertension": overrides.pop("hypertension", "없음"),
        "diabetes": overrides.pop("diabetes", "없음"),
        "heart_disease": overrides.pop("heart_disease", "없음"),
        "joint_disease": overrides.pop("joint_disease", "없음"),
        "stroke": overrides.pop("stroke", "없음"),
        "kidney_disease": overrides.pop("kidney_disease", "없음"),
        "lung_disease": overrides.pop("lung_disease", "없음"),
        "liver_disease": overrides.pop("liver_disease", "없음"),
        "cancer": overrides.pop("cancer", "없음"),
        "dementia": overrides.pop("dementia", "없음"),
        "walking_limited": overrides.pop("walking_limited", "없음"),
        "fine_motor_limited": overrides.pop("fine_motor_limited", "없음"),
        "recent_fall": overrides.pop("recent_fall", "없음"),
        "max_hours": overrides.pop("max_hours", 5),
        "vision": overrides.pop("vision", "정상"),
        "hearing": overrides.pop("hearing", "정상"),
        "walking_aid": overrides.pop("walking_aid", "없음"),
        "has_surgery": overrides.pop("has_surgery", "없음"),
        "surgery_count": overrides.pop("surgery_count", 0),
        "recent_surgery_1y": overrides.pop("recent_surgery_1y", "없음"),
        "recent_surgery_3y": overrides.pop("recent_surgery_3y", "없음"),
        "surgery_recovery": overrides.pop("surgery_recovery", ""),
        "surgery_detail": overrides.pop("surgery_detail", ""),
    }
    if overrides:
        raise ValueError(f"Unknown fields: {sorted(overrides)}")
    return row


if __name__ == "__main__":
    main()
