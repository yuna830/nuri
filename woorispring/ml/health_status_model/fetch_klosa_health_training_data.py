"""
KLoSA (Korean Longitudinal Study of Ageing) Wave 10 데이터 추출 파이프라인.

KLoSA w10 (2020년 조사, w10_20260413.dta)에서 K-FRAIL 임상 척도 기반
건강상태 라벨과 피처를 추출하여 NHANES 데이터셋과 동일한 스키마의 CSV를 생성합니다.

── K-FRAIL 컴포넌트 (KLoSA 프록시) ───────────────────────────────────────
  F  Fatigue      C209 ≥ 3  집안일 어려움 (피로/탈진 프록시)
  R  Resistance   C203 ≥ 3  목욕/샤워 어려움 (근력 저하 프록시)
  A  Ambulation   C212 ≥ 3  가까운 거리 외출 어려움 (보행능력 프록시)
  I  Illness      disease_count ≥ 5 (만성질환 5개 이상)
  L  Loss weight  C106 == 2  지난 1년 5kg 이상 체중 감소

  0점 → 양호 / 1~2점 → 주의 / 3~5점 → 위험

── 출력 컬럼 (NHANES fetch 스크립트와 동일 스키마) ──────────────────────
  label, kfrail_score, label_reason, data_source,
  person_id, age, gender, height, weight, medicine_count,
  hypertension, diabetes, heart_disease, joint_disease, stroke,
  kidney_disease, lung_disease, liver_disease, cancer, dementia,
  walking_limited, fine_motor_limited

실행:
  cd C:\\health_model\\health_status_model
  .venv\\Scripts\\python.exe fetch_klosa_health_training_data.py \\
      --input ..\\w10_20260413.dta \\
      --output data\\klosa_health_status_training.csv \\
      --min-age 60
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd


# ── 변수 매핑 상수 ────────────────────────────────────────────────────────────

# KLoSA 값 코딩: 1=예(있음), 5=아니오(없음), 음수=결측
YES_CODE  = 1
NO_CODE   = 5
MISSING   = {-9, -8, -1}

# ADL/IADL scale: 1=독립, 3=도움필요, 5=전혀못함 → ≥3 = 제한있음
ADL_LIMIT = 3

# 성별: w10gender1  1=남성, 5=여성
MALE_CODE = 1

# 체중변동 (C106): 1=증가, 2=감소, 3=없음?, 5=변동없음
WEIGHT_DECREASE = 2

# 질환 치료/증세 변수 (not-NaN = 질환 있음으로 판정)
DISEASE_MARKER_COLS = {
    "hypertension":  "w10C009",   # 현재 고혈압 약 복용/치료 여부
    "diabetes":      "w10C014",   # 현재 당뇨 치료 여부
    "heart_disease": "w10C035",   # 지난 기본조사 이후 심장질환 증세
    "stroke":        "w10C040",   # 지난 기본조사 이후 뇌혈관질환 증세
    "cancer":        "w10C020",   # 지난 기본조사 이후 암 증세
    "lung_disease":  "w10C025",   # 지난 기본조사 이후 만성폐질환 증세
    "liver_disease": "w10C030",   # 지난 기본조사 이후 간질환 증세
    "joint_disease": "w10C050",   # 지난 기본조사 이후 관절염 증세
    # kidney_disease: KLoSA w10에 직접 신장질환 진단변수 없음 → 0으로 채움
}


# ── 유틸리티 ─────────────────────────────────────────────────────────────────

def to_num(series: pd.Series) -> pd.Series:
    """숫자 변환, 비숫자→NaN."""
    return pd.to_numeric(series, errors="coerce")


def clean_num(series: pd.Series) -> pd.Series:
    """숫자 변환 후 결측 코드(-9/-8/-1) → NaN."""
    s = to_num(series)
    return s.where(~s.isin(MISSING), other=np.nan)


def adl_limited(series: pd.Series) -> pd.Series:
    """ADL/IADL 변수: 값 ≥ ADL_LIMIT(3) → 1(제한있음), 1 → 0, NaN → NaN."""
    s = clean_num(series)
    return (s >= ADL_LIMIT).astype("Int8")


def disease_flag_from_marker(df: pd.DataFrame, col: str) -> pd.Series:
    """
    라우팅 구조 질환 플래그:
      - col이 DataFrame에 있고 값이 non-NaN  → 1 (질환 있음)
      - col이 없거나 NaN                     → 0 (질환 없음)
    """
    if col not in df.columns:
        return pd.Series(0, index=df.index, dtype="Int8")
    s = to_num(df[col])
    return s.notna().astype("Int8")


# ── K-FRAIL 라벨 계산 ─────────────────────────────────────────────────────────

def compute_kfrail_klosa(row: pd.Series) -> dict:
    """
    KLoSA 변수로 K-FRAIL 5개 컴포넌트 점수 계산.
    반환: {score, label, reason}
    """
    score = 0
    components = []

    # F Fatigue: C209(집안일) ≥ 3
    c209 = row.get("_c209", np.nan)
    if not (c209 != c209) and c209 >= ADL_LIMIT:
        score += 1
        components.append("F-fatigue")

    # R Resistance: C203(목욕/샤워) ≥ 3
    c203 = row.get("_c203", np.nan)
    if not (c203 != c203) and c203 >= ADL_LIMIT:
        score += 1
        components.append("R-resistance")

    # A Ambulation: C212(가까운 거리 외출) ≥ 3
    c212 = row.get("_c212", np.nan)
    if not (c212 != c212) and c212 >= ADL_LIMIT:
        score += 1
        components.append("A-ambulation")

    # I Illness: disease_count ≥ 3
    # KLoSA는 신장질환 변수 없이 최대 9개 범주 (NHANES ≥5/10과 비례해 ≥3/9 사용)
    disease_count = row.get("disease_count", 0)
    if disease_count >= 3:
        score += 1
        components.append("I-illness")

    # L Loss of weight: C106 == 2 (5kg 이상 체중 감소)
    c106 = row.get("_c106", np.nan)
    if not (c106 != c106) and c106 == WEIGHT_DECREASE:
        score += 1
        components.append("L-weight_loss")

    if score == 0:
        label, reason = "양호", "K-FRAIL=0"
    elif score <= 2:
        label, reason = "주의", f"K-FRAIL={score}({'+'.join(components)})"
    else:
        label, reason = "위험", f"K-FRAIL={score}({'+'.join(components)})"

    return {"kfrail_score": score, "label": label, "label_reason": reason}


# ── 메인 데이터 추출 ──────────────────────────────────────────────────────────

def extract(
    dta_path: Path,
    min_age: int = 60,
) -> pd.DataFrame:
    """KLoSA .dta 파일에서 피처+라벨 추출."""

    print(f"\n[1/4] 로드: {dta_path.name} ...")
    raw = pd.read_stata(dta_path, convert_categoricals=False)
    print(f"      원본 행={len(raw):,}  열={len(raw.columns):,}")

    df = raw.copy()

    # ── 나이 필터 ─────────────────────────────────────────────────────────────
    print(f"\n[2/4] 나이({min_age}세 이상) 필터 및 기본 변수 처리 ...")

    df["age"] = clean_num(df.get("w10A002_age", pd.Series(dtype=float)))
    before = len(df)
    df = df[df["age"].notna() & (df["age"] >= min_age)].copy()
    print(f"      나이 필터 후: {len(df):,}명 (제거 {before - len(df):,}명)")

    # ── 기본 변수 ─────────────────────────────────────────────────────────────

    # 성별: gender1  1=남 5=여 → flag 1=남
    df["gender"] = (clean_num(df["w10gender1"]) == MALE_CODE).astype("Int8")
    df["gender_str"] = df["gender"].map({1: "남성", 0: "여성"})

    # 키/몸무게 (w10 버전에만 있음: C105=체중, C107=신장)
    df["weight"] = clean_num(df.get("w10C105", pd.Series(dtype=float)))
    df["height"] = clean_num(df.get("w10C107", pd.Series(dtype=float)))

    # 신장 이상치 제거 (100cm 미만 또는 220cm 초과)
    df["height"] = df["height"].where(
        df["height"].between(100, 220), other=np.nan
    )
    # 체중 이상치 제거 (20kg 미만 또는 200kg 초과)
    df["weight"] = df["weight"].where(
        df["weight"].between(20, 200), other=np.nan
    )

    # ── K-FRAIL 컴포넌트용 임시 컬럼 ────────────────────────────────────────
    df["_c203"] = clean_num(df.get("w10C203", pd.Series(dtype=float)))  # 목욕
    df["_c209"] = clean_num(df.get("w10C209", pd.Series(dtype=float)))  # 집안일
    df["_c212"] = clean_num(df.get("w10C212", pd.Series(dtype=float)))  # 외출
    df["_c106"] = clean_num(df.get("w10C106", pd.Series(dtype=float)))  # 체중변동

    # ── 질환 플래그 ───────────────────────────────────────────────────────────
    print("\n[3/4] 질환 플래그 및 disease_count 계산 ...")

    for feat, col in DISEASE_MARKER_COLS.items():
        df[feat] = disease_flag_from_marker(df, col)

    # 치매: Cadd_01  1=예, 3=모름, 5=아니오
    cadd = clean_num(df.get("w10Cadd_01", pd.Series(dtype=float)))
    df["dementia"] = (cadd == YES_CODE).astype("Int8")

    # 신장질환: 직접 변수 없음 → 0
    df["kidney_disease"] = pd.Series(0, index=df.index, dtype="Int8")

    # 만성질환 수 (K-FRAIL I 컴포넌트)
    disease_cols = [
        "hypertension", "diabetes", "heart_disease", "joint_disease",
        "stroke", "kidney_disease", "lung_disease", "liver_disease",
        "cancer", "dementia",
    ]
    df["disease_count"] = df[disease_cols].sum(axis=1, numeric_only=True)

    # ── 기능 제한 피처 ────────────────────────────────────────────────────────
    # ⚠️ 순환 방지: K-FRAIL 라벨에 사용한 변수(C203, C209, C212, C106)는
    #              피처에서 반드시 제외합니다.
    #
    # walking_limited: C205(침대에서 일어나 방 밖으로 나가기) ≥ 3
    #   → NHANES PFQ061H(같은 층 방 사이 걷기) 대응
    #   → C212(가까운 외출)는 K-FRAIL A 컴포넌트와 동일하므로 사용 금지
    df["walking_limited"] = adl_limited(df.get("w10C205", pd.Series(dtype=float)))

    # fine_motor_limited: C208(몸단장하기) ≥ 3
    #   → NHANES PFQ061K(포크/칼 사용) 대응
    #   → C204(식사하기)도 가능하지만 C208이 더 세밀한 운동기능 반영
    df["fine_motor_limited"] = adl_limited(df.get("w10C208", pd.Series(dtype=float)))

    # ── medicine_count 프록시 ─────────────────────────────────────────────────
    # KLoSA에 직접 복약 종류 수 없음 → 현재 치료 중인 질환 수로 대체
    # C009=1(고혈압), C014=1(당뇨), C036=1(심장), C041=1(뇌혈관),
    # C026=1(폐), C031=1(간), C051=1(관절), C046=1(정신과)
    treatment_cols_map = {
        "w10C009": "hypertension",    # 고혈압 약
        "w10C014": "diabetes",        # 당뇨 치료
        "w10C036": "heart_disease",   # 심장 약
        "w10C041": "stroke",          # 뇌혈관 약
        "w10C026": "lung_disease",    # 폐 약
        "w10C031": "liver_disease",   # 간 약
        "w10C051": "joint_disease",   # 관절 약
        "w10C046": "dementia_psych",  # 정신과 약
    }
    treat_flags = []
    for col, _ in treatment_cols_map.items():
        if col in df.columns:
            treated = (clean_num(df[col]) == YES_CODE).astype("Int8")
            treat_flags.append(treated)
    if treat_flags:
        df["medicine_count"] = pd.concat(treat_flags, axis=1).sum(axis=1)
    else:
        df["medicine_count"] = 0

    # ── K-FRAIL 라벨 계산 ────────────────────────────────────────────────────
    print("\n[4/4] K-FRAIL 라벨 계산 ...")

    kfrail_results = df.apply(compute_kfrail_klosa, axis=1, result_type="expand")
    df["kfrail_score"]  = kfrail_results["kfrail_score"]
    df["label"]         = kfrail_results["label"]
    df["label_reason"]  = kfrail_results["label_reason"]
    df["data_source"]   = "KLoSA-w10"

    # ── 결측치 제거: 라벨 필수 컬럼 ─────────────────────────────────────────
    required_for_label = ["_c209", "_c212", "_c203"]
    df_valid = df.dropna(subset=["age"]).copy()

    # ── 최종 컬럼 선택 ────────────────────────────────────────────────────────
    output_cols = [
        "label", "kfrail_score", "label_reason", "data_source",
        "person_id",
        "age", "gender_str", "height", "weight", "medicine_count",
        "hypertension", "diabetes", "heart_disease", "joint_disease",
        "stroke", "kidney_disease", "lung_disease", "liver_disease",
        "cancer", "dementia",
        "walking_limited", "fine_motor_limited",
    ]

    # person_id: 고유 ID 컬럼 탐색
    for id_col in ["w10pid", "pid", "hhid", "id"]:
        if id_col in df_valid.columns:
            df_valid["person_id"] = df_valid[id_col].astype(str)
            break
    else:
        df_valid["person_id"] = ["klosa_" + str(i) for i in range(len(df_valid))]

    # gender를 문자열 컬럼으로 교체
    df_valid = df_valid.rename(columns={"gender_str": "gender_str_final"})
    output_cols_clean = [c for c in output_cols if c in df_valid.columns or c == "gender_str"]
    # gender_str로 교체
    df_out = df_valid[
        [c for c in output_cols if c != "gender_str"] + ["gender_str_final"]
    ].copy()
    df_out = df_out.rename(columns={"gender_str_final": "gender"})

    # 라벨 없는 행 제거 (K-FRAIL 컴포넌트 3개 이상 결측)
    df_out = df_out[df_out["label"].notna()].copy()

    return df_out


# ── 리포트 ────────────────────────────────────────────────────────────────────

def report(df: pd.DataFrame) -> None:
    print("\n" + "=" * 60)
    print("KLoSA 추출 결과 요약")
    print("=" * 60)
    print(f"  총 행: {len(df):,}")

    print("\n  라벨 분포:")
    label_counts = df["label"].value_counts()
    for lbl, cnt in label_counts.items():
        print(f"    {lbl}: {cnt:,}  ({cnt/len(df)*100:.1f}%)")

    print("\n  K-FRAIL 점수 분포:")
    for s, cnt in df["kfrail_score"].value_counts().sort_index().items():
        print(f"    {s}점: {cnt:,}  ({cnt/len(df)*100:.1f}%)")

    print("\n  질환 유병률:")
    disease_cols = [
        "hypertension", "diabetes", "heart_disease", "joint_disease",
        "stroke", "kidney_disease", "lung_disease", "liver_disease",
        "cancer", "dementia",
    ]
    for col in disease_cols:
        if col in df.columns:
            n = pd.to_numeric(df[col], errors="coerce").sum()
            pct = n / len(df) * 100
            print(f"    {col:<20s}: {n:,.0f}  ({pct:.1f}%)")

    print("\n  기능 제한:")
    print(f"    walking_limited     : {pd.to_numeric(df['walking_limited'], errors='coerce').sum():,.0f}")
    print(f"    fine_motor_limited  : {pd.to_numeric(df['fine_motor_limited'], errors='coerce').sum():,.0f}")

    print("\n  medicine_count 분포:")
    mc = pd.to_numeric(df["medicine_count"], errors="coerce")
    print(f"    0개: {(mc==0).sum():,}  1개: {(mc==1).sum():,}  2개: {(mc==2).sum():,}  3+개: {(mc>=3).sum():,}")

    print("\n  나이 통계:")
    age = pd.to_numeric(df["age"], errors="coerce")
    print(f"    min={age.min():.0f}  max={age.max():.0f}  mean={age.mean():.1f}")

    if "height" in df.columns:
        h = pd.to_numeric(df["height"], errors="coerce").dropna()
        print(f"\n  신장: n={len(h):,}  mean={h.mean():.1f}cm  범위=[{h.min():.0f},{h.max():.0f}]")
    if "weight" in df.columns:
        w = pd.to_numeric(df["weight"], errors="coerce").dropna()
        print(f"  체중: n={len(w):,}  mean={w.mean():.1f}kg  범위=[{w.min():.0f},{w.max():.0f}]")

    print("=" * 60)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description="KLoSA w10 → K-FRAIL 라벨 + 피처 CSV"
    )
    ap.add_argument(
        "--input",
        default=str(Path(__file__).parent.parent / "w10_20260413.dta"),
        help="KLoSA .dta 파일 경로",
    )
    ap.add_argument(
        "--output",
        default="data/klosa_health_status_training.csv",
        help="출력 CSV 경로",
    )
    ap.add_argument("--min-age", type=int, default=60, help="최소 나이 필터 (기본 60)")
    args = ap.parse_args()

    dta_path = Path(args.input)
    if not dta_path.exists():
        print(f"[오류] 파일 없음: {dta_path}")
        sys.exit(1)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df = extract(dta_path, min_age=args.min_age)
    report(df)

    df.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"\n저장 완료: {out_path}  ({len(df):,}행)")


if __name__ == "__main__":
    main()
