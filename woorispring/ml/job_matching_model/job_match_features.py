import json
import re
from pathlib import Path

import pandas as pd


REQUIRED_COLUMNS = [
    "label",
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
    "job_type",
    "work_environment",
    "physical_intensity",
    "daily_hours",
    "commute_level",
    "task_tags",
    "closed",
]

PREDICT_REQUIRED_COLUMNS = [column for column in REQUIRED_COLUMNS if column != "label"]

NUMERIC_FEATURES = [
    "max_hours_num",
    "daily_hours_num",
    "hours_gap",
    "max_commute_rank",
    "job_commute_rank",
    "commute_gap",
    "medicine_count_num",
    "closed_flag",
    "hope_job_type_match",
    "hope_condition_match",
    "outdoor_conflict",
    "standing_conflict",
    "heavy_lifting_conflict",
    "walking_conflict",
    "health_high_intensity_conflict",
    "disease_intensity_conflict",
    "recent_fall_movement_conflict",
]

CATEGORICAL_FEATURES = [
    "health_status",
    "work_environment",
    "physical_intensity",
    "job_type",
]


def load_rows(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            if "rows" in payload:
                payload = payload["rows"]
            else:
                payload = [payload]
        return pd.DataFrame(payload)

    return pd.read_csv(path, encoding="utf-8")


def validate_columns(df: pd.DataFrame, required_columns: list[str]) -> None:
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def normalize_label(value: object) -> str:
    text = normalize_text(value)
    if text in {"fit", "suitable", "ok"}:
        return "적합"
    if text in {"review", "check"}:
        return "검토"
    if text in {"unfit", "bad", "no"}:
        return "부적합"
    return str(value).strip()


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    working = df.copy()

    for column in PREDICT_REQUIRED_COLUMNS:
        if column not in working.columns:
            working[column] = ""

    result = pd.DataFrame(index=working.index)
    result["max_hours_num"] = working["max_hours"].map(extract_max_number).fillna(0)
    result["daily_hours_num"] = working["daily_hours"].map(extract_max_number).fillna(0)
    result["hours_gap"] = result["max_hours_num"] - result["daily_hours_num"]
    result["max_commute_rank"] = working["max_distance"].map(commute_rank).fillna(0)
    result["job_commute_rank"] = working["commute_level"].map(commute_rank).fillna(0)
    result["commute_gap"] = result["max_commute_rank"] - result["job_commute_rank"]
    result["medicine_count_num"] = working["medicine_count"].map(extract_max_number).fillna(0)
    result["closed_flag"] = working["closed"].map(to_bool).astype(int)

    result["hope_job_type_match"] = working.apply(
        lambda row: contains_token(row["hope_job_type"], row["job_type"], row["job_type"]), axis=1
    ).astype(int)

    result["hope_condition_match"] = working.apply(
        lambda row: contains_token(
            join_text(row["hope_condition"], row["disabled_work"]),
            join_text(row["work_environment"], row["task_tags"], row["job_type"]),
            row["work_environment"],
        ),
        axis=1,
    ).astype(int)

    result["outdoor_conflict"] = working.apply(
        lambda row: has_any(row["disabled_work"], ["야외 불가", "야외 어려", "실내 선호", "실내만"])
        and has_any(row["work_environment"], ["야외"]),
        axis=1,
    ).astype(int)

    result["standing_conflict"] = working.apply(
        lambda row: has_any(join_text(row["disabled_work"], row["disease_text"]), ["장시간 서", "오래 서", "관절 통증"])
        and has_any(row["task_tags"], ["장시간 서", "서있기", "오래 서"]),
        axis=1,
    ).astype(int)

    result["heavy_lifting_conflict"] = working.apply(
        lambda row: has_any(join_text(row["disabled_work"], row["disease_text"]), ["무거운", "운반 어려", "근력 제한"])
        and has_any(row["task_tags"], ["무거운", "운반", "상하차"]),
        axis=1,
    ).astype(int)

    result["walking_conflict"] = working.apply(
        lambda row: has_limited_value(row["walking_aid"])
        and has_any(row["task_tags"], ["이동 많음", "계단", "순찰", "배달"]),
        axis=1,
    ).astype(int)

    result["health_high_intensity_conflict"] = working.apply(
        lambda row: has_any(row["health_status"], ["위험"])
        and has_any(row["physical_intensity"], ["높음", "고강도"]),
        axis=1,
    ).astype(int)

    result["disease_intensity_conflict"] = working.apply(
        lambda row: has_any(row["disease_text"], ["중증", "활동 제한", "치료 필요", "작업 제한"])
        and has_any(row["physical_intensity"], ["중간", "높음", "고강도"]),
        axis=1,
    ).astype(int)

    result["recent_fall_movement_conflict"] = working.apply(
        lambda row: has_multiple_falls(row["recent_fall"])
        and has_any(row["task_tags"], ["이동 많음", "계단", "순찰", "배달"]),
        axis=1,
    ).astype(int)

    category_frame = pd.DataFrame(index=working.index)
    for column in CATEGORICAL_FEATURES:
        category_frame[column] = working[column].map(normalize_text)

    category_dummies = pd.get_dummies(category_frame, columns=CATEGORICAL_FEATURES, dtype=int)
    return pd.concat([result[NUMERIC_FEATURES], category_dummies], axis=1)


def align_features(features: pd.DataFrame, feature_columns: list[str]) -> pd.DataFrame:
    aligned = features.copy()
    for column in feature_columns:
        if column not in aligned.columns:
            aligned[column] = 0

    return aligned[feature_columns]


def extract_max_number(value: object) -> float | None:
    text = normalize_text(value)
    numbers = [int(match) for match in re.findall(r"\d+", text)]
    if not numbers:
        return None
    return float(max(numbers))


def commute_rank(value: object) -> float | None:
    text = normalize_text(value)
    if not text:
        return None
    if "도보" in text and "10" in text:
        return 1.0
    if "도보" in text and "30" in text:
        return 2.0
    if any(keyword in text for keyword in ["대중교통", "버스", "지하철"]) and "30" in text:
        return 3.0
    if "1시간" in text or "60" in text:
        return 4.0

    number = extract_max_number(text)
    if number is None:
        return None
    if number <= 10:
        return 1.0
    if number <= 30:
        return 2.0
    return 4.0


def to_bool(value: object) -> bool:
    text = normalize_text(value).lower()
    return text in {"1", "true", "yes", "y", "마감", "마감됨"}


def has_limited_value(value: object) -> bool:
    text = normalize_text(value)
    if not text:
        return False
    if has_any(text, ["없음", "없다", "미사용", "사용 안", "해당 없음"]):
        return False
    return has_any(text, ["어려", "불가", "보조", "불편", "느림", "제한", "필요", "사용", "의존"])


def has_multiple_falls(value: object) -> bool:
    text = normalize_text(value)
    if not text or has_any(text, ["없음", "없다", "0회", "아니오"]):
        return False
    number = extract_max_number(text)
    return bool(number is not None and number >= 2) or has_any(text, ["2~3", "여러", "자주", "반복", "다수"])


def contains_token(source: object, target: object, fallback: object = "") -> bool:
    source_tokens = set(tokenize(source))
    target_text = normalize_text(join_text(target, fallback))
    return any(token in target_text for token in source_tokens if len(token) >= 2)


def has_any(value: object, keywords: list[str]) -> bool:
    text = normalize_text(value)
    return any(normalize_text(keyword) in text for keyword in keywords)


def tokenize(value: object) -> list[str]:
    return [token for token in normalize_text(value).split(" ") if token]


def join_text(*values: object) -> str:
    return " ".join(normalize_text(value) for value in values if normalize_text(value))


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple, set)):
        return " ".join(normalize_text(item) for item in value if normalize_text(item))
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return (
        str(value)
        .replace(",", " ")
        .replace("/", " ")
        .replace("|", " ")
        .replace("·", " ")
        .replace("-", " ")
        .strip()
    )
