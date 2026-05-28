# Job Matching Model

노인 건강 정보와 일자리 조건을 비교해 `적합 / 검토 / 부적합`을 분류하는 sklearn 실험 파이프라인입니다.

## 현재 위치

- 1단계 Spring 규칙 기반 추천 API는 서비스에서 바로 점수를 계산합니다.
- 2단계 이 폴더는 실제 라벨 데이터가 쌓였을 때 sklearn 모델을 학습하고 성능을 확인하기 위한 작업 공간입니다.
- 아직 운영 Spring API에 모델을 직접 연결하지는 않습니다.

## 학습 데이터 구조

`data/job_matching_training_sample.csv` 형식을 기준으로 합니다.

필수 컬럼:

- `label`: `적합`, `검토`, `부적합`
- `health_status`: 건강 상태
- `medicine_count`: 복약 수
- `walking_aid`: 보행 보조 여부
- `recent_fall`: 최근 낙상 여부/횟수
- `disabled_work`: 어려운 업무 조건
- `max_hours`: 하루 최대 활동 가능 시간
- `max_distance`: 이동 가능 거리
- `disease_text`: 주요 질환/중증도 설명
- `hope_job_type`: 희망 직종
- `hope_condition`: 희망 근무 조건
- `job_type`: 공고 직종
- `work_environment`: `실내`, `야외`, `혼합`
- `physical_intensity`: `낮음`, `중간`, `높음`
- `daily_hours`: 공고 하루 근무 시간
- `commute_level`: 공고 이동 조건
- `task_tags`: 업무 태그
- `closed`: 마감 여부

## PyCharm 실행 순서

1. PyCharm에서 `D:\nuri\nuri-geonhee\woorispring\ml\job_matching_model` 폴더를 엽니다.
2. 터미널에서 가상환경을 만들고 패키지를 설치합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

3. 샘플 데이터로 학습합니다.

```powershell
python train_job_matching_model.py
```

4. 결과를 확인합니다.

```text
artifacts/job_matching_model.joblib
artifacts/metrics.json
artifacts/feature_columns.json
artifacts/feature_importance.csv
```

5. 샘플 예측을 실행합니다.

```powershell
python predict_job_match.py --input data/predict_sample.json
```

## 주의

샘플 CSV는 구조 검증용입니다. 정확도나 신뢰도를 설명하려면 실제 서비스에서 쌓인 판정 데이터가 필요합니다.
실제 라벨은 복지사가 최종 판단한 `적합 / 검토 / 부적합` 결과를 저장해서 만들어야 합니다.

## 더미 데이터로 재학습 루프 확인

실제 판정 데이터가 아직 없을 때는 더미 CSV로 흐름만 확인할 수 있습니다.

```powershell
python generate_dummy_training_data.py --rows 300 --output data/job_matching_dummy_300.csv
python train_job_matching_model.py --input data/job_matching_dummy_300.csv --output-dir artifacts_dummy
python predict_job_match.py --input data/predict_sample.json --model artifacts_dummy/job_matching_model.joblib --feature-columns artifacts_dummy/feature_columns.json
```

더 많은 시나리오 데이터가 필요하면 행 수를 늘려 생성할 수 있습니다. 아래 예시는 `적합 / 검토 / 부적합`을 각각 1,000건씩 만든 뒤 별도 모델 폴더에 학습합니다.

```powershell
python generate_dummy_training_data.py --rows 3000 --output data/job_matching_dummy_3000.csv
python train_job_matching_model.py --input data/job_matching_dummy_3000.csv --output-dir artifacts_synthetic_3000
```

이 데이터는 실제 복지사 판정이 아니라 규칙으로 만든 합성 데이터입니다. 모델 파이프라인 검증이나 발표용 데모에는 쓸 수 있지만, 실제 정확도/신뢰도 근거로 설명하면 안 됩니다.

실제 데이터가 쌓이면 Spring에서 아래 API로 CSV를 받은 뒤 같은 방식으로 재학습합니다.

```http
GET /api/job-matching/training-data.csv
```

## 4단계: 피드백 CSV로 모델 재학습

복지사 화면에서 저장한 `적합 / 검토 / 부적합` 피드백은 Spring API로 CSV export 후 모델 재학습에 사용할 수 있습니다.

Spring 서버가 실행 중이면 아래 명령으로 CSV 다운로드부터 모델 갱신까지 한 번에 수행합니다.

```powershell
cd D:\nuri\nuri-geonhee\woorispring\ml\job_matching_model
.\retrain_from_feedback.ps1
```

이미 내려받은 CSV가 있으면 파일을 직접 지정할 수 있습니다.

```powershell
.\retrain_from_feedback.ps1 -InputPath data\job_matching_training_sample.csv
```

실행 결과로 아래 파일이 갱신됩니다.

- `artifacts/job_matching_model.joblib`
- `artifacts/feature_columns.json`
- `artifacts/metrics.json`
- `artifacts/feature_importance.csv`

Spring의 `POST /api/job-matching/seniors/{seniorId}/ml-recommendations`는 기본적으로 `artifacts` 폴더의 모델을 사용합니다.

주의: 피드백 데이터가 너무 적거나 라벨이 한쪽으로 치우치면 성능 수치는 신뢰하기 어렵습니다. 최소한 `적합 / 검토 / 부적합` 라벨이 고르게 쌓인 뒤 metrics를 설명해야 합니다.

## 공개 데이터 기반 학습 파이프라인

실제 서비스 신뢰도 모델에 바로 쓸 수 있는 `노인 건강 정보 + 일자리 공고 + 전문가 적합 판정` 공개 데이터셋은 찾기 어렵습니다. 그래서 현재 구조는 아래처럼 구성합니다.

- KLoSA 같은 공개 고령자 건강/고용 데이터: 노인 건강 프로필 분포를 만드는 데 사용
- 한국노인인력개발원 노인 구인정보 API: 실제 노인 일자리 공고 후보를 가져오는 데 사용
- O*NET/ORS 같은 직무 요구 데이터: 직무 강도, 야외/실내, 이동/서있기/운반 같은 업무 부담 기준을 보강하는 참고 데이터로 사용
- 복지사 피드백: 최종적으로 신뢰도 있는 `적합 / 검토 / 부적합` 정답 라벨로 사용

현재 구현한 공개 데이터 학습은 정답 라벨이 아니라 규칙으로 만든 `weak label`입니다. 발표에서는 “공개 데이터 기반 프로토타입 모델”이라고 설명해야 하며, 실제 서비스 신뢰도는 복지사 피드백 라벨이 쌓인 뒤 평가해야 합니다.

### 1. 노인일자리 공고 수집

공공데이터포털에서 한국노인인력개발원 노인 구인정보 API 활용 신청 후 발급받은 서비스키를 사용합니다.

```powershell
cd D:\nuri\nuri-geonhee\woorispring\ml\job_matching_model
$env:SENURI_SERVICE_KEY="발급받은_서비스키"
python fetch_senuri_jobs.py --rows 300 --output data\senuri_jobs.csv
```

출력 CSV는 모델 입력에 맞게 아래 값을 포함합니다.

- `job_type`
- `work_environment`
- `physical_intensity`
- `daily_hours`
- `commute_level`
- `task_tags`
- `closed`

### 2. KLoSA 건강 데이터 정규화

KLoSA 원본 변수명은 조사 차수/파일 형식마다 다를 수 있어서, 먼저 아래 공통 스키마 CSV로 정리합니다.

```text
person_id, health_status, medicine_count, walking_aid, recent_fall,
disabled_work, max_hours, max_distance, disease_text,
hope_job_type, hope_condition
```

예시 파일은 `data/public_health_rows.example.csv`에 있습니다.

### 3. 공개 데이터 학습 CSV 생성

건강 프로필과 공고를 조합해 `적합 / 검토 / 부적합` weak label을 만듭니다.

```powershell
python build_public_training_data.py `
  --health data\public_health_rows.example.csv `
  --jobs data\senuri_jobs.example.csv `
  --output data\public_job_matching_training_example.csv
```

실제 파일을 넣을 때는 아래처럼 바꿉니다.

```powershell
python build_public_training_data.py `
  --health data\klosa_health_rows.csv `
  --jobs data\senuri_jobs.csv `
  --output data\public_job_matching_training.csv `
  --max-pairs 10000
```

라벨이 한쪽으로 치우치면 모델이 다수 라벨만 맞히는 방향으로 학습됩니다. 발표용 모델 검증에서는 아래처럼 라벨별 상한을 걸어 `적합 / 검토 / 부적합`을 최대한 균형 있게 뽑습니다.

```powershell
python build_public_training_data.py `
  --health data\klosa_health_rows.csv `
  --jobs data\senuri_jobs.csv `
  --output data\public_job_matching_training_balanced.csv `
  --max-per-label 3000
```

예를 들어 건강 데이터 1,000명과 공고 300개가 있으면 원본 조합은 최대 300,000쌍입니다. 그중 라벨별 3,000건씩 뽑으면 최대 9,000건의 균형 학습 CSV를 만들 수 있습니다.

### 4. ML 모델 학습

```powershell
python train_job_matching_model.py `
  --input data\public_job_matching_training.csv `
  --output-dir artifacts_public
```

Spring에서 바로 쓰려면 결과물을 기본 `artifacts` 폴더로 학습합니다.

```powershell
python train_job_matching_model.py `
  --input data\public_job_matching_training.csv `
  --output-dir artifacts
```

### 5. 해석 기준

이 모델은 공개 데이터와 규칙 기반 weak label로 만든 1차 ML 모델입니다.

- 장점: 실제 노인일자리 공고를 사용하고, 건강 조건과 업무 조건 비교 구조를 학습할 수 있습니다.
- 한계: 복지사가 직접 판정한 정답 라벨이 아니므로 실제 정확도/신뢰도라고 말하면 안 됩니다.
- 다음 단계: 복지사가 추천 결과에 `적합 / 검토 / 부적합` 피드백을 저장하고, 그 CSV로 재학습해야 합니다.

## 대체 공개 데이터 대규모 실행 예시

공공데이터포털 서비스키나 KLoSA 원본 파일이 없을 때는, 로그인 없이 받을 수 있는 공개 데이터로 대규모 파이프라인을 검증할 수 있습니다.

- 건강 데이터: CDC NHANES 2017-2018 실제 건강 설문 데이터
- 공고 데이터: Hugging Face `xanderios/linkedin-job-postings` 실제 구인공고 CSV

주의: 한국 노인일자리 전용 데이터는 아니므로 서비스 신뢰도 근거가 아니라 “대규모 ML 파이프라인 검증”으로만 설명합니다.

```powershell
cd D:\nuri\nuri-geonhee\woorispring\ml\job_matching_model

python fetch_nhanes_health.py `
  --output data\nhanes_health_rows.csv `
  --min-age 60

python normalize_hf_linkedin_jobs.py `
  --input data\hf_linkedin_job_postings.csv `
  --output data\hf_linkedin_jobs_normalized_2000.csv `
  --limit 2000

python build_public_training_data.py `
  --health data\nhanes_health_rows.csv `
  --jobs data\hf_linkedin_jobs_normalized_2000.csv `
  --output data\public_job_matching_training_nhanes_hf_9000.csv `
  --max-per-label 3000

python train_job_matching_model.py `
  --input data\public_job_matching_training_nhanes_hf_9000.csv `
  --output-dir artifacts_public_nhanes_hf_9000
```

실행 예시 결과:

```text
NHANES 60세 이상 건강 프로필: 2,150명
LinkedIn 구인공고 정규화: 2,000건
학습 데이터: 9,000건
- 적합: 3,000건
- 검토: 3,000건
- 부적합: 3,000건
```
