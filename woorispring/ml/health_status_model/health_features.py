"""
피처 엔지니어링 모듈.

학습 데이터 컬럼(REQUIRED_COLUMNS)과 모델 입력 피처(FEATURE_COLUMNS)를 정의합니다.

변경 이력 (v2 → v3):
- 제거: max_hours, physical_limitation_count, walking_aid, vision, hearing
  → 구 버전에서 이 값들은 라벨에서 역산했거나(max_hours) NHANES에서 상수값이어서
    모델이 라벨 규칙을 외우는 원인이 됐습니다.
- 추가: walking_limited (PFQ061H — K-FRAIL 라벨 항목과 다른 PFQ 문항)
- 추가: fine_motor_limited (PFQ061K)
- 추가: BMI 파생 피처, 연령대 플래그, 복합 이환 점수
"""

import json
import re
from pathlib import Path

import pandas as pd


# ---------------------------------------------------------------------------
# 컬럼 정의
# ---------------------------------------------------------------------------

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
    "walking_limited",
    "fine_motor_limited",
]

PREDICT_REQUIRED_COLUMNS = [c for c in REQUIRED_COLUMNS if c != "label"]

DISEASE_COLUMNS = [
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

# 중증 질환 (심각도 높음)
SERIOUS_DISEASE_COLUMNS = [
    "heart_disease",
    "stroke",
    "kidney_disease",
    "lung_disease",
    "cancer",
    "dementia",
]

# 만성 질환 (관리 필요)
CHRONIC_DISEASE_COLUMNS = [
    "hypertension",
    "diabetes",
    "joint_disease",
    "liver_disease",
]

FEATURE_COLUMNS = [
    # 인구통계
    "age_num",
    "gender_flag",          # 1=남성, 0=여성
    "age_70plus",           # 70세 이상
    "age_80plus",           # 80세 이상
    # 체형
    "bmi",
    "bmi_obese_flag",       # BMI >= 30
    "bmi_underweight_flag", # BMI < 18.5
    # 복약
    "medicine_count_num",
    "high_medication_flag",      # >= 3종
    "very_high_medication_flag", # >= 6종
    # 질환 플래그 (10개)
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
    # 기능 제한 (K-FRAIL 라벨 항목과 다른 PFQ 문항에서 파생)
    "walking_limited_flag",
    "fine_motor_limited_flag",
    # 파생 집계
    "disease_count",         # 전체 질환 수
    "serious_disease_count", # 중증 질환 수
    "chronic_disease_count", # 만성 질환 수
    "comorbidity_score",     # 중증*2 + 만성*1 가중 합계
]


# ---------------------------------------------------------------------------
# 데이터 로딩
# ---------------------------------------------------------------------------

def load_rows(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(payload, dict):
            payload = payload.get("rows", [payload])
        return pd.DataFrame(payload)
    return pd.read_csv(path, encoding="utf-8-sig")


def validate_columns(df: pd.DataFrame, required: list[str]) -> None:
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"누락된 필수 컬럼: {', '.join(missing)}")


# ---------------------------------------------------------------------------
# 피처 빌더
# ---------------------------------------------------------------------------

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    w = df.copy()
    # 누락 컬럼을 빈 문자열로 채워 안전하게 처리
    for col in PREDICT_REQUIRED_COLUMNS:
        if col not in w.columns:
            w[col] = ""

    feat = pd.DataFrame(index=w.index)

    # 인구통계
    feat["age_num"]    = w["age"].map(extract_number).fillna(0)
    feat["gender_flag"]= w["gender"].map(_gender_flag).astype(int)
    feat["age_70plus"] = (feat["age_num"] >= 70).astype(int)
    feat["age_80plus"] = (feat["age_num"] >= 80).astype(int)

    # 체형 → BMI
    height_cm = w["height"].map(extract_number).fillna(0)
    weight_kg = w["weight"].map(extract_number).fillna(0)
    height_m  = (height_cm / 100).where(height_cm > 0, 0)
    bmi       = (weight_kg / height_m.pow(2)).where(height_m > 0, 0).fillna(0)
    feat["bmi"]               = bmi.round(2)
    feat["bmi_obese_flag"]    = (bmi >= 30).astype(int)
    feat["bmi_underweight_flag"] = ((bmi > 0) & (bmi < 18.5)).astype(int)

    # 복약
    med = w["medicine_count"].map(extract_number).fillna(0)
    feat["medicine_count_num"]       = med
    feat["high_medication_flag"]     = (med >= 3).astype(int)
    feat["very_high_medication_flag"]= (med >= 6).astype(int)

    # 질환 플래그
    for col in DISEASE_COLUMNS:
        feat[f"{col}_flag"] = w[col].map(has_condition).astype(int)

    # 기능 제한 (K-FRAIL 라벨 항목과 다른 PFQ 문항)
    feat["walking_limited_flag"]    = w["walking_limited"].map(has_condition).astype(int)
    feat["fine_motor_limited_flag"] = w["fine_motor_limited"].map(has_condition).astype(int)

    # 집계 파생 피처
    feat["disease_count"]         = feat[[f"{c}_flag" for c in DISEASE_COLUMNS]].sum(axis=1)
    feat["serious_disease_count"] = feat[[f"{c}_flag" for c in SERIOUS_DISEASE_COLUMNS]].sum(axis=1)
    feat["chronic_disease_count"] = feat[[f"{c}_flag" for c in CHRONIC_DISEASE_COLUMNS]].sum(axis=1)
    feat["comorbidity_score"]     = feat["serious_disease_count"] * 2 + feat["chronic_disease_count"]

    return feat[FEATURE_COLUMNS]


def align_features(features: pd.DataFrame, feature_columns: list[str]) -> pd.DataFrame:
    aligned = features.copy()
    for col in feature_columns:
        if col not in aligned.columns:
            aligned[col] = 0
    return aligned[feature_columns]


# ---------------------------------------------------------------------------
# 라벨 정규화
# ---------------------------------------------------------------------------

def normalize_label(value: object) -> str:
    text = _normalize_text(value).lower()
    if text in {"good", "healthy", "normal", "robust"}:
        return "양호"
    if text in {"caution", "warning", "review", "pre-frail", "prefrail"}:
        return "주의"
    if text in {"risk", "danger", "high_risk", "frail"}:
        return "위험"
    return str(value).strip()


# ---------------------------------------------------------------------------
# 내부 헬퍼
# ---------------------------------------------------------------------------

def has_condition(value: object) -> bool:
    """'있음', 1, True, 'yes' 등 → True"""
    text = _normalize_text(value).lower()
    if not text:
        return False
    if any(kw in text for kw in ["없음", "없다", "정상", "양호", "아니오", "no", "none", "false", "0"]):
        return False
    return any(kw in text for kw in [
        "있음", "있다", "주의", "위험", "질환", "진단", "치료", "관리",
        "제한", "중증", "경증", "yes", "true", "1",
    ])


def extract_number(value: object) -> float | None:
    text = _normalize_text(value)
    nums = [float(m) for m in re.findall(r"\d+(?:\.\d+)?", text)]
    return max(nums) if nums else None


def _gender_flag(value: object) -> int:
    text = _normalize_text(value).lower()
    if any(kw in text for kw in ["남", "male", "m", "1"]):
        return 1
    return 0


def _normalize_text(value: object) -> str:
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value).replace(",", " ").replace("/", " ").replace("|", " ").replace("-", " ").strip()
