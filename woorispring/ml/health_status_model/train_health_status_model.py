"""
2단계 건강 상태 분류 학습 스크립트.

─────────────────────────────────────────────────────────────────
  1단계 (Stage 1): 양호 vs 비양호  (binary XGBoost)
  2단계 (Stage 2): 주의 vs 위험    (binary XGBoost, 비양호만 사용)
─────────────────────────────────────────────────────────────────

장점:
  - 위험군 탐지율 향상 (5% → 17% 비율로 집중 학습)
  - 각 단계가 단순한 이진 분류에만 집중
  - 오류 전파 최소화 (1단계에서 양호를 틀리는 비율이 이미 낮음)
"""

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedKFold, train_test_split
from sklearn.utils.class_weight import compute_sample_weight

try:
    from xgboost import XGBClassifier
    USING_XGB = True
except ImportError:
    from sklearn.ensemble import HistGradientBoostingClassifier
    USING_XGB = False
    print("[경고] xgboost 미설치 → HistGradientBoostingClassifier 로 대체합니다.")

from health_features import FEATURE_COLUMNS, build_features, load_rows, normalize_label, validate_columns
from health_features import REQUIRED_COLUMNS

# ── 라벨 상수 ─────────────────────────────────────────────────────────────────
OUTPUT_CLASSES = ["양호", "주의", "위험"]   # 최종 출력 3클래스
STAGE1_POS     = "비양호"                   # Stage 1: 1 = 비양호
STAGE2_POS     = "위험"                     # Stage 2: 1 = 위험


# ── XGBoost 모델 빌더 ─────────────────────────────────────────────────────────

def build_model(random_state: int = 42):
    if USING_XGB:
        return XGBClassifier(
            n_estimators=500,
            learning_rate=0.05,
            max_depth=6,
            subsample=0.8,
            colsample_bytree=0.8,
            min_child_weight=3,
            gamma=0.1,
            reg_alpha=0.1,
            reg_lambda=1.0,
            eval_metric="logloss",
            random_state=random_state,
            n_jobs=-1,
        )
    from sklearn.ensemble import HistGradientBoostingClassifier
    return HistGradientBoostingClassifier(
        max_iter=500, learning_rate=0.05, max_depth=6, random_state=random_state
    )


# ── 2단계 캐스케이드 예측 ─────────────────────────────────────────────────────

def cascade_predict_proba(x: pd.DataFrame, stage1, stage2) -> np.ndarray:
    """
    2단계 예측 → 3클래스 확률 행렬 (n, 3): [P(양호), P(주의), P(위험)]

    수식:
      P(양호) = Stage1.P(양호)
      P(주의) = Stage1.P(비양호) × Stage2.P(주의|비양호)
      P(위험) = Stage1.P(비양호) × Stage2.P(위험|비양호)
    """
    p1 = stage1.predict_proba(x)   # (n, 2): [P(양호), P(비양호)]
    p2 = stage2.predict_proba(x)   # (n, 2): [P(주의|비양호), P(위험|비양호)]

    p_healthy  = p1[:, 0]
    p_nothealthy = p1[:, 1]
    p_caution  = p_nothealthy * p2[:, 0]
    p_danger   = p_nothealthy * p2[:, 1]

    return np.stack([p_healthy, p_caution, p_danger], axis=1)


def cascade_predict(x: pd.DataFrame, stage1, stage2) -> np.ndarray:
    """최종 클래스 예측 (0=양호, 1=주의, 2=위험)"""
    proba = cascade_predict_proba(x, stage1, stage2)
    return np.argmax(proba, axis=1)


# ── 교차 검증 (수동 구현) ─────────────────────────────────────────────────────

def run_cascade_cv(
    x: pd.DataFrame,
    y_3class: np.ndarray,   # 0=양호, 1=주의, 2=위험
    y1: np.ndarray,          # 0=양호, 1=비양호
    y2_full: np.ndarray,     # 0=주의, 1=위험 (비양호 인덱스만 유효)
    n_splits: int,
    random_state: int,
) -> dict:
    skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=random_state)

    acc_list, f1_list = [], []
    s1_auc_list, s2_auc_list = [], []

    for fold, (train_idx, test_idx) in enumerate(skf.split(x, y_3class), 1):
        x_tr, x_te = x.iloc[train_idx], x.iloc[test_idx]
        y1_tr, y1_te = y1[train_idx], y1[test_idx]
        y3_te = y_3class[test_idx]

        # Stage 1 학습
        sw1 = compute_sample_weight("balanced", y1_tr)
        s1 = build_model(random_state)
        s1.fit(x_tr, y1_tr, sample_weight=sw1)

        # Stage 2 학습 (비양호만)
        nh_mask_tr = y1_tr == 1
        x_tr_nh = x_tr[nh_mask_tr]
        y2_tr_nh = y2_full[train_idx][nh_mask_tr]
        sw2 = compute_sample_weight("balanced", y2_tr_nh)
        s2 = build_model(random_state)
        s2.fit(x_tr_nh, y2_tr_nh, sample_weight=sw2)

        # 캐스케이드 예측
        pred3 = cascade_predict(x_te, s1, s2)
        proba3 = cascade_predict_proba(x_te, s1, s2)

        acc_list.append(accuracy_score(y3_te, pred3))
        f1_list.append(f1_score(y3_te, pred3, average="macro", zero_division=0))

        # Stage 1 AUC (이진)
        s1_prob = s1.predict_proba(x_te)[:, 1]
        s1_auc_list.append(roc_auc_score(y1_te, s1_prob))

        # Stage 2 AUC (비양호 테스트 샘플만)
        nh_mask_te = y1_te == 1
        if nh_mask_te.sum() >= 2 and len(np.unique(y2_full[test_idx][nh_mask_te])) > 1:
            s2_prob = s2.predict_proba(x_te[nh_mask_te])[:, 1]
            s2_auc_list.append(roc_auc_score(y2_full[test_idx][nh_mask_te], s2_prob))

        print(f"  Fold {fold}: Acc={acc_list[-1]:.4f}  MacroF1={f1_list[-1]:.4f}  "
              f"S1-AUC={s1_auc_list[-1]:.4f}")

    result = {
        "folds": n_splits,
        "cv_accuracy_mean":  round(float(np.mean(acc_list)), 4),
        "cv_accuracy_std":   round(float(np.std(acc_list)), 4),
        "cv_macro_f1_mean":  round(float(np.mean(f1_list)), 4),
        "cv_macro_f1_std":   round(float(np.std(f1_list)), 4),
        "cv_stage1_auc_mean": round(float(np.mean(s1_auc_list)), 4),
        "cv_stage2_auc_mean": round(float(np.mean(s2_auc_list)), 4) if s2_auc_list else None,
    }
    print(f"\n  CV Accuracy : {result['cv_accuracy_mean']:.4f} ± {result['cv_accuracy_std']:.4f}")
    print(f"  CV Macro F1 : {result['cv_macro_f1_mean']:.4f} ± {result['cv_macro_f1_std']:.4f}")
    print(f"  CV S1 AUC   : {result['cv_stage1_auc_mean']:.4f}")
    if result["cv_stage2_auc_mean"]:
        print(f"  CV S2 AUC   : {result['cv_stage2_auc_mean']:.4f}")
    return result


# ── 메인 ─────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="2단계 XGBoost 건강 상태 분류 (양호/비양호 → 주의/위험)"
    )
    parser.add_argument(
        "--input",
        default="data/nhanes_health_status_training.csv,data/klosa_multiwave_health_status_training.csv",
        help="학습 CSV 경로. 쉼표로 여러 파일 지정 가능",
    )
    parser.add_argument("--output-dir",   default="artifacts")
    parser.add_argument("--test-size",    type=float, default=0.2)
    parser.add_argument("--cv-folds",     type=int,   default=5)
    parser.add_argument("--random-state", type=int,   default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── 데이터 로드 ───────────────────────────────────────────────────────────
    frames = []
    for p in [Path(p.strip()) for p in args.input.split(",")]:
        print(f"  파일 로드: {p.name}")
        part = load_rows(p)
        validate_columns(part, REQUIRED_COLUMNS)
        frames.append(part)
    df = pd.concat(frames, ignore_index=True) if len(frames) > 1 else frames[0]

    y_raw = df["label"].map(normalize_label)
    x     = build_features(df)

    label_counts = y_raw.value_counts()
    print(f"\n[데이터] 총 {len(df):,}건")
    print(f"  라벨 분포: {label_counts.to_dict()}")

    # ── 라벨 변환 ─────────────────────────────────────────────────────────────
    # 3클래스 정수: 0=양호, 1=주의, 2=위험
    label_to_int = {"양호": 0, "주의": 1, "위험": 2}
    y_3class = y_raw.map(label_to_int).values

    # Stage 1: 양호(0) vs 비양호(1)
    y1 = (y_raw != "양호").astype(int).values

    # Stage 2: 주의(0) vs 위험(1) — 비양호 전체에 대해 미리 만들어둠
    y2_full = (y_raw == "위험").astype(int).values

    # ── 홀드아웃 분리 ─────────────────────────────────────────────────────────
    x_train, x_test, y3_train, y3_test, y1_train, y1_test, y2_train, y2_test = \
        train_test_split(
            x, y_3class, y1, y2_full,
            test_size=args.test_size,
            random_state=args.random_state,
            stratify=y_3class,
        )

    # ── Stratified K-Fold CV ──────────────────────────────────────────────────
    print(f"\n[교차 검증] Stratified {args.cv_folds}-Fold ...")
    cv_result = run_cascade_cv(
        x_train,
        y3_train,
        y1_train,
        y2_train,
        n_splits=args.cv_folds,
        random_state=args.random_state,
    )

    # ── 최종 모델 학습 ────────────────────────────────────────────────────────
    print(f"\n[최종 학습]")

    # Stage 1
    sw1 = compute_sample_weight("balanced", y1_train)
    stage1 = build_model(args.random_state)
    stage1.fit(x_train, y1_train, sample_weight=sw1)
    print(f"  Stage 1 학습 완료 (양호 vs 비양호, {len(y1_train):,}건)")

    # Stage 2 (비양호만)
    nh_mask = y1_train == 1
    x_train_nh = x_train[nh_mask]
    y2_train_nh = y2_train[nh_mask]
    sw2 = compute_sample_weight("balanced", y2_train_nh)
    stage2 = build_model(args.random_state)
    stage2.fit(x_train_nh, y2_train_nh, sample_weight=sw2)
    nonhealthy_counts = {
        "주의": int((y2_train_nh == 0).sum()),
        "위험": int((y2_train_nh == 1).sum()),
    }
    print(f"  Stage 2 학습 완료 (주의 vs 위험, {len(y2_train_nh):,}건: {nonhealthy_counts})")

    # ── 홀드아웃 평가 ─────────────────────────────────────────────────────────
    print(f"\n[홀드아웃 평가] {len(y3_test):,}건")

    pred3 = cascade_predict(x_test, stage1, stage2)
    proba3 = cascade_predict_proba(x_test, stage1, stage2)

    acc    = float(accuracy_score(y3_test, pred3))
    macro_f1 = float(f1_score(y3_test, pred3, average="macro", zero_division=0))

    # 3클래스 AUC-ROC
    try:
        auc3 = float(roc_auc_score(y3_test, proba3, multi_class="ovr", average="macro"))
    except Exception:
        auc3 = None

    # Stage 1 단독 AUC
    s1_prob_test = stage1.predict_proba(x_test)[:, 1]
    s1_auc = float(roc_auc_score(y1_test, s1_prob_test))

    # Stage 2 단독 AUC (비양호 테스트 샘플)
    nh_mask_te = y1_test == 1
    s2_auc = None
    if nh_mask_te.sum() >= 2:
        s2_prob_test = stage2.predict_proba(x_test[nh_mask_te])[:, 1]
        s2_auc = float(roc_auc_score(y2_test[nh_mask_te], s2_prob_test))

    cr = classification_report(
        y3_test, pred3,
        labels=[0, 1, 2],
        target_names=OUTPUT_CLASSES,
        zero_division=0,
        output_dict=True,
    )
    cm = confusion_matrix(y3_test, pred3, labels=[0, 1, 2]).tolist()

    print(f"  Accuracy    : {acc:.4f}")
    print(f"  Macro F1    : {macro_f1:.4f}")
    if auc3: print(f"  AUC-ROC     : {auc3:.4f}")
    print(f"  Stage1 AUC  : {s1_auc:.4f}")
    if s2_auc: print(f"  Stage2 AUC  : {s2_auc:.4f}")
    print(f"\n  분류 보고서:")
    for cls in OUTPUT_CLASSES:
        r = cr[cls]
        print(f"    {cls}: precision={r['precision']:.3f}  recall={r['recall']:.3f}  "
              f"f1={r['f1-score']:.3f}  support={int(r['support'])}")
    print(f"\n  혼동 행렬 (행=실제, 열=예측):")
    print(f"         양호  주의  위험")
    for label, row in zip(OUTPUT_CLASSES, cm):
        print(f"  {label}: {row}")

    # ── 피처 중요도 ───────────────────────────────────────────────────────────
    fi_cols = list(x_train.columns)

    def get_fi(model, prefix):
        imp = getattr(model, "feature_importances_", np.zeros(len(fi_cols)))
        return pd.DataFrame({"feature": fi_cols, f"importance_{prefix}": imp})

    fi1 = get_fi(stage1, "stage1")
    fi2 = get_fi(stage2, "stage2")
    fi = fi1.merge(fi2, on="feature")
    fi["importance_avg"] = (fi["importance_stage1"] + fi["importance_stage2"]) / 2
    fi = fi.sort_values("importance_avg", ascending=False).reset_index(drop=True)
    fi.to_csv(output_dir / "feature_importance.csv", index=False, encoding="utf-8-sig")

    print(f"\n  상위 피처 (평균 중요도):")
    for _, row in fi.head(8).iterrows():
        print(f"    {row['feature']:35s} avg={row['importance_avg']:.4f}  "
              f"S1={row['importance_stage1']:.4f}  S2={row['importance_stage2']:.4f}")

    # ── 저장 ─────────────────────────────────────────────────────────────────
    joblib.dump(stage1, output_dir / "stage1_model.joblib")
    joblib.dump(stage2, output_dir / "stage2_model.joblib")
    (output_dir / "feature_columns.json").write_text(
        json.dumps(fi_cols, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # 구버전 단일 모델 파일 삭제 (있으면)
    for old in ["health_status_model.joblib", "label_encoder.joblib"]:
        old_path = output_dir / old
        if old_path.exists():
            old_path.unlink()

    metrics = {
        "model":           "XGBoost (2-stage cascade)",
        "architecture":    "Stage1: 양호vs비양호 → Stage2: 주의vs위험",
        "labeling_method": "K-FRAIL (임상 척도 기반)",
        "total_rows":      int(len(df)),
        "train_rows":      int(len(x_train)),
        "test_rows":       int(len(x_test)),
        "feature_count":   int(len(fi_cols)),
        "label_distribution": {k: int(v) for k, v in label_counts.items()},
        "stage2_train_distribution": nonhealthy_counts,
        "cross_validation": cv_result,
        "holdout": {
            "accuracy":    round(acc, 4),
            "macro_f1":    round(macro_f1, 4),
            "auc_roc_3class": round(auc3, 4) if auc3 else None,
            "stage1_auc":  round(s1_auc, 4),
            "stage2_auc":  round(s2_auc, 4) if s2_auc else None,
            "classification_report": cr,
            "confusion_matrix": {"labels": OUTPUT_CLASSES, "matrix": cm},
        },
        "top_features": fi.head(10).to_dict(orient="records"),
    }
    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\n[저장 완료]")
    print(f"  Stage1: {output_dir / 'stage1_model.joblib'}")
    print(f"  Stage2: {output_dir / 'stage2_model.joblib'}")
    print(f"  지표  : {output_dir / 'metrics.json'}")

    print("\n" + json.dumps({
        "model": "XGBoost 2-stage",
        "total_rows": metrics["total_rows"],
        "cv_macro_f1": f"{cv_result['cv_macro_f1_mean']:.4f} ± {cv_result['cv_macro_f1_std']:.4f}",
        "cv_accuracy": f"{cv_result['cv_accuracy_mean']:.4f} ± {cv_result['cv_accuracy_std']:.4f}",
        "holdout_accuracy": round(acc, 4),
        "holdout_macro_f1": round(macro_f1, 4),
        "holdout_auc_roc":  round(auc3, 4) if auc3 else None,
        "stage1_auc": round(s1_auc, 4),
        "stage2_auc": round(s2_auc, 4) if s2_auc else None,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
