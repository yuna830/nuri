"""
KLoSA 멀티 웨이브 건강 데이터 추출 파이프라인.

w08 / w09 / w10 세 차수를 합산하여 학습 데이터를 확장합니다.

── 패널 중복 처리 ─────────────────────────────────────────────────────────
  KLoSA는 같은 사람을 여러 차수에 걸쳐 추적하는 패널 연구입니다.
  동일인이 w08, w09, w10에 모두 등장할 수 있어, 그냥 합치면 train/test 누수 발생.
  → 해결: pid 기준으로 중복 제거. 같은 사람은 "최신 차수"만 유지합니다.
    (w09보다 w10, w08보다 w09를 우선)

── 실행 예시 ─────────────────────────────────────────────────────────────
  cd C:\\health_model\\health_status_model
  .venv\\Scripts\\python.exe fetch_klosa_multiwave_health_training_data.py \\
      --input "..\\w08_20260413.dta,..\\w09_20260413.dta,..\\w10_20260413.dta" \\
      --output data\\klosa_multiwave_health_status_training.csv
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# ── 공통 상수 ─────────────────────────────────────────────────────────────────
YES_CODE       = 1
ADL_LIMIT      = 3
MALE_CODE      = 1
WEIGHT_DECREASE = 2
MISSING        = {-9, -8, -1}

# 웨이브 번호 → 정렬 우선순위 (높을수록 최신)
WAVE_PRIORITY = {"w08": 1, "w09": 2, "w10": 3}


# ── 유틸 ─────────────────────────────────────────────────────────────────────

def to_num(s: pd.Series) -> pd.Series:
    return pd.to_numeric(s, errors="coerce")

def clean_num(s: pd.Series) -> pd.Series:
    v = to_num(s)
    return v.where(~v.isin(MISSING), other=np.nan)

def adl_limited(s: pd.Series) -> pd.Series:
    return (clean_num(s) >= ADL_LIMIT).astype("Int8")

def disease_flag(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df.columns:
        return pd.Series(0, index=df.index, dtype="Int8")
    return to_num(df[col]).notna().astype("Int8")

def get_col(df: pd.DataFrame, col: str) -> pd.Series:
    """컬럼이 없으면 NaN 시리즈 반환."""
    return df[col] if col in df.columns else pd.Series(np.nan, index=df.index)


# ── 웨이브 접두어 자동 감지 ───────────────────────────────────────────────────

def detect_prefix(columns: list[str]) -> str:
    """
    변수명에서 웨이브 접두어(w08/w09/w10)를 자동으로 감지합니다.
    e.g. 'w09C009' → 'w09'
    """
    for prefix in ["w10", "w09", "w08", "w07", "w06"]:
        if any(c.startswith(prefix + "C") for c in columns):
            return prefix
    raise ValueError(f"알 수 없는 웨이브 접두어. 컬럼 예시: {columns[:10]}")


# ── K-FRAIL 라벨 계산 ────────────────────────────────────────────────────────

def compute_kfrail(row: pd.Series) -> dict:
    score, components = 0, []

    c209 = row.get("_c209", np.nan)
    if not (c209 != c209) and c209 >= ADL_LIMIT:
        score += 1; components.append("F")

    c203 = row.get("_c203", np.nan)
    if not (c203 != c203) and c203 >= ADL_LIMIT:
        score += 1; components.append("R")

    c212 = row.get("_c212", np.nan)
    if not (c212 != c212) and c212 >= ADL_LIMIT:
        score += 1; components.append("A")

    if row.get("disease_count", 0) >= 3:
        score += 1; components.append("I")

    c106 = row.get("_c106", np.nan)
    if not (c106 != c106) and c106 == WEIGHT_DECREASE:
        score += 1; components.append("L")

    if score == 0:
        label, reason = "양호", "K-FRAIL=0"
    elif score <= 2:
        label, reason = "주의", "K-FRAIL={}({})".format(score, '+'.join(components))
    else:
        label, reason = "위험", "K-FRAIL={}({})".format(score, '+'.join(components))

    return {"kfrail_score": score, "label": label, "label_reason": reason}


# ── 단일 웨이브 추출 ─────────────────────────────────────────────────────────

def extract_wave(dta_path: Path, min_age: int = 60) -> pd.DataFrame:
    print(f"\n  로드: {dta_path.name} ...", end=" ", flush=True)
    raw = pd.read_stata(dta_path, convert_categoricals=False)
    print(f"{len(raw):,}행 × {len(raw.columns):,}열")

    df  = raw.copy()
    px  = detect_prefix(list(df.columns))   # e.g. 'w09'
    wave_num = px  # 'w08' / 'w09' / 'w10'

    # ── 나이 ─────────────────────────────────────────────────────────────────
    age_col = f"{px}A002_age"
    df["age"] = clean_num(get_col(df, age_col))
    df = df[df["age"].notna() & (df["age"] >= min_age)].copy()

    # ── 성별 ─────────────────────────────────────────────────────────────────
    gender_col = f"{px}gender1"
    df["gender"] = (clean_num(get_col(df, gender_col)) == MALE_CODE).astype("Int8")
    df["gender"] = df["gender"].map({1: "남성", 0: "여성"})

    # ── 신체 ─────────────────────────────────────────────────────────────────
    # C105=체중(kg), C107=신장(cm)
    df["weight"] = clean_num(get_col(df, f"{px}C105")).where(
        clean_num(get_col(df, f"{px}C105")).between(20, 200), np.nan)
    df["height"] = clean_num(get_col(df, f"{px}C107")).where(
        clean_num(get_col(df, f"{px}C107")).between(100, 220), np.nan)

    # ── 질환 플래그 ───────────────────────────────────────────────────────────
    disease_map = {
        "hypertension":  f"{px}C009",
        "diabetes":      f"{px}C014",
        "heart_disease": f"{px}C035",
        "stroke":        f"{px}C040",
        "cancer":        f"{px}C020",
        "lung_disease":  f"{px}C025",
        "liver_disease": f"{px}C030",
        "joint_disease": f"{px}C050",
    }
    for feat, col in disease_map.items():
        df[feat] = disease_flag(df, col)

    # 치매: Cadd_01  1=예
    cadd_col = f"{px}Cadd_01"
    df["dementia"] = (clean_num(get_col(df, cadd_col)) == YES_CODE).astype("Int8")

    # 신장질환: KLoSA에 직접 변수 없음 → 0
    df["kidney_disease"] = pd.Series(0, index=df.index, dtype="Int8")

    disease_cols = [
        "hypertension", "diabetes", "heart_disease", "joint_disease",
        "stroke", "kidney_disease", "lung_disease", "liver_disease",
        "cancer", "dementia",
    ]
    df["disease_count"] = df[disease_cols].sum(axis=1, numeric_only=True)

    # ── K-FRAIL 컴포넌트용 임시 컬럼 ─────────────────────────────────────────
    df["_c203"] = clean_num(get_col(df, f"{px}C203"))   # 목욕 (R)
    df["_c209"] = clean_num(get_col(df, f"{px}C209"))   # 집안일 (F)
    df["_c212"] = clean_num(get_col(df, f"{px}C212"))   # 외출 (A)
    df["_c106"] = clean_num(get_col(df, f"{px}C106"))   # 체중변동 (L)

    # ── 기능 제한 피처 (K-FRAIL 라벨 변수와 다른 항목) ───────────────────────
    df["walking_limited"]    = adl_limited(get_col(df, f"{px}C205"))  # 이동 (C205)
    df["fine_motor_limited"] = adl_limited(get_col(df, f"{px}C208"))  # 몸단장 (C208)

    # ── 복약 수 프록시 (치료 중인 질환 수) ───────────────────────────────────
    treat_cols = [
        f"{px}C009",   # 고혈압 치료
        f"{px}C014",   # 당뇨 치료
        f"{px}C036",   # 심장 치료
        f"{px}C041",   # 뇌혈관 치료
        f"{px}C026",   # 폐질환 치료
        f"{px}C031",   # 간질환 치료
        f"{px}C051",   # 관절 치료
        f"{px}C046",   # 정신과 치료
    ]
    flags = []
    for col in treat_cols:
        if col in df.columns:
            flags.append((clean_num(df[col]) == YES_CODE).astype("Int8"))
    df["medicine_count"] = pd.concat(flags, axis=1).sum(axis=1) if flags else 0

    # ── K-FRAIL 라벨 ─────────────────────────────────────────────────────────
    kf = df.apply(compute_kfrail, axis=1, result_type="expand")
    df["kfrail_score"] = kf["kfrail_score"]
    df["label"]        = kf["label"]
    df["label_reason"] = kf["label_reason"]
    df["data_source"]  = f"KLoSA-{wave_num}"
    df["wave_priority"]= WAVE_PRIORITY.get(wave_num, 0)

    # ── person_id ─────────────────────────────────────────────────────────────
    for id_col in ["pid", f"{px}pid", "hhid", "id"]:
        if id_col in df.columns:
            df["person_id"] = df[id_col].astype(str)
            break
    else:
        df["person_id"] = [f"{wave_num}_{i}" for i in range(len(df))]

    # ── 출력 컬럼 ─────────────────────────────────────────────────────────────
    out_cols = [
        "person_id", "wave_priority", "data_source",
        "label", "kfrail_score", "label_reason",
        "age", "gender", "height", "weight", "medicine_count",
        "hypertension", "diabetes", "heart_disease", "joint_disease",
        "stroke", "kidney_disease", "lung_disease", "liver_disease",
        "cancer", "dementia",
        "walking_limited", "fine_motor_limited",
    ]
    available = [c for c in out_cols if c in df.columns]
    df_out = df[available].dropna(subset=["label"]).copy()

    print(f"  → {wave_num}: {len(df_out):,}명 추출 "
          f"(양호 {(df_out['label']=='양호').sum():,} / "
          f"주의 {(df_out['label']=='주의').sum():,} / "
          f"위험 {(df_out['label']=='위험').sum():,})")
    return df_out


# ── 중복 제거 (최신 웨이브 우선) ─────────────────────────────────────────────

def deduplicate_by_person(df: pd.DataFrame) -> pd.DataFrame:
    """
    동일 pid 중 wave_priority가 높은(최신) 것만 유지.
    pid가 없거나 신뢰할 수 없으면 전체 보존.
    """
    if "person_id" not in df.columns:
        return df

    before = len(df)
    df_sorted = df.sort_values("wave_priority", ascending=False)
    df_dedup  = df_sorted.drop_duplicates(subset=["person_id"], keep="first")
    removed   = before - len(df_dedup)
    print(f"\n  중복 제거: {before:,}행 → {len(df_dedup):,}행 (동일인 {removed:,}명 중복 제거)")
    return df_dedup.drop(columns=["wave_priority"])


# ── 리포트 ────────────────────────────────────────────────────────────────────

def report(df: pd.DataFrame) -> None:
    print("\n" + "=" * 60)
    print("KLoSA 멀티웨이브 추출 결과")
    print("=" * 60)
    print(f"  총 행: {len(df):,}")

    print("\n  웨이브별 분포:")
    for src, cnt in df["data_source"].value_counts().sort_index().items():
        print(f"    {src}: {cnt:,}")

    print("\n  라벨 분포:")
    for lbl, cnt in df["label"].value_counts().items():
        print(f"    {lbl}: {cnt:,}  ({cnt/len(df)*100:.1f}%)")

    print("\n  K-FRAIL 점수:")
    for s, cnt in df["kfrail_score"].value_counts().sort_index().items():
        print(f"    {s}점: {cnt:,}  ({cnt/len(df)*100:.1f}%)")

    print("\n  나이 통계:")
    age = pd.to_numeric(df["age"], errors="coerce")
    print(f"    min={age.min():.0f}  max={age.max():.0f}  mean={age.mean():.1f}")
    print("=" * 60)


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    ap = argparse.ArgumentParser(
        description="KLoSA 멀티웨이브 (w08/w09/w10) → K-FRAIL 라벨 + 피처 CSV"
    )
    ap.add_argument(
        "--input",
        default=",".join([
            str(Path(__file__).parent.parent / f"{w}_20260413.dta")
            for w in ["w08", "w09", "w10"]
        ]),
        help="KLoSA .dta 파일 경로 목록 (쉼표 구분, 오래된 → 최신 순서)",
    )
    ap.add_argument(
        "--output",
        default="data/klosa_multiwave_health_status_training.csv",
        help="출력 CSV 경로",
    )
    ap.add_argument("--min-age", type=int, default=60)
    ap.add_argument(
        "--no-dedup",
        action="store_true",
        help="pid 중복 제거 건너뜀 (pid를 신뢰할 수 없는 경우)",
    )
    args = ap.parse_args()

    paths = [Path(p.strip()) for p in args.input.split(",")]
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        print(f"[오류] 파일 없음:\n  " + "\n  ".join(missing))
        sys.exit(1)

    print(f"\n[KLoSA 멀티웨이브 추출]")
    print(f"  웨이브 파일: {[p.name for p in paths]}")

    frames = []
    for p in paths:
        try:
            frames.append(extract_wave(p, min_age=args.min_age))
        except Exception as e:
            print(f"  [경고] {p.name} 추출 실패: {e}")

    if not frames:
        print("[오류] 추출된 데이터 없음.")
        sys.exit(1)

    combined = pd.concat(frames, ignore_index=True)
    print(f"\n  합산: {len(combined):,}행")

    if not args.no_dedup:
        combined = deduplicate_by_person(combined)

    report(combined)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(out_path, index=False, encoding="utf-8-sig")
    print(f"\n저장 완료: {out_path}  ({len(combined):,}행)")


if __name__ == "__main__":
    main()
