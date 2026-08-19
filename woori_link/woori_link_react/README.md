# woori_link_react — WOORI Link 보호자·복지사 웹

고령 취약계층 돌봄 플랫폼 **WOORI Link**의 보호자·복지사용 웹 프론트엔드입니다.

React 기반으로 구현했으며 Spring Boot 메인 백엔드, AI Backend, Document AI Backend와 연동하여 어르신 안전 상태 확인, AI 안부 관리, 복지 지원, 리콜 제품 관리 및 복지사 후속조치 기능을 제공합니다.

---

## 주요 사용자

### 보호자

연결된 어르신의 현재 상태와 안전·복지 정보를 확인하고 필요한 기능을 이용하는 사용자

주요 기능

* 연결된 어르신 현황 확인
* 어르신 위치 및 안전반경 확인
* AI 안부 요청 및 응답 상태 확인
* 제품 등록 및 리콜 여부 확인
* 제품 라벨 OCR 분석
* 리콜 제품 실제 사용자 변경
* 복지사 후속조치 진행 상태 확인
* 생활안전 정보 확인
* 복지 정보 확인

---

### 복지사

담당 어르신의 상태를 확인하고 실제 돌봄 업무와 후속조치를 관리하는 사용자

주요 기능

* 담당 어르신 현황 확인
* 위험도 및 우선 확인 대상 관리
* 방문·상담 일정 관리
* 복지 지원 대상 확인
* 에너지 복지 관리
* 리콜 제품 후속조치 관리
* 후속조치 처리 이력 확인
* 다음 조치일 관리

---

## 기술 스택

| 역할             | 기술                            |
| -------------- | ----------------------------- |
| Framework      | React                         |
| Build Tool     | Vite                          |
| Language       | JavaScript / JSX              |
| Styling        | CSS                           |
| HTTP Client    | Axios                         |
| Main Backend   | Spring Boot                   |
| AI Backend     | FastAPI                       |
| OCR Backend    | FastAPI + Google Cloud Vision |
| Authentication | JWT                           |
| Deployment     | Vercel                        |

---

## 서비스 구조

```text
                    ┌─────────────────────┐
                    │      React Web      │
                    │ 보호자 / 복지사 화면 │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     API Layer       │
                    │       Axios         │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
      Spring Boot          AI Backend       Document AI
       Main API             FastAPI            FastAPI
             │                 │                 │
             ▼                 ▼                 ▼
       PostgreSQL           Qdrant       Google Cloud Vision
```

---

## 주요 화면

### 보호자

```text
/guardian/login
        ↓
보호자 로그인
        ↓
/guardian
        ↓
홈
├─ 어르신 현황
├─ 제품·생활안전
├─ 복지·안전 도우미
└─ 마이페이지
```

#### 홈

* 오늘 확인이 필요한 항목 요약
* 최근 위험 및 안전 상태 확인
* 리콜 발생 제품 현황 확인
* 복지 정보 확인

#### 어르신 현황

* 연결된 어르신 목록
* 위치 상태 확인
* 안전반경 확인
* AI 안부 응답 상태 확인
* 위험 정보 확인

#### 제품·생활안전

* 어르신 보유 제품 등록
* 직접 입력 또는 제품 라벨 촬영 등록
* OCR 분석 결과 확인
* 제품 리콜 여부 확인
* 실제 제품 사용자 변경
* 복지사 후속조치 진행 상태 확인
* 생활안전 정보 제공

---

### 복지사

```text
/welfare/login
      ↓
복지사 로그인
      ↓
/welfare
      ↓
대시보드
├─ 대상자 목록
├─ 에너지 복지
├─ 리콜 제품 조치 관리
└─ 마이페이지
```

#### 대시보드

* 담당 어르신 현황
* 우선 확인 대상
* 방문·상담 일정
* 기간이 지난 업무
* 긴급 확인 업무

#### 리콜 제품 조치 관리

리콜이 확인된 제품에 대해 실제 업무 흐름을 관리합니다.

```text
접수
 ↓
담당자 배정
 ↓
연락 시도
 ↓
대상자 확인 / 일정 예약
 ↓
기관 연계
 ↓
조치 완료
 ↓
보호자 통보
```

백엔드 상태값

```text
RECEIVED
→ ASSIGNED
→ CONTACTING
→ CONFIRMED / SCHEDULED
→ REFERRED
→ COMPLETED
→ GUARDIAN_NOTIFIED
```

단계별 저장 정보

* 담당 복지사
* 조치 유형
* 연락 대상
* 연락 방법
* 연락 결과
* 제품 사용 상태
* 방문·상담 일정
* 연계 기관
* 다음 조치일
* 완료 결과
* 완료 근거
* 보호자 통보 정보
* 내부 메모

---

## 제품 라벨 OCR 연동

보호자 웹에서 제품 라벨 사진을 촬영하거나 업로드하면 Document AI Backend로 전달합니다.

```text
보호자 웹
   ↓
제품 이미지 선택
   ↓
Document AI FastAPI
   ↓
Google Cloud Vision
   ↓
OCR Text
   ↓
제품 정보 추출
   ↓
React 분석 결과 표시
   ↓
사용자 확인 / 수정
   ↓
Spring Boot 제품 등록
```

추출 대상

* 제품명
* 브랜드
* 제조사
* 모델번호
* 인증번호

분석 결과가 충분하지 않은 경우 직접 입력 방식으로 전환 가능

---

## AI 안부 기능

보호자 화면에서 어르신에게 안부 요청을 전송하고 응답 상태를 확인할 수 있습니다.

```text
보호자 웹
   ↓
Spring Boot
   ↓
안부 요청 생성
   ↓
어르신 앱
   ↓
응답 / 미응답
   ↓
Spring Boot
   ↓
AI 분석
   ↓
보호자·복지사 웹 표시
```

주요 분석 정보

* 최근 요청 수
* 응답 수
* 미응답 수
* 응답률
* 평균 응답시간
* 연속 미응답 횟수
* 최근 응답 상태

---

## 권한 처리

사용자 역할에 따라 접근 가능한 화면과 API를 분리합니다.

```text
GUARDIAN
→ 연결된 어르신 정보 조회
→ 제품 등록
→ 후속조치 상태 조회

WELFARE_WORKER
→ 담당 어르신 정보 조회
→ 복지 관리
→ 리콜 후속조치 수행
```

사용자의 ID를 프론트엔드에서 임의로 전달하여 권한을 판단하지 않고, 백엔드에서는 JWT 인증 사용자 정보를 기준으로 최종 권한을 확인합니다.

---

## 디렉터리 구조

실제 파일 구성에 따라 일부 세부 폴더는 다를 수 있습니다.

```text
woori_link_react/
├─ public/
│
├─ src/
│  ├─ api/
│  │  ├─ guardianApi.js
│  │  ├─ recallApi.js
│  │  ├─ documentAiApi.js
│  │  └─ ...
│  │
│  ├─ components/
│  │  └─ 공통 UI 컴포넌트
│  │
│  ├─ css/
│  │  ├─ guardian/
│  │  └─ welfare/
│  │
│  ├─ pages/
│  │  ├─ guardian/
│  │  └─ welfare/
│  │
│  ├─ utils/
│  │  └─ imageCompression.js
│  │
│  ├─ App.jsx
│  └─ main.jsx
│
├─ .env
├─ package.json
├─ vite.config.js
└─ README.md
```

---

## 로컬 실행

Windows PowerShell 기준

### 1. 프로젝트 이동

```powershell
cd C:\github\nuri\woori_link\woori_link_react
```

### 2. 패키지 설치

```powershell
npm install
```

### 3. 개발 서버 실행

```powershell
npm run dev
```

기본 개발 주소

```text
http://localhost:5173
```

---

## Production Build

```powershell
npm run build
```

빌드 결과

```text
dist/
```

배포 전 `npm run build` 실행을 통해 JSX 및 CSS 오류 확인 권장

---

## 환경변수

로컬과 배포 환경의 API 주소를 환경변수로 분리합니다.

예시

```env
VITE_SPRING_API_BASE_URL=http://127.0.0.1:8090/api
VITE_DOCUMENT_AI_BASE_URL=http://127.0.0.1:8002/api
VITE_AI_API_BASE_URL=http://127.0.0.1:8001/api
```

배포 환경에서는 각 백엔드의 실제 HTTPS 주소를 사용합니다.

```env
VITE_SPRING_API_BASE_URL=https://woori-spring-backend.onrender.com/api
VITE_DOCUMENT_AI_BASE_URL=https://woori-document-ai-backend.onrender.com/api
```

API Key 또는 인증 Secret은 React 클라이언트 코드에 직접 포함하지 않습니다.

---

## 배포

Frontend는 Vercel을 통해 배포합니다.

### 보호자 서비스

```text
https://woori-link-react.vercel.app/guardian/login
```

### 복지사 서비스

```text
https://woori-link-react.vercel.app/welfare/login
```

배포 브랜치

```text
yuna
```

GitHub에 새로운 Commit을 Push하면 연결된 Vercel 프로젝트에서 자동 배포됩니다.

---

## Backend

### Spring Boot

로컬

```text
http://127.0.0.1:8090/api
```

배포

```text
https://woori-spring-backend.onrender.com/api
```

### AI / RAG

로컬

```text
http://127.0.0.1:8001/api
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

---

## 주요 API 모듈

### `guardianApi.js`

보호자 관련 API 관리

주요 역할

* 연결된 어르신 조회
* 보호자 정보 조회
* 어르신 관련 상태 조회
* 보호자용 기능 연동

---

### `recallApi.js`

리콜 제품 및 후속조치 API 관리

주요 역할

* 리콜 제품 목록 조회
* 상세 조회
* 후속조치 생성
* 후속조치 상태 변경
* 상세 기록 수정
* 처리 이력 조회

---

### `documentAiApi.js`

제품 라벨 OCR 서버 연동

주요 역할

* 제품 이미지 업로드
* OCR 분석 요청
* 분석 결과 확인
* 사용자 수정 결과 저장

---

## 이미지 처리

제품 라벨 이미지는 서버 전송 전 필요에 따라 클라이언트에서 압축합니다.

관련 파일

```text
src/utils/imageCompression.js
```

목적

* 과도한 이미지 용량 감소
* 업로드 시간 단축
* OCR 서버 요청 안정성 개선
* 모바일 촬영 이미지 처리

---

## 개발 중 해결한 문제

### 역할별 API 권한 처리

문제

* 프론트엔드에서 전달하는 사용자 ID만 기준으로 API를 처리할 경우 다른 사용자 데이터 접근 가능성 존재

개선

* 사용자 역할별 API 분리
* JWT 인증 사용자 기준으로 백엔드 권한 검증
* 보호자·복지사별 접근 가능 범위 구분

---

### 리콜 후속조치 UI

문제

* 복지사의 실제 업무 흐름을 하나의 긴 폼으로 구성할 경우 현재 수행해야 하는 업무 파악이 어려움

개선

* 현재 상태에 필요한 입력 항목만 노출
* 상태별 선택 가능한 다음 단계 제한
* 접수부터 보호자 통보까지 단계별 처리
* 저장 후 상세·목록·처리 이력 즉시 갱신

---

### 제품 OCR 등록

문제

* OCR 분석 결과가 항상 완전하지 않아 자동 분석만으로 제품 등록을 완료하기 어려움

개선

* OCR 분석 결과 사용자 확인 단계 추가
* 부족한 필드 표시
* 분석 실패 또는 필드 부족 시 직접 입력 방식 제공
* OCR 결과를 최종값으로 바로 저장하지 않도록 구성

---

### 로컬 / 배포 API 연결

문제

* 로컬 API 주소를 배포 React에서 사용할 경우 API 연결 실패
* Vercel과 Render 간 CORS 문제 발생

개선

* 환경변수 기반 API 주소 관리
* 로컬·배포 URL 분리
* Document AI CORS 허용 Origin 관리
* Vercel 및 Render 환경 설정 정리

---

## 관련 프로젝트

* [WOORI Link](../README.md)
* [Flutter App](../woori_link_flutter/)
* [Spring Backend](../woori_link_spring/)
* [AI Backend](../../ai_backend/)
* [Document AI Backend](../../document_ai_backend/)

---

## 역할

`woori_link_react`는 WOORI Link 시스템의 보호자·복지사 클라이언트 역할을 담당합니다.

```text
보호자 / 복지사
       ↓
    React Web
       ↓
    Spring Boot
     ↙       ↘
PostgreSQL   FastAPI
               ↓
       AI / Document AI
```

사용자가 단순히 정보를 조회하는 화면에 그치지 않고, 보호자의 상태 확인과 복지사의 실제 후속 업무가 백엔드 데이터 흐름과 연결되도록 구성한 웹 프론트엔드입니다.
