import argparse
import json
from pathlib import Path

import pandas as pd

from health_features import REQUIRED_COLUMNS, normalize_label


EXTERNAL_COLUMN_ALIASES = {
    "age": ["age", "Age", "patient_age", "Patient Age"],
    "gender": ["gender", "Gender", "sex", "Sex"],
    "height": ["height", "Height", "height_cm", "Height_cm"],
    "weight": ["weight", "Weight", "weight_kg", "Weight_kg"],
    "medicine_count": ["medicine_count", "Medication Count", "medication_count", "num_medications"],
    "hypertension": ["hypertension", "Hypertension", "high_blood_pressure", "High Blood Pressure", "Has_Hypertension"],
    "diabetes": ["diabetes", "Diabetes", "Diabetic"],
    "heart_disease": ["heart_disease", "HeartDisease", "Heart Disease", "cardiac_condition"],
    "joint_disease": ["joint_disease", "Joint Disease", "arthritis"],
    "stroke": ["stroke", "Stroke"],
    "kidney_disease": ["kidney_disease", "Kidney Disease"],
    "lung_disease": ["lung_disease", "Lung Disease", "asthma", "copd"],
    "liver_disease": ["liver_disease", "Liver Disease"],
    "cancer": ["cancer", "Cancer"],
    "dementia": ["dementia", "Dementia"],
    "walking_aid": ["walking_aid", "Walking Aid", "mobility_aid"],
    "vision": ["vision", "Vision"],
    "hearing": ["hearing", "Hearing"],
    "recent_fall": ["recent_fall", "Recent Fall", "falls"],
    "has_surgery": ["has_surgery", "Surgery", "surgery_history"],
    "surgery_count": ["surgery_count", "Surgery Count", "surgery_count_num"],
    "recent_surgery_1y": ["recent_surgery_1y", "recent_surgery_1year"],
    "recent_surgery_3y": ["recent_surgery_3y", "recent_surgery_3year"],
    "surgery_recovery": ["surgery_recovery", "surgery_recovery_status"],
    "surgery_detail": ["surgery_detail", "surgery_type", "surgery_name"],
    "walking_limited": ["walking_limited", "walking_difficulty", "mobility_limited"],
    "fine_motor_limited": ["fine_motor_limited", "fine_motor_difficulty"],
    "max_hours": ["max_hours", "Max Hours"],
    "label": ["label", "health_status", "Health Status", "risk_level", "Risk Level"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build v2 health status training CSV without touching production artifacts.")
    parser.add_argument("--base", default="data/nhanes_health_status_training.csv", help="Current normalized NHANES CSV.")
    parser.add_argument("--external-dir", default="data/external", help="Directory containing optional Kaggle/AI Hub CSV files.")
    parser.add_argument("--output", default="data/processed/health_status_training_v2.csv", help="Normalized v2 CSV output.")
    parser.add_argument("--summary", default="data/processed/health_status_training_v2_summary.json", help="Build summary JSON.")
    parser.add_argument("--min-age", type=int, default=65, help="Filter rows with explicit age below this value.")
    parser.add_argument("--no-base", action="store_true", help="Use only external files, not the current NHANES CSV.")
    parser.add_argument(
        "--recent-fall-augmentation-count",
        type=int,
        default=200,
        help="Add policy examples where a recent fall should be learned as risk.",
    )
    parser.add_argument(
        "--advanced-age-caution-threshold",
        type=int,
        default=85,
        help="Treat people at or above this age as at least caution, unless already risk.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    frames = []
    sources = []

    if not args.no_base:
        base = pd.read_csv(args.base, encoding="utf-8-sig")
        base = ensure_schema(base)
        base["source_dataset"] = "nhanes_current"
        frames.append(base)
        sources.append({"source": "nhanes_current", "rows": int(len(base)), "mode": "normalized"})

    for csv_path in sorted(Path(args.external_dir).rglob("*.csv")):
        raw = pd.read_csv(csv_path, encoding="utf-8-sig")
        normalized, mode = normalize_external(raw, csv_path, min_age=args.min_age)
        if normalized.empty:
            sources.append({"source": str(csv_path), "rows": 0, "mode": mode})
            continue
        normalized["source_dataset"] = str(csv_path)
        frames.append(normalized)
        sources.append({"source": str(csv_path), "rows": int(len(normalized)), "mode": mode})

    if not frames:
        raise RuntimeError("No training rows found. Add data to data/external or keep the base NHANES input.")

    combined = pd.concat(frames, ignore_index=True)
    combined = ensure_schema(combined)
    combined = apply_policy_labels(combined, args.advanced_age_caution_threshold)
    combined = filter_by_age(combined, args.min_age)
    recent_fall_policy_samples = build_recent_fall_policy_samples(combined, args.recent_fall_augmentation_count)
    if not recent_fall_policy_samples.empty:
        combined = pd.concat([combined, recent_fall_policy_samples], ignore_index=True)
        sources.append(
            {
                "source": "policy_recent_fall",
                "rows": int(len(recent_fall_policy_samples)),
                "mode": "augmentation",
            }
        )
    combined = combined.drop_duplicates(subset=[column for column in REQUIRED_COLUMNS if column != "label"])
    combined.to_csv(output_path, index=False, encoding="utf-8-sig")

    summary = {
        "output": str(output_path),
        "rows": int(len(combined)),
        "label_distribution": combined["label"].value_counts().to_dict(),
        "policy": {
            "recent_fall": "risk",
            "advanced_age_caution_threshold": args.advanced_age_caution_threshold,
        },
        "sources": sources,
    }
    Path(args.summary).write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))


def normalize_external(df: pd.DataFrame, csv_path: Path, min_age: int) -> tuple[pd.DataFrame, str]:
    if set(REQUIRED_COLUMNS).issubset(df.columns):
        normalized = ensure_schema(df.copy())
        return filter_by_age(normalized, min_age), "normalized"

    normalized = pd.DataFrame()
    for target_column in REQUIRED_COLUMNS:
        normalized[target_column] = read_alias(df, target_column)

    lower_name = csv_path.name.lower()
    apply_bmi_fallback(normalized, df)

    if "Medication" in df.columns:
        normalized["medicine_count"] = df["Medication"].map(lambda value: "1" if problem(value) else "0")
    if "Has_Hypertension" in df.columns:
        normalized["hypertension"] = df["Has_Hypertension"].map(yes_no)
    if "Diabetic" in df.columns:
        normalized["diabetes"] = df["Diabetic"].map(yes_no)
    if "Blood_Pressure" in df.columns:
        normalized["hypertension"] = df["Blood_Pressure"].map(hypertension_from_blood_pressure)
    if "Diagnosis" in df.columns:
        diagnosis = df["Diagnosis"].fillna("").astype(str).str.lower()
        normalized.loc[diagnosis.str.contains("diabetes", na=False), "diabetes"] = "있음"
        normalized.loc[diagnosis.str.contains("hypertension|blood pressure", na=False), "hypertension"] = "있음"
        normalized.loc[diagnosis.str.contains("heart|cardiac|coronary", na=False), "heart_disease"] = "있음"

    if "diabetes" in lower_name and "Outcome" in df.columns:
        normalized["diabetes"] = df["Outcome"].map(lambda value: "있음" if number(value) >= 1 else "없음")
    if "diabetes" in lower_name and "BloodPressure" in df.columns:
        normalized["hypertension"] = df["BloodPressure"].map(lambda value: "있음" if number(value) >= 90 else "없음")
    if any(token in lower_name for token in ["heart", "hypertension"]) and "target" in df.columns:
        normalized["heart_disease"] = df["target"].map(lambda value: "있음" if number(value) >= 1 else "없음")
    if any(token in lower_name for token in ["heart", "hypertension"]) and "TenYearCHD" in df.columns:
        normalized["heart_disease"] = df["TenYearCHD"].map(lambda value: "있음" if number(value) >= 1 else "없음")

    normalized = fill_defaults(normalized)
    normalized["label"] = normalized.apply(weak_label, axis=1)
    normalized = ensure_schema(normalized)
    return filter_by_age(normalized, min_age), "best_effort"


def apply_bmi_fallback(normalized: pd.DataFrame, df: pd.DataFrame) -> None:
    if "BMI" not in df.columns:
        return
    bmi = pd.to_numeric(df["BMI"], errors="coerce")
    missing_height = normalized["height"].replace("", pd.NA).isna()
    missing_weight = normalized["weight"].replace("", pd.NA).isna()
    normalized.loc[missing_height & bmi.notna(), "height"] = "160"
    normalized.loc[missing_weight & bmi.notna(), "weight"] = (bmi * 1.6 * 1.6).round(1).astype(str)


def yes_no(value: object) -> str:
    text = str(value or "").strip().lower()
    if text in {"yes", "y", "true", "1", "있음", "있다"}:
        return "있음"
    return "없음"


def hypertension_from_blood_pressure(value: object) -> str:
    text = str(value or "")
    parts = pd.Series(text.replace("\\", "/").split("/")).map(number).dropna().tolist()
    if len(parts) >= 2 and (parts[0] >= 140 or parts[1] >= 90):
        return "있음"
    return "없음"


def ensure_schema(df: pd.DataFrame) -> pd.DataFrame:
    for column in REQUIRED_COLUMNS:
        if column not in df.columns:
            df[column] = ""
    df = df[REQUIRED_COLUMNS].copy()
    df["label"] = df["label"].map(normalize_label).replace("", pd.NA)
    df = df.dropna(subset=["label"])
    return df


def apply_policy_labels(df: pd.DataFrame, advanced_age_caution_threshold: int = 85) -> pd.DataFrame:
    working = df.copy()
    recent_fall = working["recent_fall"].map(problem)
    working.loc[recent_fall, "label"] = "\uc704\ud5d8"
    advanced_age = working["age"].map(number).fillna(0) >= advanced_age_caution_threshold
    not_risk = working["label"].map(normalize_label) != "\uc704\ud5d8"
    working.loc[advanced_age & not_risk, "label"] = "\uc8fc\uc758"
    return working


def build_recent_fall_policy_samples(df: pd.DataFrame, count: int) -> pd.DataFrame:
    if count <= 0:
        return pd.DataFrame(columns=REQUIRED_COLUMNS)

    candidates = df[~df["recent_fall"].map(problem)].copy()
    if candidates.empty:
        return pd.DataFrame(columns=REQUIRED_COLUMNS)

    samples = candidates.sample(n=min(count, len(candidates)), random_state=42).copy()
    samples["recent_fall"] = "\uc788\uc74c"
    samples["label"] = "\uc704\ud5d8"
    samples["max_hours"] = samples["max_hours"].replace("", "3").fillna("3")
    return samples[REQUIRED_COLUMNS]


def read_alias(df: pd.DataFrame, target_column: str) -> pd.Series:
    for source_column in EXTERNAL_COLUMN_ALIASES[target_column]:
        if source_column in df.columns:
            return df[source_column]
    return pd.Series([""] * len(df), index=df.index)


def fill_defaults(df: pd.DataFrame) -> pd.DataFrame:
    disease_columns = [
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
        "recent_fall",
        "has_surgery",
        "recent_surgery_1y",
        "recent_surgery_3y",
    ]
    for column in disease_columns:
        if column in df.columns:
            df[column] = df[column].replace("", "없음").fillna("없음")
    for col, default in [("walking_aid", "없음"), ("vision", "정상"), ("hearing", "정상")]:
        if col in df.columns:
            df[col] = df[col].replace("", default).fillna(default)
    df["medicine_count"] = df["medicine_count"].replace("", "0").fillna("0")
    df["surgery_count"] = df["surgery_count"].replace("", "0").fillna("0")
    df["max_hours"] = df["max_hours"].replace("", "5").fillna("5")
    return df


def filter_by_age(df: pd.DataFrame, min_age: int) -> pd.DataFrame:
    ages = df["age"].map(number)
    return df[(ages.isna()) | (ages >= min_age)].copy()


def weak_label(row: pd.Series) -> str:
    serious = sum(problem(row[column]) for column in ["heart_disease", "stroke", "kidney_disease", "lung_disease", "cancer", "dementia"])
    chronic = sum(problem(row[column]) for column in ["hypertension", "diabetes", "joint_disease", "liver_disease"])
    limitations = 0
    if problem(row["walking_limited"]):
        limitations += 1
    if problem(row["fine_motor_limited"]):
        limitations += 1
    if limited(row["walking_aid"]):
        limitations += 1
    if limited(row["vision"]):
        limitations += 1
    if limited(row["hearing"]):
        limitations += 1
    medicine_count = int(number(row["medicine_count"]) or 0)
    max_hours = int(number(row["max_hours"]) or 0)
    age = int(number(row["age"]) or 0)
    has_surgery = problem(row["has_surgery"]) or (number(row["surgery_count"]) or 0) > 0
    recent_surgery_1y = problem(row["recent_surgery_1y"])
    recent_surgery_3y = problem(row["recent_surgery_3y"])
    surgery_recovering = recovery_incomplete(row["surgery_recovery"])
    surgery_high_impact = high_impact_surgery(row["surgery_detail"])

    surgery_risk = recent_surgery_1y and surgery_recovering and (
        limitations >= 1 or (0 < max_hours <= 3) or surgery_high_impact
    )
    surgery_caution = has_surgery and (
        recent_surgery_1y or recent_surgery_3y or surgery_recovering or surgery_high_impact
    )

    if problem(row["recent_fall"]) or serious >= 2 or limitations >= 4 or (serious >= 1 and 0 < max_hours <= 2) or surgery_risk:
        return "위험"
    if age >= 85:
        return "주의"
    if serious >= 1 or chronic >= 1 or medicine_count >= 3 or limitations >= 1 or (0 < max_hours <= 3) or surgery_caution:
        return "주의"
    return "양호"


def problem(value: object) -> bool:
    text = str(value or "").strip().lower()
    if not text or any(keyword in text for keyword in ["없음", "정상", "양호", "아니오", "no", "none", "false", "0"]):
        return False
    return any(keyword in text for keyword in ["있음", "주의", "위험", "질환", "진단", "치료", "관리", "yes", "true", "1"])


def limited(value: object) -> bool:
    text = str(value or "").strip().lower()
    if not text or any(keyword in text for keyword in ["없음", "정상", "양호", "미사용", "no", "none", "false", "0"]):
        return False
    return any(keyword in text for keyword in ["불편", "보조", "저하", "나쁨", "어려", "제한", "필요", "사용", "장애", "yes", "true", "1"])


def recovery_incomplete(value: object) -> bool:
    text = str(value or "").strip().lower()
    if not text:
        return False
    if any(keyword in text for keyword in ["회복완료", "완료", "recovered", "complete", "정상"]):
        return False
    return any(keyword in text for keyword in ["회복중", "미회복", "모름", "불완전", "치료", "재활", "중", "incomplete", "recovering", "unknown"])


def high_impact_surgery(value: object) -> bool:
    text = str(value or "").strip().lower()
    if not text:
        return False
    return any(keyword in text for keyword in [
        "관절", "무릎", "고관절", "척추", "허리", "디스크", "골절", "인공관절",
        "심장", "스텐트", "관상동맥", "뇌", "뇌졸중", "암", "폐", "신장",
        "다리", "발목", "발", "hip", "knee", "spine", "heart", "brain", "cancer",
    ])


def number(value: object) -> float | None:
    parsed = pd.to_numeric(value, errors="coerce")
    return None if pd.isna(parsed) else float(parsed)


if __name__ == "__main__":
    main()
