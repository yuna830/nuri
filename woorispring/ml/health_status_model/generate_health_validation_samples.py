import argparse
from pathlib import Path

import pandas as pd


COLUMNS = [
    "case_id",
    "expected_label",
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
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate deterministic policy validation samples for health models.")
    parser.add_argument("--output", default="data/validation/health_status_validation_samples.csv")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rows = []
    rows.extend(good_cases())
    rows.extend(caution_cases())
    rows.extend(risk_cases())

    if len(rows) != 200:
        raise RuntimeError(f"Expected 200 validation rows, got {len(rows)}")

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(rows, columns=COLUMNS).to_csv(output, index=False, encoding="utf-8-sig")

    summary = pd.Series([row["expected_label"] for row in rows]).value_counts().to_dict()
    print({"output": str(output), "rows": len(rows), "expected_distribution": summary})


def good_cases() -> list[dict]:
    rows = []
    for i, age in enumerate(range(65, 75), start=1):
        rows.append(row(f"good_healthy_65_74_{i:02d}", "good", age, gender=i, max_hours=5))
    for i, age in enumerate(range(70, 80), start=1):
        rows.append(row(f"good_active_70_79_{i:02d}", "good", age, gender=i, height=158 + i % 12, weight=54 + i % 16, max_hours=5))
    for i, age in enumerate(range(65, 75), start=1):
        rows.append(row(f"good_light_weight_{i:02d}", "good", age, gender=i, height=150 + i % 10, weight=48 + i % 9, max_hours=4))
    for i, age in enumerate(range(68, 78), start=1):
        rows.append(row(f"good_no_disease_maintenance_{i:02d}", "good", age, gender=i, medicine_count=0, max_hours=4))
    for i, age in enumerate(range(65, 75), start=1):
        rows.append(row(f"good_post_surgery_recovered_{i:02d}", "good", age, gender=i, has_surgery="yes", max_hours=5))
    return rows


def caution_cases() -> list[dict]:
    rows = []
    for i, age in enumerate(range(72, 87), start=1):
        rows.append(row(f"caution_hypertension_{i:02d}", "caution", age, gender=i, hypertension="yes", medicine_count=1, max_hours=5))
    for i, age in enumerate(range(70, 85), start=1):
        rows.append(row(f"caution_diabetes_{i:02d}", "caution", age, gender=i, diabetes="yes", medicine_count=1, max_hours=5))
    for i, age in enumerate(range(74, 89), start=1):
        rows.append(
            row(
                f"caution_hyper_diabetes_{i:02d}",
                "caution",
                age,
                gender=i,
                hypertension="yes",
                diabetes="yes",
                medicine_count=2,
                max_hours=4,
            )
        )
    for i, age in enumerate(range(75, 90), start=1):
        rows.append(row(f"caution_joint_limited_{i:02d}", "caution", age, gender=i, joint_disease="yes", physical_limitation_count=1, max_hours=4))
    for i, age in enumerate(range(76, 84), start=1):
        rows.append(row(f"caution_medicine_count_{i:02d}", "caution", age, gender=i, medicine_count=3 + i % 3, max_hours=4))
    for i, age in enumerate(range(77, 85), start=1):
        rows.append(row(f"caution_short_hours_{i:02d}", "caution", age, gender=i, medicine_count=1, max_hours=3))
    for i, age in enumerate(range(78, 86), start=1):
        rows.append(row(f"caution_walking_aid_{i:02d}", "caution", age, gender=i, walking_aid="yes", physical_limitation_count=1, max_hours=4))
    for i, age in enumerate(range(78, 86), start=1):
        rows.append(row(f"caution_vision_hearing_{i:02d}", "caution", age, gender=i, vision="limited" if i % 2 else "normal", hearing="limited" if i % 2 == 0 else "normal", physical_limitation_count=1, max_hours=4))
    for i, age in enumerate(range(80, 84), start=1):
        rows.append(row(f"caution_serious_stable_{i:02d}", "caution", age, gender=i, heart_disease="yes" if i % 2 else "no", lung_disease="yes" if i % 2 == 0 else "no", medicine_count=2, max_hours=4))
    for i, age in enumerate(range(85, 89), start=1):
        rows.append(row(f"caution_very_old_no_disease_{i:02d}", "caution", age, gender=i, max_hours=4))
    return rows


def risk_cases() -> list[dict]:
    rows = []
    for i, age in enumerate(range(75, 95), start=1):
        rows.append(row(f"risk_recent_fall_{i:02d}", "risk", age, gender=i, recent_fall="yes", joint_disease="yes" if i % 2 else "no", physical_limitation_count=1, max_hours=3))
    for i, age in enumerate(range(80, 90), start=1):
        rows.append(row(f"risk_two_serious_{i:02d}", "risk", age, gender=i, heart_disease="yes", stroke="yes", hypertension="yes", medicine_count=4, max_hours=2))
    for i, age in enumerate(range(80, 90), start=1):
        rows.append(row(f"risk_low_hours_serious_{i:02d}", "risk", age, gender=i, heart_disease="yes" if i % 2 else "no", kidney_disease="yes" if i % 2 == 0 else "no", medicine_count=3, max_hours=2))
    for i, age in enumerate(range(82, 92), start=1):
        rows.append(row(f"risk_many_limits_{i:02d}", "risk", age, gender=i, joint_disease="yes", walking_aid="yes", vision="limited", hearing="limited", medicine_count=4, physical_limitation_count=3, max_hours=2))
    return rows


def row(case_id: str, expected_label: str, age: int, gender: int = 0, **overrides) -> dict:
    base = {
        "case_id": case_id,
        "expected_label": expected_label,
        "age": age,
        "gender": "F" if gender % 2 else "M",
        "height": overrides.pop("height", 156 if gender % 2 else 168),
        "weight": overrides.pop("weight", 58 if gender % 2 else 68),
        "medicine_count": overrides.pop("medicine_count", 0),
        "hypertension": overrides.pop("hypertension", "no"),
        "diabetes": overrides.pop("diabetes", "no"),
        "heart_disease": overrides.pop("heart_disease", "no"),
        "joint_disease": overrides.pop("joint_disease", "no"),
        "stroke": overrides.pop("stroke", "no"),
        "kidney_disease": overrides.pop("kidney_disease", "no"),
        "lung_disease": overrides.pop("lung_disease", "no"),
        "liver_disease": overrides.pop("liver_disease", "no"),
        "cancer": overrides.pop("cancer", "no"),
        "dementia": overrides.pop("dementia", "no"),
        "walking_aid": overrides.pop("walking_aid", "no"),
        "vision": overrides.pop("vision", "normal"),
        "hearing": overrides.pop("hearing", "normal"),
        "recent_fall": overrides.pop("recent_fall", "no"),
        "has_surgery": overrides.pop("has_surgery", "no"),
        "physical_limitation_count": overrides.pop("physical_limitation_count", 0),
        "max_hours": overrides.pop("max_hours", 5),
    }
    if overrides:
        raise ValueError(f"Unknown overrides for {case_id}: {sorted(overrides)}")
    return base


if __name__ == "__main__":
    main()
