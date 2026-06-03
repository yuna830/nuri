import json
import re
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = [
    "label",
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

PREDICT_REQUIRED_COLUMNS = [column for column in REQUIRED_COLUMNS if column != "label"]

FEATURE_COLUMNS = [
    "age_num",
    "advanced_age_flag",
    "bmi",
    "medicine_count_num",
    "physical_limitation_count_num",
    "max_hours_num",
    "hypertension_flag",
    "diabetes_flag",
    "heart_disease_flag",
    "joint_disease_flag",
    "stroke_flag",
    "kidney_disease_flag",
    "lung_disease_flag",
    "liver_disease_flag",
    "cancer_flag",
    "dementia_flag",
    "walking_limited_flag",
    "vision_limited_flag",
    "hearing_limited_flag",
    "recent_fall_flag",
    "surgery_flag",
    "disease_count",
    "serious_disease_count",
    "high_medication_flag",
    "low_activity_flag",
]


def load_rows(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            payload = payload.get("rows", [payload])
        return pd.DataFrame(payload)
    return pd.read_csv(path, encoding="utf-8-sig")


def validate_columns(df: pd.DataFrame, required_columns: list[str]) -> None:
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def normalize_label(value: object) -> str:
    text = normalize_text(value).lower()
    if text in {"good", "healthy", "normal"}:
        return "양호"
    if text in {"caution", "warning", "review"}:
        return "주의"
    if text in {"risk", "danger", "high_risk"}:
        return "위험"
    return str(value).strip()


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()
    for column in PREDICT_REQUIRED_COLUMNS:
        if column not in working.columns:
            working[column] = ""

    features = pd.DataFrame(index=working.index)
    features["age_num"] = working["age"].map(extract_max_number).fillna(0)
    features["advanced_age_flag"] = (features["age_num"] >= 85).astype(int)
    features["medicine_count_num"] = working["medicine_count"].map(extract_max_number).fillna(0)
    features["physical_limitation_count_num"] = working["physical_limitation_count"].map(extract_max_number).fillna(0)
    features["max_hours_num"] = working["max_hours"].map(extract_max_number).fillna(0)

    height_cm = working["height"].map(extract_max_number).fillna(0)
    weight_kg = working["weight"].map(extract_max_number).fillna(0)
    height_m = height_cm / 100
    features["bmi"] = (weight_kg / (height_m * height_m)).where(height_m > 0, 0).fillna(0)

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
    ]
    for column in disease_columns:
        features[f"{column}_flag"] = working[column].map(has_problem).astype(int)

    features["walking_limited_flag"] = working["walking_aid"].map(has_limited_value).astype(int)
    features["vision_limited_flag"] = working["vision"].map(has_limited_value).astype(int)
    features["hearing_limited_flag"] = working["hearing"].map(has_limited_value).astype(int)
    features["recent_fall_flag"] = working["recent_fall"].map(has_problem).astype(int)
    features["surgery_flag"] = working["has_surgery"].map(has_problem).astype(int)

    features["disease_count"] = features[[f"{column}_flag" for column in disease_columns]].sum(axis=1)
    features["serious_disease_count"] = features[
        ["heart_disease_flag", "stroke_flag", "kidney_disease_flag", "lung_disease_flag", "cancer_flag", "dementia_flag"]
    ].sum(axis=1)
    features["high_medication_flag"] = (features["medicine_count_num"] >= 3).astype(int)
    features["low_activity_flag"] = (features["max_hours_num"].between(1, 2)).astype(int)

    return features[FEATURE_COLUMNS]


def align_features(features: pd.DataFrame, feature_columns: list[str]) -> pd.DataFrame:
    aligned = features.copy()
    for column in feature_columns:
        if column not in aligned.columns:
            aligned[column] = 0
    return aligned[feature_columns]


def extract_max_number(value: object) -> float | None:
    text = normalize_text(value)
    numbers = [float(match) for match in re.findall(r"\d+(?:\.\d+)?", text)]
    if not numbers:
        return None
    return max(numbers)


def has_problem(value: object) -> bool:
    text = normalize_text(value).lower()
    if not text:
        return False
    if any(keyword in text for keyword in ["없음", "없다", "정상", "양호", "아니오", "no", "none", "false", "0"]):
        return False
    return any(
        keyword in text
        for keyword in [
            "있음",
            "있다",
            "주의",
            "위험",
            "질환",
            "진단",
            "치료",
            "관리",
            "제한",
            "중증",
            "경증",
            "yes",
            "true",
            "1",
        ]
    )


def has_limited_value(value: object) -> bool:
    text = normalize_text(value).lower()
    if not text:
        return False
    if any(keyword in text for keyword in ["없음", "없다", "정상", "양호", "미사용", "no", "none", "false", "0"]):
        return False
    return any(
        keyword in text
        for keyword in ["불편", "보조", "저하", "나쁨", "어려", "제한", "필요", "사용", "장애", "yes", "true", "1"]
    )


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value).replace(",", " ").replace("/", " ").replace("|", " ").replace("-", " ").strip()
