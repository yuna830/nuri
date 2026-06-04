# Health Status Model v5

노인 건강 입력값을 기반으로 `양호 / 주의 / 위험`을 분류하는 XGBoost 파이프라인입니다.

## v5 핵심 변경 (v4 → v5)

| 항목 | v4 (KLoSA w10 단독) | v5 (현재) |
|---|---|---|
| 학습 데이터 | NHANES + KLoSA w10 (7,712건) | **NHANES + KLoSA w08+w09+w10 (8,841건)** |
| 위험 케이스 | 414건 (5.4%) | **665건 (7.5%)** |
| Holdout Macro F1 | 0.704 | **0.745** |
| 위험 클래스 F1 | 0.610 | **0.732** |
| Stage2 AUC | 0.885 | **0.921** |
| 데이터 전략 | 단일 차수 | **멀티웨이브 + pid 중복제거** |

## 라벨 방식: K-FRAIL 임상 척도

K-FRAIL (WHO/한국 임상 허약 평가 척도) 점수 0~5점으로 라벨을 생성합니다.

### NHANES K-FRAIL 컴포넌트

| K-FRAIL 항목 | NHANES 문항 | 양성 기준 |
|---|---|---|
| F 피로/탈진 | PFQ061F (집안일), PFQ061G (식사준비) | Much difficulty 이상 |
| R 근력 저하 | PFQ061E (물건 들기/운반) | Much difficulty 이상 |
| A 보행 저하 | PFQ061B (1/4마일 걷기) | Much difficulty 이상 |
| I 다중 만성질환 | MCQ, DIQ, BPQ (10개 질환) | 5개 이상 |
| L 신체활동 저하 | PFQ061C (계단) + PFQ061D (웅크리기) | 둘 다 Much difficulty 이상 |

### KLoSA K-FRAIL 컴포넌트 (프록시)

| K-FRAIL 항목 | KLoSA 변수 | 양성 기준 |
|---|---|---|
| F 피로/탈진 | C209 (집안일 도움 필요 정도) | 도움 필요(3) 이상 |
| R 근력 저하 | C203 (목욕/샤워 도움 필요 정도) | 도움 필요(3) 이상 |
| A 보행 저하 | C212 (가까운 외출 도움 필요 정도) | 도움 필요(3) 이상 |
| I 다중 만성질환 | 9개 질환 합산 (신장질환 변수 없어 ≥3 사용) | 3개 이상 |
| L 체중 감소 | C106 (지난 1년 5kg 이상 체중변동) | 체중 감소 |

> 라벨에 사용된 변수(C203, C209, C212, C106)는 피처에서 완전 제외 → 데이터 순환 없음  
> 피처용 ADL 변수: C205 (침대에서 방 밖 이동), C208 (몸단장) — 라벨 변수와 다른 항목

- **0점 → 양호** / **1~2점 → 주의** / **3~5점 → 위험**

## 학습 데이터

| 데이터셋 | 출처 | 대상 | 건수 | 양호 | 주의 | 위험 |
|---|---|---|---|---|---|---|
| NHANES 2017-2018 | CDC (미국) | 60세 이상 | 2,150 | 68.5% | 28.1% | 3.4% |
| KLoSA 10차 | KEIS (한국) | 60세 이상 | 5,562 | 68.8% | 25.1% | 6.1% |
| **합계** | | | **7,712** | **68.7%** | **25.9%** | **5.4%** |

## 입력 컬럼

| 컬럼 | 설명 |
|---|---|
| `age` | 나이 |
| `gender` | 성별 (남성/여성) |
| `height` | 키 (cm) |
| `weight` | 몸무게 (kg) |
| `medicine_count` | 복약 종류 수 |
| `hypertension` | 고혈압 여부 (있음/없음) |
| `diabetes` | 당뇨 여부 |
| `heart_disease` | 심장질환 여부 |
| `joint_disease` | 관절질환 여부 |
| `stroke` | 뇌졸중 여부 |
| `kidney_disease` | 신장질환 여부 |
| `lung_disease` | 호흡기질환 여부 |
| `liver_disease` | 간질환 여부 |
| `cancer` | 암 진단 여부 |
| `dementia` | 치매 여부 |
| `walking_limited` | 실내 이동 불편 여부 (있음/없음) |
| `fine_motor_limited` | 몸단장·미세동작 불편 여부 (있음/없음) |

## 실행 순서

```powershell
cd C:\health_model\health_status_model

# 1. 패키지 설치
.\.venv\Scripts\pip.exe install -r requirements.txt

# 2-A. NHANES 데이터 수집 + K-FRAIL 라벨링 (인터넷 필요, 캐시 있으면 건너뜀)
.\.venv\Scripts\python.exe fetch_nhanes_health_training_data.py `
  --raw-dir data\nhanes_raw `
  --output data\nhanes_health_status_training.csv

# 2-B. KLoSA 데이터 추출 (w10_20260413.dta 필요)
.\.venv\Scripts\python.exe fetch_klosa_health_training_data.py `
  --input ..\w10_20260413.dta `
  --output data\klosa_health_status_training.csv

# 3. XGBoost + Stratified 5-Fold 학습 (NHANES + KLoSA 통합)
.\.venv\Scripts\python.exe train_health_status_model.py `
  --input "data\nhanes_health_status_training.csv,data\klosa_health_status_training.csv" `
  --output-dir artifacts

# 4. 예측 테스트
.\.venv\Scripts\python.exe predict_health_status.py `
  --input data\predict_sample.json
```

## 결과 파일

```
artifacts/
├── health_status_model.joblib   # 학습된 XGBoost 모델
├── label_encoder.joblib          # 라벨 인코더 (양호/주의/위험 ↔ 정수)
├── feature_columns.json          # 피처 컬럼 목록 (24개)
├── metrics.json                  # 전체 성능 지표 (CV + Holdout)
└── feature_importance.csv        # 피처 중요도 순위
```

## 달성 성능

| 지표 | v4 결과 | 비고 |
|---|---|---|
| CV Accuracy (5-Fold) | **79.1% ± 0.8%** | 8,841건 통합 학습 |
| CV Macro F1 | **0.709 ± 0.013** | 3클래스 평균 F1 |
| Holdout Accuracy | 81.3% | 1,769건 테스트 |
| Holdout Macro F1 | **0.745** | |
| Holdout AUC-ROC | **0.880** | One-vs-Rest 방식 |
| Stage1 AUC | 0.869 | 양호 vs 비양호 |
| Stage2 AUC | **0.921** | 주의 vs 위험 |

> **100%가 아닌 이 범위가 실제 예측력이 있는 모델의 정상 수치입니다.**  
> 이전 v1/v2 모델의 100% 정확도는 라벨 순환(데이터 누설)으로 인한 거짓 수치였습니다.

### 클래스별 예측 확률 예시

```json
// 72세 여성, 질환 없음, medicine_count=1
{ "양호": 0.876, "주의": 0.123, "위험": 0.002 }

// 78세 여성, 7개 질환 + 뇌졸중 + 암 + 걷기/미세동작 제한
{ "양호": 0.002, "주의": 0.253, "위험": 0.746 }
```

## 신뢰도 근거

- **라벨**: K-FRAIL (WHO/한국 임상 사용 허약 척도)
- **데이터**: 
  - CDC NHANES 2017-2018 실측 설문 (미국 60세 이상 ~2,150명)
  - 한국고령화연구패널조사(KLoSA) 10차 (한국 60세 이상 ~5,562명)
- **검증**: Stratified 5-Fold 교차 검증
- **순환 없음**: 라벨 생성 변수와 모델 피처 완전 분리

## 상위 피처 중요도

| 순위 | 피처 | 중요도 | 의미 |
|---|---|---|---|
| 1 | `fine_motor_limited_flag` | 0.34 | 미세운동 제한 (몸단장 어려움) |
| 2 | `walking_limited_flag` | 0.09 | 실내 이동 제한 |
| 3 | `disease_count` | 0.07 | 전체 질환 수 |
| 4 | `dementia_flag` | 0.04 | 치매 여부 |
| 5 | `comorbidity_score` | 0.04 | 중증질환×2 + 만성질환×1 |

## 해석

이 모델은 건강 상태를 직접 진단하는 의료 모델이 아닙니다.
K-FRAIL 임상 척도를 기반으로 돌봄/일자리 추천 화면에서 위험도 참고값을 제공하는 분류 모델입니다.

서비스 신뢰도를 더 높이려면 복지사가 확인한 `양호 / 주의 / 위험` 라벨을 누적해서 재학습하는 것을 권장합니다.
