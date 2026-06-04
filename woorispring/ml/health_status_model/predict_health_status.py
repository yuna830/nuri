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
from pathlib import Path

import joblib
import numpy as np

from health_features import PREDICT_REQUIRED_COLUMNS, align_features, build_features, load_rows, validate_columns

OUTPUT_CLASSES = ["양호", "주의", "위험"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="2-stage health status prediction.")
    parser.add_argument("--input",           required=True, help="예측할 CSV 또는 JSON 파일")
    parser.add_argument("--artifacts-dir",   default="artifacts", help="모델 파일 디렉토리")
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


def main() -> None:
    args = parse_args()
    artifacts_dir = Path(args.artifacts_dir)

    # ── 모델 로드 ─────────────────────────────────────────────────────────────
    stage1, stage2, feature_columns = load_models(artifacts_dir)

    # ── 입력 데이터 ───────────────────────────────────────────────────────────
    df       = load_rows(args.input)
    validate_columns(df, PREDICT_REQUIRED_COLUMNS)
    features = align_features(build_features(df), feature_columns)

    # ── 캐스케이드 예측 ───────────────────────────────────────────────────────
    p1       = stage1.predict_proba(features)   # [P(양호), P(비양호)]
    p2       = stage2.predict_proba(features)   # [P(주의|비양호), P(위험|비양호)]
    proba3   = cascade_predict_proba(features, stage1, stage2)
    pred_idx = np.argmax(proba3, axis=1)

    # ── 결과 조립 ─────────────────────────────────────────────────────────────
    results = []
    for i in range(len(pred_idx)):
        entry = {
            "prediction": OUTPUT_CLASSES[pred_idx[i]],
            "probabilities": {
                "양호": round(float(proba3[i, 0]), 4),
                "주의": round(float(proba3[i, 1]), 4),
                "위험": round(float(proba3[i, 2]), 4),
            },
        }
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
