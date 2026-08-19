# WOORI Link — 고령 취약계층 통합 돌봄 플랫폼

어르신의 일상 안전, 안부 확인, 복지 정보, 리콜 제품 관리 등을 하나의 서비스에서 통합 관리하고,  
보호자와 복지사가 동일한 데이터를 기반으로 대상자의 상태를 확인하고 후속조치까지 수행할 수 있도록 구성한 돌봄 플랫폼입니다.

---

## 프로젝트 개요

기존 돌봄 서비스는 위치 확인, 안부 확인, 복지 정보, 리콜 제품 관리 등의 기능이 분리되어 있어  
보호자와 복지사가 대상자의 상태를 한눈에 확인하고 대응하기 어렵다는 문제가 있습니다.

WOORI Link는 어르신·보호자·복지사별 화면을 분리하고,  
위험 감지 이후 실제 대응 과정과 후속조치까지 하나의 흐름으로 연결하도록 구성했습니다.

### 핵심 목표

- 어르신 상태를 여러 기능에서 분산 확인해야 하는 문제 개선
- 보호자·복지사별 역할에 맞는 데이터 제공
- AI·OCR·복지 정보·위험 분석 기능 통합
- 단순 정보 조회를 넘어 실제 후속조치 과정까지 관리
- 개발 환경과 배포 환경을 분리하여 실제 서비스 운영 가능하도록 구성

---

## 주요 기능

### 보호자

- 연결된 어르신 현황 확인
- 어르신 위치 및 안전반경 확인
- AI 안부 요청 및 응답 상태 확인
- 제품 등록 및 리콜 여부 확인
- 제품 라벨 이미지 OCR 분석
- 리콜 제품 실제 사용자 변경
- 복지사 후속조치 진행 상태 확인
- 생활안전 및 복지 정보 확인

---

### 복지사

- 담당 어르신 현황 확인
- 어르신 위험도 및 우선 확인 대상 관리
- 방문·상담 일정 관리
- 복지 지원 대상 확인
- 에너지 복지 지원 관리
- 리콜 제품 후속조치 관리
- 처리 이력 및 다음 조치일 관리

리콜 후속조치는 다음 상태 흐름을 기준으로 관리합니다.

```text
RECEIVED
    ↓
ASSIGNED
    ↓
CONTACTING
    ↓
CONFIRMED / SCHEDULED
    ↓
REFERRED
    ↓
COMPLETED
    ↓
GUARDIAN_NOTIFIED
```

각 단계에서 다음 정보를 저장합니다.

- 담당 복지사
- 처리 시각
- 연락 대상
- 연락 방법
- 연락 결과
- 제품 사용 상태
- 일정 정보
- 기관 연계 정보
- 내부 메모
- 다음 조치일
- 완료 결과 및 근거
- 보호자 통보 정보

---

## 핵심 구현

### 1. 리콜 제품 후속조치 워크플로

단순히 리콜 여부만 표시하는 것이 아니라  
실제 복지사가 처리해야 하는 후속 업무까지 상태 기반으로 관리하도록 구성했습니다.

```text
접수
→ 담당자 배정
→ 연락 시도
→ 대상자 확인 또는 일정 예약
→ 기관 연계
→ 조치 완료
→ 보호자 통보
```

주요 구현 내용

- 상태별 허용 전환 규칙 정의
- 비정상적인 상태 전환 서버에서 차단
- 단계별 담당자 및 처리 시각 저장
- 연락 결과 및 제품 사용 상태 관리
- 다음 조치일 관리
- 완료 결과 및 완료 근거 저장
- 처리 이력 저장
- 보호자 화면과 복지사 화면의 진행 상태 연동

---

### 2. 제품 라벨 OCR

제품 라벨 이미지를 업로드하면  
Google Cloud Vision을 통해 OCR 결과를 추출하고 규칙 기반 분석을 통해 제품 정보를 구조화합니다.

추출 대상

- 제품명
- 브랜드
- 제조사
- 모델번호
- 인증번호

처리 흐름

```text
제품 라벨 이미지
        ↓
Document AI FastAPI
        ↓
Google Cloud Vision
        ↓
OCR Text
        ↓
규칙 기반 필드 추출
        ↓
사용자 확인 및 수정
        ↓
제품 등록
```

OCR 분석 결과가 불충분한 경우  
사용자가 직접 입력 방식으로 전환할 수 있도록 구성했습니다.

---

### 3. AI 안부 분석

최근 안부 요청 및 응답 데이터를 기반으로  
어르신의 응답 상태와 위험 수준을 분석합니다.

주요 분석 항목

- 최근 요청 수
- 응답 수
- 미응답 수
- 응답률
- 평균 응답시간
- 연속 미응답 횟수
- 최근 응답 상태

분석 결과를 보호자·복지사 화면에 연동하여  
추가 확인이 필요한 대상자를 빠르게 파악할 수 있도록 구성했습니다.

---

### 4. 권한 기반 데이터 접근

클라이언트에서 전달된 사용자 ID만 신뢰하지 않고  
JWT 인증 정보를 기준으로 실제 접근 권한을 검증합니다.

주요 원칙

- 보호자는 자신과 연결된 어르신만 조회 가능
- 복지사는 배정된 대상자 또는 허용된 업무만 처리 가능
- 역할별 조회·수정 API 분리
- 클라이언트의 사용자 ID 조작에 의한 데이터 접근 방지

---

## 기술 스택

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

### AI / OCR

- Gemini API
- Groq
- RAG
- Vector Embedding
- Google Cloud Vision

### Authentication

- JWT
- Role-based Access Control

### Deployment

- Vercel
- Render

---

## 시스템 아키텍처

```text
┌────────────────────┐
│      어르신 앱      │
│      Flutter       │
└─────────┬──────────┘
          │
          │
┌─────────▼──────────┐
│     Spring Boot    │
│    Main Backend    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│     PostgreSQL     │
└────────────────────┘


┌────────────────────┐
│      보호자 웹      │
│       React        │
└───────┬───────┬────┘
        │       │
        │       └──────────────────────────┐
        │                                  │
        ▼                                  ▼
┌────────────────────┐           ┌────────────────────────┐
│     Spring Boot    │◀─────────▶│ FastAPI / Document AI  │
└─────────┬──────────┘           └────────────┬───────────┘
          │                                   │
          ▼                                   ├─────────────▶ Google Cloud Vision
     PostgreSQL                               │
                                              └─────────────▶ AI / RAG


┌────────────────────┐
│      복지사 웹      │
│       React        │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│     Spring Boot    │
└────────────────────┘
```

AI / RAG 구조

```text
사용자 질문
    ↓
FastAPI
    ↓
Embedding
    ↓
Qdrant
    ↓
관련 문서 검색
    ↓
Gemini / Groq
    ↓
응답 생성
```

---

## 프로젝트 구조

```text
woori_link/
├─ woori_link_flutter/
│  └─ 어르신용 Flutter 앱
│
├─ woori_link_react/
│  └─ 보호자·복지사 React 웹
│
├─ woori_link_spring/
│  └─ Spring Boot 메인 백엔드
│
└─ README.md
```

관련 AI 백엔드는 저장소 루트에서 별도로 관리합니다.

```text
../ai_backend/
└─ 복지 RAG 및 AI 분석 서버

../document_ai_backend/
└─ Google Cloud Vision 제품 라벨 OCR 서버
```

---

## 관련 저장소 경로

- [Woori Link](.)
- [AI Backend](../ai_backend/)
- [Document AI Backend](../document_ai_backend/)
- [NURI Root](../README.md)

---

## 로컬 실행

### React

Windows PowerShell 기준:

```powershell
cd woori_link_react

npm install
npm run dev
```

로컬 주소

```text
http://localhost:5173
```

---

### Spring Boot

```powershell
cd woori_link_spring
```

Gradle 사용 시:

```powershell
.\gradlew.bat bootRun
```

Maven 사용 시:

```powershell
.\mvnw.cmd spring-boot:run
```

로컬 API 주소

```text
http://127.0.0.1:8090/api
```

---

### AI Backend

저장소 루트 기준:

```powershell
cd ..\ai_backend
```

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

로컬 API 주소

```text
http://127.0.0.1:8001/api
```

---

### Document AI Backend

저장소 루트 기준:

```powershell
cd ..\document_ai_backend
```

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8002
```

로컬 API 주소

```text
http://127.0.0.1:8002/api
```

---

## 배포 주소

### 보호자 서비스

```text
https://woori-link-react.vercel.app/guardian/login
```

### 복지사 서비스

```text
https://woori-link-react.vercel.app/welfare/login
```

### Spring Backend

```text
https://woori-spring-backend.onrender.com
```

### Document AI Backend

```text
https://woori-document-ai-backend.onrender.com
```

---

## 배포 구조

```text
React Web
   ↓
Vercel

Spring Boot
   ↓
Render

Document AI
   ↓
Render

PostgreSQL
   ↓
Neon

Vector DB
   ↓
Qdrant Cloud
```

---

## 개발 / 배포 환경 분리

로컬 환경과 배포 환경의 API 주소는 환경변수로 분리합니다.

### React

로컬

```text
http://127.0.0.1:8090/api
```

배포

```text
https://woori-spring-backend.onrender.com/api
```

### Document AI

로컬

```text
http://127.0.0.1:8002/api
```

배포

```text
https://woori-document-ai-backend.onrender.com/api
```

API Key, JWT Secret, DB Password, Google Cloud 인증정보 등은  
GitHub에 포함하지 않고 환경변수 또는 배포 플랫폼 Secret으로 관리합니다.

---

## 문제 해결 경험

### 권한 검증 구조 개선

문제

- 클라이언트에서 전달한 사용자 ID만 신뢰할 경우 타 사용자 데이터 접근 가능성 존재

개선

- JWT 인증 사용자 기준으로 권한 검증
- 보호자·복지사별 조회 및 수정 범위 분리
- 서버에서 대상자 소유 관계 확인

---

### 리콜 후속조치 상태 관리

문제

- 단순 상태 변경 방식에서는 접수 상태에서 바로 완료 상태로 변경되는 등 비정상 흐름 발생 가능

개선

- 상태별 허용 전환 규칙 정의
- 서버에서 상태 전환 검증
- 변경 이력을 저장하여 전체 처리 과정 추적 가능하도록 구성

---

### 로컬 / 배포 환경 분리

문제

- 로컬 API 주소와 Render 배포 주소 차이로 연결 오류 발생
- Vercel → Render 요청 과정에서 CORS 문제 발생

개선

- 환경변수 기반 API 주소 분리
- Vercel / Render CORS 설정 정리
- 개발·배포 환경별 설정 분리
- Google Cloud 인증정보 Render Secret File로 관리

---

## 개인정보 및 보안

WOORI Link는 고령자의 위치, 복지, 건강 및 안전 관련 정보를 다룰 수 있으므로  
다음 원칙을 기준으로 구성했습니다.

- 최소한의 개인정보만 처리
- JWT 기반 사용자 인증
- 역할별 데이터 접근 제한
- 보호자와 대상자 관계 기반 권한 검증
- 외부 AI로 전달되는 개인정보 최소화
- AI 결과를 최종 판단이 아닌 보조 정보로 활용
- 중요 후속조치에 대한 사람의 최종 확인 구조 유지

---

## 현재 개발 브랜치

```text
yuna
```

---

## Repository

```text
https://github.com/yuna830/nuri/tree/yuna/woori_link
```
