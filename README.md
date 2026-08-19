# WOORI — 고령 취약계층 통합 돌봄 서비스

어르신의 안전 상태를 확인하고 복지 정보를 제공하며,  
보호자·복지사·관리자가 대상자의 정보를 함께 관리할 수 있도록 구성한  
고령 취약계층 대상 통합 돌봄 서비스입니다.

위치 및 안전 관리, 복지 정보 제공, AI 기반 질의응답,  
얼굴 인식 기반 실종자 감지 등의 기능을 하나의 서비스 구조로 연결하는 것을 목표로 개발했습니다.

---

## 프로젝트 소개

기존 돌봄 서비스는 위치 확인, 복지 정보, 안전 관리 등의 기능이  
각각 분리되어 제공되는 경우가 많아 여러 대상자를 관리하는 보호자와 복지사가  
필요한 정보를 한눈에 확인하기 어렵다는 문제에서 시작했습니다.

WOORI는 어르신·보호자·복지사·관리자별 화면을 분리하고,  
각 역할에 필요한 정보를 하나의 서비스에서 확인할 수 있도록 구성했습니다.

### 주요 기능

- 어르신 위치 및 안전 상태 확인
- 보호자·복지사 대상 어르신 정보 관리
- 복지 정책 정보 조회 및 AI 질의응답
- 고령 취약계층 복지 서비스 정보 제공
- 얼굴 인식 기반 실종자 감지
- 카메라 디바이스와 서버 간 데이터 연동
- 역할별 접근 권한 관리

---

## 구성 요소

| 폴더 | 설명 | 기술 |
| --- | --- | --- |
| `woorispring` | 메인 백엔드 API 서버 | Spring Boot 3, PostgreSQL |
| `woorireact` | 어르신·보호자·복지사·관리자 웹 | React 19, Vite |
| `woori_senior_app` | 어르신용 모바일 앱 | Flutter |
| `woori_guardian_app` | 보호자용 모바일 앱 | Flutter |
| `ai_backend` | 복지 정보 RAG 및 AI 질의응답 서버 | FastAPI, Qdrant, Gemini |
| `raspi-client` | 얼굴 인식 카메라 클라이언트 | Python, InsightFace |
| `woori-vault` | 복지정책 및 API 설계 문서 | Obsidian Markdown |
| `docs` | 개인정보 및 프로젝트 관련 문서 | Markdown |

---

## 시스템 구조

```text
                    ┌─────────────────────┐
                    │      Flutter App    │
                    │   어르신 / 보호자 앱   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      React Web      │
                    │ 보호자 / 복지사 / 관리자 │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Spring Boot     │
                    │      Main API       │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────────┐ ┌──────────────┐ ┌─────────────────┐
     │   PostgreSQL   │ │  AI Backend  │ │ Face Recognition│
     │   Main Data    │ │   FastAPI    │ │     Client      │
     └────────────────┘ └──────┬───────┘ └───────┬─────────┘
                               │                  │
                               ▼                  ▼
                        ┌─────────────┐     ┌──────────────┐
                        │   Qdrant    │     │ Raspberry Pi │
                        │ Vector DB   │     │   / Camera   │
                        └──────┬──────┘     └──────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │ Gemini API  │
                        └─────────────┘
```

---

## 주요 기술

### Frontend

- React
- Vite
- Flutter

### Backend

- Spring Boot
- FastAPI

### Database

- PostgreSQL
- Qdrant

### AI

- Gemini API
- RAG
- Vector Embedding
- InsightFace

### Device

- Raspberry Pi
- Camera
- Python Client

### Authentication / Security

- JWT
- 역할 기반 접근 제어

---

## 주요 서비스

### 어르신 서비스

- 어르신 정보 조회
- 위치 및 안전 정보 전송
- 돌봄 서비스 기능 이용
- 보호자와 연결된 데이터 관리

### 보호자 서비스

- 연결된 어르신 현황 확인
- 어르신 위치 및 안전 상태 확인
- 생활·복지 정보 확인
- 이상 상황 및 알림 확인

### 복지사 서비스

- 담당 어르신 관리
- 복지 정보 및 지원 대상 확인
- 대상자별 상태 확인
- 복지 업무 및 일정 관리

### 관리자 서비스

- 사용자 및 서비스 관리
- 시스템 데이터 확인
- 역할 및 계정 관리

---

## AI / 복지 정보 서비스

`ai_backend`는 복지 정책 문서를 기반으로 사용자의 질문과 관련된 정보를 검색하고  
AI 응답을 생성하기 위한 서버입니다.

```text
사용자 질문
    ↓
FastAPI
    ↓
질문 Embedding
    ↓
Qdrant 유사 문서 검색
    ↓
관련 복지 정보 추출
    ↓
Gemini
    ↓
최종 응답 생성
```

### 주요 구성

- FastAPI 기반 AI API
- Qdrant 기반 Vector Search
- 복지정책 문서 Embedding
- RAG 기반 질의응답
- Gemini API 연동

---

## 얼굴 인식 기반 안전 관리

카메라 클라이언트를 통해 얼굴을 감지하고,  
서버의 대상자 정보와 연동하여 실종자 또는 관리 대상자를 확인하기 위한 기능입니다.

```text
Camera
   ↓
raspi-client
   ↓
얼굴 감지
   ↓
InsightFace
   ↓
대상자 비교
   ↓
Spring Boot
   ↓
보호자 / 관리자 알림
```

### 주요 구성

- Raspberry Pi 기반 카메라 클라이언트
- Python 영상 처리
- InsightFace 기반 얼굴 특징 추출
- Spring Boot 서버와 결과 연동

---

## 각 서비스 실행

각 서비스의 상세 실행 방법은 해당 폴더의 README를 참고합니다.

- [Spring Backend](./woorispring/README.md)
- [React Web](./woorireact/README.md)
- [AI Backend](./ai_backend/README.md)
- [Senior App](./woori_senior_app/README.md)
- [Guardian App](./woori_guardian_app/README.md)
- [Raspberry Pi Client](./raspi-client/README.md)

---

## 로컬 포트

| 서비스 | 포트 |
| --- | --- |
| Spring Backend | `8080` |
| RAG API (`ai_backend`) | `8001` |
| 얼굴 인식 서버 / 클라이언트 연동 | `8003` |
| Chat / STT / TTS 서버 | `8002` |
| 낙상 감지 서버 | `8000` |

> 포트 구성은 로컬 개발 환경 기준이며 각 서비스 설정에 따라 변경될 수 있습니다.

---

## 개인정보 보호 및 AI 안전성

WOORI는 고령자의 복지, 건강, 위치 및 안전 관련 정보를 다룰 수 있는 서비스이므로  
다음 원칙을 기준으로 설계했습니다.

- 필요한 개인정보만 최소 수집
- 사용자 역할 및 대상자 관계를 기반으로 접근 범위 제한
- JWT 기반 사용자 인증
- 보호자·복지사·관리자별 데이터 접근 범위 분리
- 외부 AI 서비스로 전달되는 데이터 최소화
- AI 결과를 최종 판단이 아닌 보조 정보로 활용
- 중요 조치에 대한 사람의 최종 확인 구조 고려

관련 문서:

- [개인정보 처리 목록](./docs/privacy/PERSONAL_DATA_INVENTORY.md)

데이터 흐름, 보관·삭제 정책 및 AI 재검토 절차는  
구현 검증과 함께 지속적으로 문서화하고 있습니다.

---

## 프로젝트 구조

```text
nuri/
├─ woorispring/
├─ woorireact/
├─ woori_senior_app/
├─ woori_guardian_app/
├─ ai_backend/
├─ raspi-client/
├─ woori-vault/
├─ docs/
└─ README.md
```

---

## 개발 브랜치

주요 개발 브랜치

```text
yuna
```
