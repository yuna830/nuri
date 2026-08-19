# woori_link_spring — WOORI Link Spring Boot Backend

고령 취약계층 통합 돌봄 플랫폼 **WOORI Link**의 메인 백엔드 서버입니다.

보호자·복지사·어르신 서비스에서 사용하는 핵심 API를 제공하며,
사용자 인증 및 권한 관리, 어르신 상태 관리, 위치·안부·복지 정보, 리콜 제품 관리, 후속조치 워크플로 등을 처리합니다.

React 웹과 Flutter 앱의 공통 백엔드 역할을 담당하며,
AI Backend 및 Document AI Backend와 연동하여 AI 분석과 OCR 기능을 서비스 흐름에 연결합니다.

---

## 주요 역할

* 사용자 인증 및 JWT 발급
* 역할별 접근 권한 검증
* 보호자·어르신 연결 관계 관리
* 복지사 담당 대상자 관리
* 어르신 위치 및 안전 상태 관리
* AI 안부 요청 및 응답 이력 관리
* 복지 및 에너지 지원 데이터 관리
* 제품 등록 및 리콜 여부 관리
* 리콜 제품 후속조치 워크플로 관리
* 보호자용 후속조치 상태 조회
* 알림 및 후속조치 이력 관리
* PostgreSQL 데이터 저장 및 조회
* FastAPI 기반 AI 서버 연동

---

## 기술 스택

| 역할                | 기술                         |
| ----------------- | -------------------------- |
| Framework         | Spring Boot                |
| Language          | Java                       |
| Security          | Spring Security, JWT       |
| ORM               | Spring Data JPA, Hibernate |
| Database          | PostgreSQL                 |
| Migration         | DB Migration Script        |
| External API      | REST API                   |
| AI Integration    | FastAPI                    |
| Push Notification | FCM                        |
| Deployment        | Render                     |

---

## 시스템 구조

```text
┌─────────────────────┐
│     Flutter App     │
│       어르신         │
└──────────┬──────────┘
           │
           │ REST API
           ▼
┌─────────────────────┐
│                     │
│     Spring Boot     │
│    Main Backend     │
│                     │
└──────────┬──────────┘
           │
           ├─────────────────────┐
           │                     │
           ▼                     ▼
┌─────────────────────┐   ┌─────────────────────┐
│     PostgreSQL      │   │    FastAPI Backend  │
│                     │   │   AI / Document AI  │
└─────────────────────┘   └─────────────────────┘
           ▲
           │
           │ REST API
┌──────────┴──────────┐
│      React Web      │
│ 보호자 / 복지사 웹  │
└─────────────────────┘
```

---

## 사용자 역할

WOORI Link는 사용자 역할에 따라 접근 가능한 기능을 분리합니다.

### GUARDIAN

보호자

주요 권한

* 연결된 어르신 조회
* 어르신 위치 및 안전 상태 조회
* 안부 요청 및 응답 상태 조회
* 제품 등록
* 리콜 제품 조회
* 리콜 제품 실제 사용자 변경
* 복지사 후속조치 진행 상태 조회

---

### WELFARE_WORKER

복지사

주요 권한

* 담당 어르신 조회
* 대상자 위험도 확인
* 복지 지원 업무 관리
* 에너지 복지 관리
* 리콜 제품 후속조치 수행
* 후속조치 상태 변경
* 처리 이력 관리

---

### SENIOR

어르신

주요 권한

* 본인 정보 조회
* 안부 요청 확인 및 응답
* 위치 정보 전송
* 어르신용 서비스 이용

---

## 인증 및 권한 검증

Spring Security와 JWT를 기반으로 인증 및 권한을 관리합니다.

기본 흐름

```text
로그인
  ↓
계정 검증
  ↓
JWT 발급
  ↓
Client 저장
  ↓
Authorization Header
  ↓
JWT 인증 필터
  ↓
AuthenticatedUser 생성
  ↓
Controller / Service 권한 검증
```

API 요청 예시

```http
Authorization: Bearer <ACCESS_TOKEN>
```

---

## 권한 검증 원칙

클라이언트에서 전달한 `userId`, `guardianId`, `welfareWorkerId` 값을
그대로 신뢰하지 않고 JWT 인증 사용자 정보를 기준으로 실제 권한을 검증합니다.

예:

```text
보호자 요청
   ↓
JWT userId 확인
   ↓
어르신 guardianId 비교
   ↓
일치
   ↓
조회 허용
```

이를 통해 다른 사용자의 ID를 임의로 전달하여
타 사용자의 데이터를 조회하거나 수정하는 문제를 방지합니다.

---

## 주요 도메인

### 사용자

* 보호자
* 복지사
* 어르신
* 역할별 인증 및 권한 관리

---

### 어르신 관리

* 어르신 기본 정보
* 보호자 연결 관계
* 복지사 담당 관계
* 위치 정보
* 안전 관련 상태
* 위험도 정보

---

### 안부 관리

* 안부 요청 생성
* 어르신 응답 저장
* 미응답 처리
* 최근 응답 상태 관리
* AI 분석 결과 연동

안부 데이터는 AI Backend 분석에 활용됩니다.

```text
안부 요청
  ↓
응답 / 미응답
  ↓
Spring Boot 이력 저장
  ↓
AI Backend 분석
  ↓
위험 수준 반환
  ↓
보호자·복지사 화면 표시
```

---

## 리콜 제품 관리

사용자가 등록한 제품의 리콜 상태와
실제 후속조치 과정을 관리합니다.

주요 데이터

* 제품명
* 제조사
* 모델번호
* 인증번호
* 실제 사용자
* 리콜 상태
* 공식 공고 정보
* 후속조치 상태
* 담당 복지사
* 다음 조치일

---

## 리콜 후속조치 워크플로

복지사의 실제 업무 흐름을 상태 기반으로 관리합니다.

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

화면 기준

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

---

## 상태 전환 검증

모든 상태를 자유롭게 변경할 수 없도록
현재 상태에 따라 허용 가능한 다음 상태를 제한합니다.

예시

```text
RECEIVED
→ ASSIGNED

ASSIGNED
→ CONTACTING

CONTACTING
→ CONFIRMED
→ SCHEDULED

CONFIRMED
→ SCHEDULED
→ REFERRED
→ COMPLETED

SCHEDULED
→ CONFIRMED
→ REFERRED
→ COMPLETED

REFERRED
→ COMPLETED

COMPLETED
→ GUARDIAN_NOTIFIED
```

예를 들어 다음과 같은 직접 전환은 허용하지 않습니다.

```text
RECEIVED → COMPLETED
```

상태 전환 검증은 프론트엔드뿐만 아니라
백엔드 Service에서도 수행합니다.

---

## 후속조치 저장 정보

각 처리 단계에서 다음 정보를 저장합니다.

### 담당자 배정

* 담당 복지사
* 배정 시각
* 조치 유형
* 다음 조치일
* 내부 메모

### 연락 시도

* 연락 대상
* 연락 방법
* 연락 결과
* 연락 시각
* 연락 메모

### 대상자 확인

* 현재 제품 사용 상태
* 확인 시각
* 확인 메모

### 일정 예약

* 일정 일시
* 일정 유형
* 장소
* 일정 메모

### 기관 연계

* 연계 기관
* 기관 담당자
* 연락처
* 연계 시각
* 연계 메모

### 조치 완료

* 최종 처리 결과
* 완료 시각
* 완료 근거
* 완료 메모

### 보호자 통보

* 통보 방법
* 통보 시각
* 통보 내용

---

## 처리 이력

후속조치 변경 시 변경 이력을 별도로 저장하여
처리 과정을 추적할 수 있도록 구성합니다.

```text
상태 변경
   ↓
후속조치 데이터 저장
   ↓
History 생성
   ↓
변경 시각
변경 사용자
이전 상태
변경 상태
변경 메모
저장
```

복지사 웹에서는 해당 이력을 타임라인 형태로 조회할 수 있습니다.

---

## 다음 조치일 관리

후속조치 진행 중인 업무에는 `nextActionDate`를 저장하여
복지사가 다음에 처리해야 할 날짜를 관리할 수 있도록 구성합니다.

완료 상태에서는 다음 조치일을 제거합니다.

```text
COMPLETED
→ nextActionDate = null
```

---

## 보호자용 후속조치 조회

복지사가 사용하는 내부 업무 정보와
보호자에게 공개할 정보를 분리합니다.

보호자는 자신의 어르신과 연결된 제품에 대해서만
후속조치 진행 상태를 조회할 수 있습니다.

권한 검증 예시

```text
JWT 보호자 ID
      ↓
제품 seniorId 조회
      ↓
Senior.guardianId 확인
      ↓
일치 여부 검증
      ↓
진행 상태 조회
```

복지사 내부 메모나 불필요한 담당자 정보는
보호자용 응답에서 제외할 수 있도록 응답 DTO를 분리합니다.

---

## 리콜 제품 실제 사용자 변경

보호자가 제품의 실제 사용자를 잘못 등록한 경우
본인에게 연결된 다른 어르신으로 변경할 수 있습니다.

검증 조건

* 현재 로그인 사용자가 보호자
* 기존 제품 사용자가 해당 보호자와 연결된 어르신
* 변경 대상 역시 동일 보호자와 연결된 어르신

다른 보호자의 어르신으로 변경하는 것은 허용하지 않습니다.

---

## 복지 관리

복지사 업무에서 대상자의 복지 지원 상태를 관리합니다.

주요 기능

* 지원 대상 확인
* 에너지 바우처 관리
* 전기 지원 관리
* 가스 지원 관리
* 신청 정보 관리
* 지원 상태 관리
* 중복 지원 여부 확인

---

## 에너지 복지

대상자의 상세 정보와 기존 지원 상태를 기반으로
지원 가능 여부를 판단하고 관리합니다.

주요 데이터

* 신청 연도
* 신청 여부
* 지원 결과
* 누락 정보
* 지원 가능성
* 중복 지원 정보
* 추가 확인 필요 항목

---

## AI Backend 연동

Spring Boot는 필요한 경우 FastAPI AI Backend와 연동합니다.

AI Backend 주요 기능

* AI 안부 분석
* 복지 RAG
* 복지 정보 추천

구조

```text
Spring Boot
    ↓
FastAPI
    ↓
AI / RAG
    ↓
분석 결과
    ↓
Spring Boot
    ↓
React / Flutter
```

---

## Document AI 연동

제품 라벨 OCR 자체는 Document AI FastAPI에서 수행합니다.

```text
React
   ↓
Document AI Backend
   ↓
Google Cloud Vision
   ↓
OCR 결과
   ↓
React 사용자 확인
   ↓
Spring Boot
   ↓
제품 등록
```

Spring Boot는 사용자가 최종 확인한 제품 정보를
DB에 저장하고 리콜 조회 및 후속조치 관리에 활용합니다.

---

## FCM 알림

필요한 상황에서 FCM을 통해 사용자에게 알림을 전달합니다.

활용 예

* 안부 확인 요청
* 중요 상태 변경
* 후속조치 관련 안내
* 보호자 알림

---

## 디렉터리 구조

실제 클래스 구성에 따라 일부 세부 파일은 다를 수 있습니다.

```text
woori_link_spring/
├─ src/
│  ├─ main/
│  │  ├─ java/
│  │  │  └─ com/nuri/woorilink/
│  │  │
│  │  │     ├─ common/
│  │  │     │  └─ security/
│  │  │     │
│  │  │     ├─ controller/
│  │  │     │
│  │  │     ├─ dto/
│  │  │     │
│  │  │     ├─ entity/
│  │  │     │
│  │  │     ├─ repository/
│  │  │     │
│  │  │     ├─ service/
│  │  │     │
│  │  │     └─ WooriLinkApplication.java
│  │  │
│  │  └─ resources/
│  │     ├─ application.properties
│  │     └─ db/
│  │
│  └─ test/
│
├─ build.gradle / pom.xml
└─ README.md
```

---

## 주요 Controller

### Guardian

보호자 관련 기능

```text
GuardianController
GuardianRecallFollowUpController
```

주요 역할

* 보호자 데이터 조회
* 보호자 연결 어르신 확인
* 리콜 후속조치 공개 상태 조회

---

### Senior

```text
SeniorController
```

주요 역할

* 어르신 조회
* 보호자 연결 어르신 조회
* 복지사 담당 대상 조회

---

### Product Recall

```text
ProductRecallController
```

주요 역할

* 제품 등록
* 제품 조회
* 리콜 상태 관리
* 제품 실제 사용자 변경

---

### Recall Follow-Up

```text
RecallFollowUpController
```

주요 역할

* 후속조치 생성
* 상세 조회
* 상태 변경
* 처리 기록 수정
* 처리 이력 조회

---

## 로컬 실행

Windows PowerShell 기준

### 1. 프로젝트 이동

```powershell
cd C:\github\nuri\woori_link\woori_link_spring
```

---

### 2. 서버 실행

Gradle Wrapper가 있는 경우

```powershell
.\gradlew.bat bootRun
```

Maven Wrapper가 있는 경우

```powershell
.\mvnw.cmd spring-boot:run
```

---

### 로컬 주소

```text
http://127.0.0.1:8090
```

API Base URL

```text
http://127.0.0.1:8090/api
```

---

## Build

### Gradle

```powershell
.\gradlew.bat clean build -x test
```

### Maven

```powershell
.\mvnw.cmd clean package -DskipTests
```

사용 중인 Build Tool에 해당하는 명령만 실행합니다.

---

## 환경변수

민감 정보와 환경별 설정은 환경변수로 관리합니다.

예시

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://...
SPRING_DATASOURCE_USERNAME=...
SPRING_DATASOURCE_PASSWORD=...

JWT_SECRET=...

AI_BACKEND_URL=http://127.0.0.1:8001/api
DOCUMENT_AI_BASE_URL=http://127.0.0.1:8002/api
```

배포 환경에서는 로컬 주소 대신 실제 HTTPS 주소를 사용합니다.

---

## PostgreSQL

주요 데이터

```text
사용자
보호자
복지사
어르신
위치
안부 요청
복지 지원
등록 제품
리콜 상태
후속조치
후속조치 이력
알림
```

---

## 배포

Spring Backend는 Render를 통해 배포합니다.

배포 URL

```text
https://woori-spring-backend.onrender.com
```

API Base URL

```text
https://woori-spring-backend.onrender.com/api
```

배포 브랜치

```text
yuna
```

GitHub의 `yuna` 브랜치에 새로운 Commit이 Push되면
연결된 Render 서비스에서 자동 배포됩니다.

---

## 개발 / 배포 환경

### Local

```text
React
↓
http://127.0.0.1:8090/api
↓
Spring Boot
```

### Production

```text
Vercel
↓
https://woori-spring-backend.onrender.com/api
↓
Spring Boot
```

환경별 API 주소와 인증정보를 분리하여 관리합니다.

---

## 보안 원칙

* JWT 기반 사용자 인증
* 역할별 API 접근 제한
* 사용자 관계 기반 데이터 접근 검증
* 클라이언트에서 전달한 사용자 ID를 최종 권한 판단에 사용하지 않음
* DB 비밀번호 및 JWT Secret Git 제외
* 외부 서비스 인증정보 환경변수 관리
* 보호자 공개 정보와 복지사 내부 정보 분리
* 비정상적인 후속조치 상태 전환 서버 차단

---

## 주요 문제 해결

### 사용자 ID 기반 권한 검증 문제

기존 문제

* 클라이언트에서 전달한 보호자·복지사 ID만 신뢰할 경우 사용자 ID 조작 가능

개선

* JWT의 `AuthenticatedUser` 기준 권한 확인
* 대상자 관계를 DB에서 추가 검증
* 역할에 따른 API 접근 범위 분리

---

### 후속조치 상태 무결성

기존 문제

* 프론트엔드만 상태 전환을 제한할 경우 API 직접 호출로 잘못된 상태 변경 가능

개선

* Service 계층에서도 허용 상태 전환 검증
* 비정상 상태 이동 차단
* 변경 이력 저장

---

### 로컬 / 배포 환경 연결

기존 문제

* 로컬 주소를 배포 서버에서 호출하여 연결 실패
* `127.0.0.1`이 배포 컨테이너 자체를 가리키는 문제

개선

* 환경변수 기반 서버 URL 관리
* Local / Production 설정 분리
* Render 환경변수로 배포 API 주소 관리

---

## 관련 프로젝트

* [WOORI Link](../README.md)
* [React Web](../woori_link_react/)
* [Flutter App](../woori_link_flutter/)
* [AI Backend](../../ai_backend/)
* [Document AI Backend](../../document_ai_backend/)

---

## 역할

`woori_link_spring`은 WOORI Link 시스템의 핵심 백엔드 역할을 담당합니다.

```text
Flutter / React
       ↓
   Spring Boot
       ↓
 ┌─────┼─────────────┐
 ↓     ↓             ↓
DB   권한 검증    업무 워크플로
       ↓
   AI Backend 연동
```

단순 CRUD API 서버가 아니라
사용자별 권한, 돌봄 데이터, 복지 업무, 리콜 후속조치 등
서비스의 핵심 비즈니스 흐름을 관리하는 중앙 서버입니다.
