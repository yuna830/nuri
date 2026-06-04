# 건강 상태 예측 모델 인수인계 문서

> 작성일: 2026-05-29  
> 대상: 팀원 인수인계용  
> 모델 버전: **v5 (멀티웨이브 KLoSA + 2단계 캐스케이드 XGBoost)**

---

## 1. 이 모델이 하는 일

노인의 기본 건강 정보(질환 여부, 나이, 체형, 복약 수 등)를 입력받아  
**양호 / 주의 / 위험** 세 단계 중 하나로 건강 상태를 분류합니다.

Spring Boot 서비스에서 JSON을 Python 스크립트로 넘기면 예측 결과를 돌려주는 구조입니다.

---

## 2. 버전 히스토리 (무엇을 왜 바꿨는가)

| 버전 | 주요 변경 | 결과 |
|---|---|---|
| v1/v2 | 초기 단일 모델 | 정확도 100% → 라벨 순환(누수) 문제 |
| v3 | NHANES 단독, 피처 정비 | CV Accuracy 75.2%, Macro F1 0.591 |
| v4 | KLoSA w10 추가, 2단계 캐스케이드 | Macro F1 0.704, 위험 F1 61% |
| **v5** | **KLoSA w08+w09 추가 (멀티웨이브)** | **Macro F1 0.745, 위험 F1 73%** |

---

## 3. 디렉토리 구조

```
C:\health_model\health_status_model\
│
├── health_features.py                          ★ 피처 엔지니어링 모듈 (공통)
├── train_health_status_model.py                ★ 학습 스크립트
├── predict_health_status.py                    ★ 예측 스크립트 (서비스에서 호출)
├── fetch_nhanes_health_training_data.py           NHANES 데이터 수집
├── fetch_klosa_health_training_data.py            KLoSA w10 단독 추출 (구버전 참고용)
├── fetch_klosa_multiwave_health_training_data.py  KLoSA w08+w09+w10 멀티웨이브 추출 ★NEW
│
├── data/
│   ├── nhanes_health_status_training.csv          NHANES 학습 데이터 (2,150건)
│   ├── klosa_health_status_training.csv           KLoSA w10 단독 (5,562건) ← 구버전
│   ├── klosa_multiwave_health_status_training.csv KLoSA 멀티웨이브 (6,691건) ★현재 사용
│   └── predict_sample.json                        예측 입력 예시
│
├── artifacts/                        ★ 학습 결과물 (서비스에서 이 폴더를 참조)
│   ├── stage1_model.joblib           Stage 1 모델 (양호 vs 비양호)
│   ├── stage2_model.joblib           Stage 2 모델 (주의 vs 위험)
│   ├── feature_columns.json          피처 컬럼 목록 (26개)
│   ├── metrics.json                  성능 지표 전체
│   └── feature_importance.csv        피처 중요도
│
└── requirements.txt
```

---

## 4. 변경 이력 (수정한 것들 전체)

### 4-1. 데이터 누수(Data Leakage) 수정

**왜 했나?**  
이전 버전에서 `walking_limited` 피처가 C212(가까운 외출)를 사용하고 있었는데,  
C212는 K-FRAIL 라벨(A 항목: 보행 저하) 생성에도 쓰이는 변수였습니다.  
→ 예측 피처가 정답 라벨 생성에 관여 = **모델이 라벨 규칙을 외우는 상황**

**무엇을 했나?**

| 피처 | 이전 | 이후 |
|---|---|---|
| walking_limited | C212 (라벨과 중복) | **C205 (침대→방 밖 이동, 라벨과 독립)** |
| fine_motor_limited | C212와 혼용 | **C208 (몸단장, 라벨과 독립)** |

---

### 4-2. 3클래스 단일 모델 → 2단계 캐스케이드 모델

**왜 했나?**  
기존 단일 XGBoost가 양호/주의/위험을 한 번에 분류했는데, `위험` 클래스가 전체의 5% 뿐이라 위험 감지가 부정확했습니다.

**2단계로 나누면:**
- Stage 1: 양호 vs 비양호 (전체 대상)
- Stage 2: 주의 vs 위험 (비양호만 따로 집중 학습)

**저장 파일 변경:**

| 이전 | 이후 |
|---|---|
| `health_status_model.joblib` (단일 3클래스) | `stage1_model.joblib` + `stage2_model.joblib` |
| `label_encoder.joblib` | 삭제됨 |

---

### 4-3. KLoSA 데이터 추가 (`fetch_klosa_health_training_data.py` 신규)

**왜 했나?**  
미국 NHANES 데이터(2,150건)만 사용하면 한국 노인 패턴을 반영하지 못합니다.

**무엇을 했나?**  
KLoSA 10차(w10) 데이터에서 NHANES와 동일한 스키마로 5,562건을 추출했습니다.

| 항목 | 이전 | 이후 |
|---|---|---|
| 학습 데이터 | NHANES 2,150건 | NHANES + KLoSA 7,712건 |
| 데이터 국적 | 미국 노인만 | 미국 + 한국 혼합 |

---

### 4-4. KLoSA 멀티웨이브 확장 (`fetch_klosa_multiwave_health_training_data.py` 신규) ★v5

**왜 했나?**  
위험 케이스가 전체의 5.4%(414건)에 불과해 Stage 2 학습이 부족했습니다.  
복지사 판정 데이터(welfareDecision)가 아직 적어 공개 데이터로 보완이 필요했습니다.

**무엇을 했나?**  
KLoSA w08(2016), w09(2018), w10(2020) 세 차수를 통합하되,  
동일인 중복 문제(패널 특성)를 **pid 기준 최신 차수 우선으로 중복 제거**해 해결했습니다.

```
w08: 5,628명 추출 → 465명만 유니크 (w09/w10에 없는 사람)
w09: 5,754명 추출 → 664명만 유니크 (w10에 없는 사람)
w10: 5,562명 전부 유니크
─────────────────────────────
최종: 6,691명 (중복 10,253건 제거)
```

> w10까지 살아남지 못하고 중도 이탈한 사람들(건강 악화·사망)이 추가됨  
> → 위험 케이스 341건 → **592건 (+74%)** 으로 크게 증가

| 항목 | v4 | v5 |
|---|---|---|
| KLoSA 데이터 | w10 단독 (5,562건) | w08+w09+w10 (6,691건) |
| 전체 학습 데이터 | 7,712건 | **8,841건** |
| 위험 케이스 | 414건 (5.4%) | **665건 (7.5%)** |
| 위험 F1 | 61.0% | **73.2%** |

---

### 4-5. `health_features.py` — 피처 정비

**제거:** `walking_aid`, `vision`, `hearing`, `max_hours`, `physical_limitation_count`  
(라벨 생성에 관여하거나 상수값인 컬럼들)

**추가:**
- `walking_limited`, `fine_motor_limited` (K-FRAIL 라벨과 분리된 ADL 항목)
- BMI 파생 피처 (`bmi`, `bmi_obese_flag`, `bmi_underweight_flag`)
- 연령대 플래그 (`age_70plus`, `age_80plus`)
- 복합 이환 점수 (`comorbidity_score` = 중증질환×2 + 만성질환×1)

---

## 5. 현재 모델 작동 방식

### 5-1. 예측 흐름

```
입력 JSON
    │
    ▼
health_features.py → build_features()   ← 26개 피처로 변환
    │
    ▼
Stage 1 (stage1_model.joblib)
  → P(양호) / P(비양호)
    │
    ├── 양호 방향  → P(양호) 그대로 사용
    │
    └── 비양호 방향 → Stage 2 (stage2_model.joblib)
                         → P(주의|비양호) / P(위험|비양호)
    │
    ▼
확률 조합
  P(양호) = Stage1.P(양호)
  P(주의) = Stage1.P(비양호) × Stage2.P(주의|비양호)
  P(위험) = Stage1.P(비양호) × Stage2.P(위험|비양호)
    │
    ▼
argmax → 최종 예측 (양호 / 주의 / 위험)
```

### 5-2. 입력 컬럼 (17개)

| 컬럼명 | 타입 | 예시 |
|---|---|---|
| age | 숫자 또는 텍스트 | `72` 또는 `"72세"` |
| gender | 텍스트 | `"남성"` / `"여성"` |
| height | 숫자 | `165` (cm) |
| weight | 숫자 | `60` (kg) |
| medicine_count | 숫자 | `3` |
| hypertension | 텍스트 | `"있음"` / `"없음"` |
| diabetes | 텍스트 | `"있음"` / `"없음"` |
| heart_disease | 텍스트 | `"있음"` / `"없음"` |
| joint_disease | 텍스트 | `"있음"` / `"없음"` |
| stroke | 텍스트 | `"있음"` / `"없음"` |
| kidney_disease | 텍스트 | `"있음"` / `"없음"` |
| lung_disease | 텍스트 | `"있음"` / `"없음"` |
| liver_disease | 텍스트 | `"있음"` / `"없음"` |
| cancer | 텍스트 | `"있음"` / `"없음"` |
| dementia | 텍스트 | `"있음"` / `"없음"` |
| walking_limited | 텍스트 | `"있음"` / `"없음"` |
| fine_motor_limited | 텍스트 | `"있음"` / `"없음"` |

> `"있음"`, `"1"`, `"true"`, `"yes"`, `"질환"`, `"치료"` 등 → `True`로 처리  
> `"없음"`, `"0"`, `"false"`, `"정상"` 등 → `False`로 처리

### 5-3. 출력 형식

```json
{
  "predictions": [
    {
      "prediction": "위험",
      "probabilities": {
        "양호": 0.002,
        "주의": 0.253,
        "위험": 0.746
      },
      "stage1": { "양호": 0.003, "비양호": 0.997 },
      "stage2": { "주의": 0.253, "위험": 0.747 }
    }
  ]
}
```

> `--verbose` 옵션 없으면 `stage1`, `stage2` 항목은 출력 안 됨

---

## 6. 현재 성능 (v5 기준)

| 지표 | CV (교차검증, 5-Fold) | Holdout 테스트 |
|---|---|---|
| Accuracy | 79.1% ± 0.8% | **81.3%** |
| Macro F1 | 0.709 ± 0.013 | **0.745** |
| AUC-ROC (3클래스) | — | **0.880** |
| Stage1 AUC (양호 vs 비양호) | 0.846 | 0.869 |
| Stage2 AUC (주의 vs 위험) | 0.887 | **0.921** |

### 클래스별 상세 (테스트 1,769건)

| 클래스 | Precision | Recall | F1 |
|---|---|---|---|
| 양호 | 85.4% | 92.4% | 88.8% |
| 주의 | 70.7% | 54.4% | 61.5% |
| **위험** | **70.6%** | **75.9%** | **73.2%** |

### 혼동 행렬

```
            예측-양호  예측-주의  예측-위험
실제-양호  [ 1086      81         8  ]
실제-주의  [  176     251        34  ]
실제-위험  [    9      23       101  ]
```

### 피처 중요도 TOP 5

| 순위 | 피처 | 중요도 | 의미 |
|---|---|---|---|
| 1 | fine_motor_limited_flag | **32.8%** | 몸단장·미세동작 불편 여부 |
| 2 | disease_count | 10.4% | 전체 질환 수 |
| 3 | walking_limited_flag | 9.6% | 실내 이동 불편 여부 |
| 4 | dementia_flag | 4.2% | 치매 여부 |
| 5 | very_high_medication_flag | 3.0% | 6종 이상 복약 |

---

## 7. 실행 방법

```powershell
cd C:\health_model\health_status_model

# [선택] 멀티웨이브 KLoSA 데이터 재추출 (w08, w09, w10 원본 .dta 필요)
.\.venv\Scripts\python.exe fetch_klosa_multiwave_health_training_data.py `
  --input "..\w08_20260413.dta,..\w09_20260413.dta,..\w10_20260413.dta" `
  --output data\klosa_multiwave_health_status_training.csv

# 학습 (데이터가 바뀌거나 재학습이 필요할 때만)
.\.venv\Scripts\python.exe train_health_status_model.py `
  --input "data\nhanes_health_status_training.csv,data\klosa_multiwave_health_status_training.csv" `
  --output-dir artifacts

# 예측 테스트
.\.venv\Scripts\python.exe predict_health_status.py `
  --input data\predict_sample.json `
  --verbose
```

---

## 8. Spring 연동 시 주의사항

DB(seniors, health_info 테이블)와 모델 입력 컬럼이 **1:1로 바로 맞지 않는 것들**이 있습니다.

| 모델 입력 | DB 상황 | 권장 처리 |
|---|---|---|
| `walking_limited` | DB에 없음 | `seniors.walking_aid`가 "지팡이"/"워커"/"휠체어"이면 `"있음"` |
| `fine_motor_limited` | DB에 없음 ⚠️ **(중요도 1위, 32.8%)** | `health_info.vision`이 "저하"/"불편"이면 `"있음"` (임시 대안) |
| `medicine_count` | `health_info.medications_json` | JSON 파싱해서 복용 중인 약 개수 직접 카운트 |
| `dementia` | `health_info.dementia` 텍스트 | "가끔 헷갈림", "잊어버림" 포함 여부도 체크 필요 |

> ⚠️ `fine_motor_limited_flag`는 모델에서 **가장 중요한 피처(32.8%)** 입니다.  
> 이 값이 항상 `"없음"`으로 들어가면 모델 성능이 크게 떨어집니다.  
> **노인 등록 화면에 "몸단장(세수·머리빗기 등)이 불편하신가요?" 항목 추가를 강력 권장합니다.**

---

## 9. 향후 개선 방향

1. **`fine_motor_limited` 직접 수집 (최우선)**  
   노인 등록/수정 화면에 해당 항목 추가 → 모델 성능 즉시 개선 가능

2. **DB 축적 후 재학습**  
   `seniors.welfareDecision`에 복지사 판정 라벨이 **100건 이상** 쌓이면  
   그 데이터로 재학습 → 실제 서비스 패턴에 맞는 모델로 발전

3. **주의 클래스 개선**  
   현재 주의 F1 61.5%가 가장 약한 부분. 라벨 데이터 축적 후 개선 예상.

---

## 10. 라벨 기준 (K-FRAIL 임상 척도)

K-FRAIL 5개 항목 점수 합산으로 라벨을 생성합니다.

| 점수 | 라벨 | 의미 |
|---|---|---|
| 0점 | 양호 | 건강한 상태 |
| 1~2점 | 주의 | 허약 전단계 (Pre-frail) |
| 3~5점 | 위험 | 허약 상태 (Frail) |

**K-FRAIL 5개 항목**

| 항목 | 내용 | NHANES 변수 | KLoSA 변수 |
|---|---|---|---|
| F (Fatigue) | 피로·탈진 | PFQ061F, PFQ061G | C209 ≥ 3 |
| R (Resistance) | 근력 저하 | PFQ061E | C203 ≥ 3 |
| A (Ambulation) | 보행 저하 | PFQ061B | C212 ≥ 3 |
| I (Illness) | 다중 만성질환 | 10개 질환 ≥ 5개 | 9개 질환 ≥ 3개 |
| L (Loss of weight) | 체중 감소 | 직접 변수 없음 | C106 == 2 |

> 이 라벨 변수들은 **모델 피처에서 완전히 제외**되어 데이터 순환(leakage)이 없습니다.
