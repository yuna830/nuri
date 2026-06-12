"""
2단계 건강 상태 예측 스크립트.

─────────────────────────────────────────────────────────────────
  Stage 1: 양호 vs 비양호
  Stage 2: (비양호이면) 주의 vs 위험
─────────────────────────────────────────────────────────────────

출력 형식:
  {
    "predictions": [
      {
        "prediction": "위험",
        "probabilities": {"양호": 0.002, "주의": 0.253, "위험": 0.746},
        "stage1": {"양호": 0.003, "비양호": 0.997},
        "stage2": {"주의": 0.253, "위험": 0.747}
      }
    ]
  }

사용:
  python predict_health_status.py --input data/predict_sample.json
"""

import argparse
import json
import re
from pathlib import Path

import joblib
import numpy as np

from health_features import (
    PREDICT_REQUIRED_COLUMNS,
    REQUIRED_COLUMNS,
    align_features,
    build_features,
    load_rows,
    normalize_label,
    validate_columns,
)

OUTPUT_CLASSES = ["양호", "주의", "위험"]
DEFAULT_CASE_EXAMPLES = Path("data/processed/health_status_policy_training_samples.csv")
CASE_CONFIRM_THRESHOLD = 0.6
CASE_ADJUST_THRESHOLD = 0.7
LOW_MODEL_CONFIDENCE_THRESHOLD = 0.65


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="2-stage health status prediction.")
    parser.add_argument("--input",           required=True, help="예측할 CSV 또는 JSON 파일")
    parser.add_argument("--artifacts-dir",   default="artifacts", help="모델 파일 디렉토리")
    parser.add_argument("--case-examples",   default=str(DEFAULT_CASE_EXAMPLES), help="유사 사례 비교용 CSV 파일")
    parser.add_argument("--case-top-k",      type=int, default=5, help="비교할 유사 사례 수")
    parser.add_argument("--no-case-check",   action="store_true", help="유사 사례 검증을 건너뜀")
    parser.add_argument("--verbose",         action="store_true",  help="Stage별 확률도 출력")
    return parser.parse_args()


def load_models(artifacts_dir: Path):
    """2단계 모델과 피처 컬럼 로드."""
    stage1 = joblib.load(artifacts_dir / "stage1_model.joblib")
    stage2 = joblib.load(artifacts_dir / "stage2_model.joblib")
    feature_columns = json.loads(
        (artifacts_dir / "feature_columns.json").read_text(encoding="utf-8")
    )
    return stage1, stage2, feature_columns


def cascade_predict_proba(features: np.ndarray, stage1, stage2) -> np.ndarray:
    """
    캐스케이드 확률 계산.
    반환: (n, 3) — [P(양호), P(주의), P(위험)]
    """
    p1 = stage1.predict_proba(features)   # [P(양호), P(비양호)]
    p2 = stage2.predict_proba(features)   # [P(주의|비양호), P(위험|비양호)]

    p_healthy    = p1[:, 0]
    p_nonhealthy = p1[:, 1]
    p_caution    = p_nonhealthy * p2[:, 0]
    p_danger     = p_nonhealthy * p2[:, 1]

    return np.stack([p_healthy, p_caution, p_danger], axis=1)


def load_case_examples(path: str | Path, feature_columns: list[str]):
    """유사 사례 CSV를 모델 입력 피처로 변환해서 캐시 가능한 형태로 준비."""
    path = Path(path)
    if not path.exists():
        return None

    cases = load_rows(path)
    validate_columns(cases, REQUIRED_COLUMNS)
    cases = cases.copy()
    cases["label"] = cases["label"].map(normalize_label)

    case_features = align_features(build_features(cases), feature_columns)
    feature_min = case_features.min(axis=0)
    feature_range = (case_features.max(axis=0) - feature_min).replace(0, 1)

    return {
        "path": path,
        "rows": cases.reset_index(drop=True),
        "features": ((case_features - feature_min) / feature_range).to_numpy(dtype=float),
        "feature_min": feature_min,
        "feature_range": feature_range,
    }


def normalize_input_features(features, case_index) -> np.ndarray:
    normalized = (features - case_index["feature_min"]) / case_index["feature_range"]
    return normalized.to_numpy(dtype=float)


def display_value(value, present_label: str = "있음") -> str:
    raw = str(value).strip()
    lowered = raw.lower()
    if lowered in {"yes", "1", "true"}:
        return present_label
    if lowered == "limited":
        return "저하"
    return raw


def summarize_case(row) -> str:
    details = []
    disease_labels = [
        ("hypertension", "고혈압"),
        ("diabetes", "당뇨"),
        ("heart_disease", "심장질환"),
        ("joint_disease", "관절질환"),
        ("stroke", "뇌졸중"),
        ("kidney_disease", "신장질환"),
        ("lung_disease", "호흡기질환"),
        ("liver_disease", "간질환"),
        ("cancer", "암"),
        ("dementia", "치매"),
    ]
    disease_count = sum(1 for key, _ in disease_labels if str(row.get(key, "")).strip() not in {"", "없음", "정상", "no", "none", "0"})
    if disease_count:
        details.append(f"질환 {disease_count}개")

    medicine = row.get("medicine_count", "")
    if str(medicine).strip():
        details.append(f"복약 {medicine}개")

    if str(row.get("recent_fall", "")).strip() not in {"", "없음", "정상", "no", "none", "0"}:
        details.append(f"낙상 {display_value(row.get('recent_fall'))}")

    max_hours = row.get("max_hours", "")
    if str(max_hours).strip():
        details.append(f"활동 {max_hours}시간")

    limited = []
    if str(row.get("walking_aid", "")).strip() not in {"", "없음", "정상", "no", "none", "0"}:
        limited.append(f"보행보조 {display_value(row.get('walking_aid'), '사용')}")
    if str(row.get("vision", "")).strip() not in {"", "정상", "없음", "no", "none", "0"}:
        limited.append(f"시력 {display_value(row.get('vision'), '저하')}")
    if str(row.get("hearing", "")).strip() not in {"", "정상", "없음", "no", "none", "0"}:
        limited.append(f"청력 {display_value(row.get('hearing'), '저하')}")
    details.extend(limited)

    surgery = summarize_surgery(row)
    if surgery:
        details.append(surgery)

    return ", ".join(details[:5]) if details else "주요 위험 조건 없음"


def is_present_value(value) -> bool:
    return str(value).strip().lower() not in {"", "없음", "정상", "no", "none", "0", "nan"}


def is_recovery_incomplete(value) -> bool:
    text = str(value or "").strip().lower()
    if not text:
        return False
    if any(keyword in text for keyword in ["회복완료", "완료", "recovered", "complete", "정상"]):
        return False
    return any(keyword in text for keyword in ["회복중", "미회복", "모름", "불완전", "치료", "재활", "중", "incomplete", "recovering", "unknown"])


def summarize_surgery(row) -> str:
    has_surgery = is_present_value(row.get("has_surgery", "")) or safe_int(row.get("surgery_count", 0)) > 0
    if not has_surgery:
        return ""

    parts = []
    if is_present_value(row.get("recent_surgery_1y", "")):
        parts.append("최근 1년 수술")
    elif is_present_value(row.get("recent_surgery_3y", "")):
        parts.append("최근 3년 수술")
    else:
        parts.append("수술 이력")

    recovery = display_value(row.get("surgery_recovery", ""))
    if recovery:
        parts.append(recovery)

    detail = display_value(row.get("surgery_detail", ""))
    if detail:
        parts.append(detail)

    return " ".join(parts[:3])


def unique_preserve_order(values: list[str]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        if value not in seen:
            seen.add(value)
            result.append(value)
    return result


def summarize_similar_case_support(case_prediction: str, selected) -> str:
    summaries = unique_preserve_order([
        summarize_case(row)
        for _, row in selected.iterrows()
        if str(row.get("label")) == case_prediction
    ])
    if not summaries:
        return ""

    return f"비슷한 {case_prediction} 사례에서는 {' / '.join(summaries[:2])} 조건이 주로 확인됐습니다."


def safe_int(value, default: int = 0) -> int:
    if value is None:
        return default
    if isinstance(value, (int, float, np.integer, np.floating)):
        try:
            if np.isnan(value):
                return default
        except TypeError:
            pass
        return int(value)

    text = str(value).strip()
    if not text:
        return default

    match = re.search(r"\d+(?:\.\d+)?", text.replace(",", " "))
    if not match:
        return default

    try:
        return int(float(match.group(0)))
    except (TypeError, ValueError):
        return default


def describe_input_reasons(row, final_prediction: str) -> str:
    disease_labels = [
        ("hypertension", "고혈압"),
        ("diabetes", "당뇨"),
        ("heart_disease", "심장질환"),
        ("joint_disease", "관절질환"),
        ("stroke", "뇌졸중"),
        ("kidney_disease", "신장질환"),
        ("lung_disease", "호흡기질환"),
        ("liver_disease", "간질환"),
        ("cancer", "암"),
        ("dementia", "치매"),
    ]
    severe_keys = {"heart_disease", "stroke", "kidney_disease", "lung_disease", "cancer", "dementia"}
    disease_names = [label for key, label in disease_labels if is_present_value(row.get(key, ""))]
    severe_names = [label for key, label in disease_labels if key in severe_keys and is_present_value(row.get(key, ""))]
    disease_count = len(disease_names)
    severe_count = len(severe_names)
    medicine_count = safe_int(row.get("medicine_count", 0))
    max_hours = safe_int(row.get("max_hours", 0))

    reasons = []
    if is_present_value(row.get("recent_fall", "")):
        reasons.append(f"최근 낙상 이력 {display_value(row.get('recent_fall'))}")
    if severe_count:
        reasons.append(f"중증 질환 {severe_count}개({', '.join(severe_names)})")
    elif disease_count:
        reasons.append(f"질환 {disease_count}개({', '.join(disease_names)})")
    elif final_prediction == "양호":
        reasons.append("주요 질환 없음")
    if medicine_count >= 3:
        reasons.append(f"복약 {medicine_count}개(복약 부담이 큰 상태)")
    elif final_prediction == "양호":
        reasons.append(f"복약 {medicine_count}개")
    if max_hours and max_hours <= 4:
        reasons.append(f"하루 활동 가능 시간 {max_hours}시간(짧은 활동 시간)")
    elif final_prediction == "양호" and max_hours:
        reasons.append(f"하루 활동 가능 시간 {max_hours}시간")
    if is_present_value(row.get("walking_limited", "")):
        reasons.append("보행 제한 있음")
    if is_present_value(row.get("fine_motor_limited", "")):
        reasons.append("손동작 제한 있음")
    if is_present_value(row.get("vision", "")):
        reasons.append(f"시력 {display_value(row.get('vision'), '저하')}")
    if is_present_value(row.get("hearing", "")):
        reasons.append(f"청력 {display_value(row.get('hearing'), '저하')}")
    if is_present_value(row.get("walking_aid", "")):
        reasons.append(f"보행 보조기구 {display_value(row.get('walking_aid'), '사용')}")
    surgery_summary = summarize_surgery(row)
    if surgery_summary:
        if is_present_value(row.get("recent_surgery_1y", "")):
            reasons.append(f"{surgery_summary}(최근 수술)")
        elif is_recovery_incomplete(row.get("surgery_recovery", "")):
            reasons.append(f"{surgery_summary}(회복 상태 확인 필요)")
        elif final_prediction == "양호":
            reasons.append(f"{surgery_summary}(회복된 수술 이력)")

    if reasons:
        joined = ", ".join(reasons[:6])
        if final_prediction == "양호":
            return (
                f"양호는 특정 항목 하나만 보고 결정한 결과가 아니라, 입력 조건을 종합했을 때 "
                f"{joined}으로 확인되어 주의나 위험으로 볼 만한 핵심 조건이 부족했기 때문입니다."
            )
        if len(reasons) == 1:
            return (
                f"{final_prediction}{label_subject_particle(final_prediction)} 나온 이유는 {joined} 하나만으로 단정한 것이 아니라, "
                f"이 입력 조건과 ML 예측 확률, 유사 사례의 공통 패턴을 함께 비교했기 때문입니다."
            )
        return (
            f"{final_prediction}{label_subject_particle(final_prediction)} 나온 이유는 특정 항목 하나만으로 결정한 것이 아니라, "
            f"입력 정보에서 {joined} 조건을 함께 고려했기 때문입니다. "
            f"따라서 같은 질환이 있어도 복약 수, 활동 시간, 감각/보행 제한 여부가 다르면 판정이 달라질 수 있습니다."
        )

    return (
        "양호는 특정 항목 하나만 보고 결정한 결과가 아니라, 최근 낙상, 주요 질환, "
        "복약 과다, 감각/보행 제한 같은 주요 위험 조건이 확인되지 않아 나온 결과입니다."
    )


def label_particle(label: str) -> str:
    return "로" if label in {"양호", "주의"} else "으로"


def label_subject_particle(label: str) -> str:
    return "가" if label in {"양호", "주의"} else "이"


def case_support_level(support_ratio: float) -> str:
    if support_ratio >= 0.8:
        return "강함"
    if support_ratio >= 0.6:
        return "보통"
    return "낮음"


def validate_with_similar_cases(
    input_feature_row: np.ndarray,
    input_row,
    ml_prediction: str,
    ml_probability: float,
    case_index,
    top_k: int,
):
    if case_index is None:
        return {
            "enabled": False,
            "decision": "SKIPPED",
            "message": "유사 사례 CSV를 찾을 수 없어 ML 예측만 사용했습니다.",
        }, ml_prediction

    top_k = max(1, int(top_k or 5))
    case_features = case_index["features"]
    distances = np.linalg.norm(case_features - input_feature_row, axis=1)
    top_indices = np.argsort(distances)[:top_k]
    selected = case_index["rows"].iloc[top_indices].copy()
    selected_distances = distances[top_indices]
    similarities = 1 / (1 + selected_distances)

    label_counts = selected["label"].value_counts()
    case_prediction = str(label_counts.index[0])
    agreeing_case_count = int(label_counts.iloc[0])
    support_ratio = agreeing_case_count / len(selected)
    support_level = case_support_level(support_ratio)
    support_text = f"상위 유사 사례 {len(selected)}건 중 {agreeing_case_count}건이 같은 판정을 보였습니다."
    agreed_with_model = case_prediction == ml_prediction
    similar_case_text = summarize_similar_case_support(case_prediction, selected)

    if agreed_with_model and support_ratio >= CASE_CONFIRM_THRESHOLD:
        decision = "CONFIRMED"
        final_prediction = ml_prediction
        reason_text = describe_input_reasons(input_row, final_prediction)
        message = f"최종 판정은 {final_prediction}입니다. {reason_text} {support_text} {similar_case_text} 이 비교 결과를 바탕으로 ML 예측을 최종 판정으로 유지했습니다."
    elif (not agreed_with_model) and support_ratio >= CASE_ADJUST_THRESHOLD and ml_probability < LOW_MODEL_CONFIDENCE_THRESHOLD:
        decision = "ADJUSTED_BY_SIMILAR_CASES"
        final_prediction = case_prediction
        reason_text = describe_input_reasons(input_row, final_prediction)
        message = (
            f"최종 판정은 {final_prediction}입니다. 처음 ML 예측은 {ml_prediction}였지만 확률이 높지 않았습니다. "
            f"{reason_text} {support_text} {similar_case_text} 그래서 유사 사례 방향을 참고해 최종 판정을 {case_prediction}{label_particle(case_prediction)} 보정했습니다."
        )
    else:
        decision = "REVIEW_REQUIRED" if not agreed_with_model else "CONFIRMED_LOW_SUPPORT"
        final_prediction = ml_prediction
        reason_text = describe_input_reasons(input_row, final_prediction)
        if agreed_with_model:
            message = f"최종 판정은 {final_prediction}입니다. {reason_text} 다만 {support_text} {similar_case_text} 참고 검토가 필요합니다."
        else:
            message = (
                f"최종 판정은 {final_prediction}입니다. {reason_text} "
                f"다만 ML 예측은 {ml_prediction}이고 유사 사례 다수는 {case_prediction}입니다. "
                f"{similar_case_text} 모델 판정을 유지하되 추가 검토가 필요합니다."
            )

    examples = []
    for (_, row), similarity in zip(selected.iterrows(), similarities):
        examples.append({
            "label": str(row["label"]),
            "similarity": round(float(similarity), 4),
            "summary": summarize_case(row),
        })

    return {
        "enabled": True,
        "decision": decision,
        "source": str(case_index["path"]),
        "mlPrediction": ml_prediction,
        "casePrediction": case_prediction,
        "finalPrediction": final_prediction,
        "modelProbability": round(float(ml_probability), 4),
        "supportLevel": support_level,
        "supportText": support_text,
        "averageSimilarity": round(float(np.mean(similarities)), 4),
        "similarCaseCount": int(len(selected)),
        "agreeingCaseCount": agreeing_case_count,
        "agreedWithModel": bool(agreed_with_model),
        "message": message,
        "examples": examples,
    }, final_prediction


def main() -> None:
    args = parse_args()
    artifacts_dir = Path(args.artifacts_dir)

    # ── 모델 로드 ─────────────────────────────────────────────────────────────
    stage1, stage2, feature_columns = load_models(artifacts_dir)

    # ── 입력 데이터 ───────────────────────────────────────────────────────────
    df       = load_rows(args.input)
    validate_columns(df, PREDICT_REQUIRED_COLUMNS)
    features = align_features(build_features(df), feature_columns)
    case_index = None if args.no_case_check else load_case_examples(args.case_examples, feature_columns)
    normalized_features = normalize_input_features(features, case_index) if case_index is not None else None

    # ── 캐스케이드 예측 ───────────────────────────────────────────────────────
    p1       = stage1.predict_proba(features)   # [P(양호), P(비양호)]
    p2       = stage2.predict_proba(features)   # [P(주의|비양호), P(위험|비양호)]
    proba3   = cascade_predict_proba(features, stage1, stage2)
    pred_idx = np.argmax(proba3, axis=1)

    # ── 결과 조립 ─────────────────────────────────────────────────────────────
    results = []
    for i in range(len(pred_idx)):
        ml_prediction = OUTPUT_CLASSES[pred_idx[i]]
        ml_probability = float(proba3[i, pred_idx[i]])
        case_validation = None
        final_prediction = ml_prediction
        if not args.no_case_check:
            feature_row = normalized_features[i] if normalized_features is not None else None
            case_validation, final_prediction = validate_with_similar_cases(
                feature_row,
                df.iloc[i],
                ml_prediction,
                ml_probability,
                case_index,
                args.case_top_k,
            )

        entry = {
            "prediction": final_prediction,
            "mlPrediction": ml_prediction,
            "probabilities": {
                "양호": round(float(proba3[i, 0]), 4),
                "주의": round(float(proba3[i, 1]), 4),
                "위험": round(float(proba3[i, 2]), 4),
            },
        }
        if case_validation is not None:
            entry["caseValidation"] = case_validation
        if args.verbose:
            entry["stage1"] = {
                "양호":   round(float(p1[i, 0]), 4),
                "비양호": round(float(p1[i, 1]), 4),
            }
            entry["stage2"] = {
                "주의": round(float(p2[i, 0]), 4),
                "위험": round(float(p2[i, 1]), 4),
            }
        results.append(entry)

    print(json.dumps({"predictions": results}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
