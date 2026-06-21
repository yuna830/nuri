# woorispring

어르신 돌봄 서비스의 Spring Boot 메인 백엔드다. 어르신/보호자/복지사/관리자 API, FCM 푸시 알림, 공공 API 연동, RAG 챗봇 프록시, 얼굴 인식 연동을 담당한다.

## 주요 기능

- 어르신 / 보호자 / 복지사 / 관리자 계정 관리
- 실시간 위치 수신 및 안전 반경 이탈 감지
- FCM 푸시 알림 (안전 반경 이탈, 동의 요청, 긴급 알림)
- 낙상 이벤트 기록 및 알림
- 일정 관리 / 복약 알림
- 일자리 공고 / 일자리 매칭 (ML 모델 연동)
- 날씨 / 기상 알림 (기상청 API)
- 실종 경보 / 목격 신고 (경찰청 API)
- 얼굴 인식 서버 프록시 (face_api 연동)
- RAG 복지 챗봇 프록시 (ai_backend 연동)
- 공공복지 API 수집 및 RAG 임베딩 트리거
- 파일 업로드 (어르신 사진 등)

## 기술 스택

- Spring Boot 3 / Java
- PostgreSQL (Oracle Cloud VM)
- JPA / Hibernate
- Firebase Admin SDK (FCM)

## 연동 서버

| 서버 | 환경변수 | 용도 |
|---|---|---|
| RAG API (ai_backend) | `AI_BACKEND_BASE_URL` | 복지 챗봇 프록시 |
| face_api (raspi-client) | `FACE_SERVER_URL` | 얼굴 인식 프록시 |

## 환경변수

운영 환경에서는 아래 환경변수를 설정해야 한다.

| 변수명 | 설명 |
|---|---|
| `OCI_DB_PASSWORD` | PostgreSQL 비밀번호 |
| `KMA_SERVICE_KEY` | 기상청 공공데이터 API 키 |
| `PUBLIC_DATA_SERVICE_KEY` | 공공데이터포털 API 키 |
| `SAFE182_ESNTL_ID` | 경찰청 Safe182 필수 ID |
| `SAFE182_AUTH_KEY` | 경찰청 Safe182 인증 키 |
| `AI_BACKEND_BASE_URL` | RAG API 주소 (기본값: `http://127.0.0.1:8001/api`) |
| `FACE_SERVER_URL` | 얼굴 인식 서버 주소 (기본값: `http://localhost:8003`) |
| `APP_UPLOAD_ROOT` | 파일 업로드 루트 경로 (기본값: `uploads`) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Firebase 서비스 계정 JSON 경로 |

## 로컬 실행 방법

`application.properties`의 환경변수를 IDE Run Configuration 또는 시스템 환경변수로 주입한다.

IntelliJ 기준:
```
Run > Edit Configurations > Environment variables

포트는 기본 `8080`, 팀원별 profile로 변경 가능하다 (`application-yuna.properties` 등).
```

## 데이터베이스
- Oracle Cloud VM PostgreSQL (`168.107.27.186:5432`)
- DB명: `woori` / 계정: `woori`
- 스키마: `schema-update.sql` (서버 시작 시 자동 적용)
  
## ML 모델
```
woorispring/ml/
├── health_status_model/ # 어르신 건강 상태 분류 (XGBoost, 양호/주의/위험)
└── job_matching_model/ # 일자리 매칭 모델
```
