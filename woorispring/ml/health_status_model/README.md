# Health Status Model

노인 건강 입력값을 기반으로 `양호 / 주의 / 위험`을 분류하는 sklearn 실험 파이프라인입니다.

## 데이터

현재 공개 데이터는 CDC NHANES 2017-2018 실제 건강 설문 데이터를 사용합니다.

- 60세 이상 응답자만 사용
- 질환 여부, 복약 수, 신체 기능 제한, 키/몸무게 등을 모델 입력으로 사용
- `양호 / 주의 / 위험` 라벨은 의료진 판정 라벨이 아니라 규칙 기반 weak label입니다.

따라서 현재 성능은 “공개 건강 데이터 기반 ML 파이프라인 검증”으로 설명해야 하며, 실제 의료적 신뢰도라고 말하면 안 됩니다.

## 실행

```powershell
cd D:\nuri\nuri-geonhee\woorispring\ml\health_status_model

python fetch_nhanes_health_training_data.py `
  --output data\nhanes_health_status_training.csv `
  --min-age 60

python train_health_status_model.py `
  --input data\nhanes_health_status_training.csv `
  --output-dir artifacts

python predict_health_status.py `
  --input data\predict_sample.json
```

## 입력 컬럼

- `age`
- `gender`
- `height`
- `weight`
- `medicine_count`
- `hypertension`
- `diabetes`
- `heart_disease`
- `joint_disease`
- `stroke`
- `kidney_disease`
- `lung_disease`
- `liver_disease`
- `cancer`
- `dementia`
- `walking_aid`
- `vision`
- `hearing`
- `recent_fall`
- `has_surgery`
- `physical_limitation_count`
- `max_hours`

## 결과 파일

- `artifacts/health_status_model.joblib`
- `artifacts/feature_columns.json`
- `artifacts/metrics.json`
- `artifacts/feature_importance.csv`

## 해석

이 모델은 건강 상태를 직접 진단하는 의료 모델이 아닙니다. 돌봄/일자리 추천 화면에서 위험도 참고값을 제공하기 위한 분류 모델입니다.

서비스 신뢰도를 높이려면 실제 복지사 또는 의료 전문가가 확인한 `양호 / 주의 / 위험` 라벨을 누적해서 재학습해야 합니다.
