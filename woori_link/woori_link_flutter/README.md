# woori_link_flutter — WOORI Link 어르신 앱

고령 취약계층 어르신이 일상생활에서 필요한 안전·안부·복지 기능을  
간단한 화면을 통해 이용할 수 있도록 구성한 Flutter 기반 모바일 앱입니다.

보호자·복지사 웹과 동일한 Spring Boot 백엔드를 사용하며,  
위치 정보, 안부 응답, 복지 정보 등 어르신 관련 데이터를 연동합니다.

---

## 주요 기능

### 안부 확인

- 보호자 또는 시스템에서 전달한 안부 요청 확인
- 어르신의 안전 여부 응답
- 응답 결과 Spring Boot 서버 저장
- 미응답 및 응답 시간 기반 상태 분석에 활용

---

### 위치 정보

- 현재 위치 정보 수집
- 보호자 웹의 위치 확인 기능과 연동
- 등록된 안전반경 기준 위치 상태 관리

---

### 복지 정보

- 어르신에게 필요한 복지 정보 확인
- AI / RAG 기반 복지정보 서비스 연동
- 복잡한 복지 정보를 모바일 환경에서 쉽게 확인할 수 있도록 구성

---

### 안전 관련 기능

- 어르신 상태 및 안전 관련 정보 확인
- 서버에서 전달되는 주요 알림 및 상태 정보 표시
- 보호자·복지사 서비스와 동일한 대상자 데이터를 기반으로 연동

---

## 기술 스택

| 역할 | 기술 |
| --- | --- |
| Mobile Framework | Flutter |
| Language | Dart |
| Main Backend | Spring Boot |
| AI Backend | FastAPI |
| Database | PostgreSQL |
| Authentication | JWT |
| Location | GPS / Location API |
| Device Test | Android / ADB |

---

## 시스템 연동

```text
┌──────────────────────┐
│      어르신 앱        │
│       Flutter        │
└──────────┬───────────┘
           │
           │ REST API
           ▼
┌──────────────────────┐
│     Spring Boot      │
│      Main API        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│      PostgreSQL      │
│    어르신 관련 데이터   │
└──────────────────────┘


Flutter App
     │
     │ 복지 / AI 요청
     ▼
FastAPI AI Backend
     │
     ├─ RAG
     ├─ Qdrant
     └─ Gemini / LLM
```

---

## 주요 데이터 흐름

### 안부 요청

```text
보호자 / 시스템
      ↓
Spring Boot
      ↓
어르신 Flutter 앱
      ↓
안부 응답
      ↓
Spring Boot
      ↓
응답 이력 저장
      ↓
AI 안부 분석
```

---

### 위치 정보

```text
Android GPS
    ↓
Flutter
    ↓
현재 위치 수집
    ↓
Spring Boot
    ↓
PostgreSQL
    ↓
보호자 웹
```

---

## 프로젝트 구조

실제 프로젝트 구조에 따라 일부 파일명은 다를 수 있습니다.

```text
woori_link_flutter/
├─ android/
├─ ios/
├─ lib/
│  ├─ api/
│  │  └─ API 통신
│  │
│  ├─ models/
│  │  └─ 데이터 모델
│  │
│  ├─ screens/
│  │  └─ 주요 화면
│  │
│  ├─ services/
│  │  └─ 위치·인증·API 서비스
│  │
│  ├─ widgets/
│  │  └─ 공통 UI 컴포넌트
│  │
│  └─ main.dart
│
├─ assets/
├─ pubspec.yaml
└─ README.md
```

---

## 로컬 실행

### 1. 프로젝트 이동

Windows PowerShell 기준:

```powershell
cd C:\github\nuri\woori_link\woori_link_flutter
```

---

### 2. 패키지 설치

```powershell
flutter pub get
```

---

### 3. 연결된 기기 확인

```powershell
adb devices
```

또는:

```powershell
flutter devices
```

---

### 4. 앱 실행

```powershell
flutter run
```

특정 Android 기기를 지정하는 경우:

```powershell
flutter run -d <DEVICE_ID>
```

---

## 로컬 API

### Spring Boot

```text
http://127.0.0.1:8090/api
```

### AI / RAG Backend

```text
http://127.0.0.1:8001/api
```

### 기기 연동 API

```text
http://127.0.0.1:8000/api
```

---

## 실제 Android 기기 연결

실제 Android 기기에서 `127.0.0.1`을 그대로 호출하면  
PC가 아니라 스마트폰 자기 자신을 가리키게 됩니다.

따라서 USB 연결 후 `adb reverse`를 사용합니다.

### Spring Boot

```powershell
adb reverse tcp:8090 tcp:8090
```

### AI / RAG Backend

```powershell
adb reverse tcp:8001 tcp:8001
```

### 기기 연동 서버

```powershell
adb reverse tcp:8000 tcp:8000
```

연결 상태 확인:

```powershell
adb reverse --list
```

예상 결과:

```text
tcp:8090 tcp:8090
tcp:8001 tcp:8001
tcp:8000 tcp:8000
```

---

## ADB Reverse 초기화

기존 reverse 설정을 모두 제거하려면:

```powershell
adb reverse --remove-all
```

다시 등록:

```powershell
adb reverse tcp:8090 tcp:8090
adb reverse tcp:8001 tcp:8001
adb reverse tcp:8000 tcp:8000
```

---

## 개발 환경 API 구성

로컬 개발 시:

```text
Flutter
   ↓
http://127.0.0.1:8090/api
   ↓
Spring Boot
```

실제 Android 기기에서도 `adb reverse`를 적용하면  
Flutter 코드의 `127.0.0.1` 주소를 유지한 채 PC에서 실행 중인 서버에 접근할 수 있습니다.

---

## 인증

Spring Boot에서 발급한 JWT를 이용하여 인증합니다.

주요 흐름:

```text
로그인
 ↓
Spring Boot
 ↓
JWT 발급
 ↓
Flutter 저장
 ↓
API 요청 시 Authorization Header 전달
```

예시:

```text
Authorization: Bearer <ACCESS_TOKEN>
```

---

## 개발 시 확인 사항

### Spring Boot 실행 여부

```text
http://127.0.0.1:8090
```

### AI Backend 실행 여부

```text
http://127.0.0.1:8001
```

### Android 기기 연결 여부

```powershell
adb devices
```

### ADB Reverse 확인

```powershell
adb reverse --list
```

---

## 빌드

### Android Debug APK

```powershell
flutter build apk --debug
```

### Android Release APK

```powershell
flutter build apk --release
```

빌드 결과는 일반적으로 다음 경로에 생성됩니다.

```text
build/app/outputs/flutter-apk/
```

---

## 관련 프로젝트

- [WOORI Link](../README.md)
- [React Web](../woori_link_react/)
- [Spring Backend](../woori_link_spring/)
- [AI Backend](../../ai_backend/)
- [Document AI Backend](../../document_ai_backend/)

---

## 역할

`woori_link_flutter`는 WOORI Link 시스템에서  
**어르신이 직접 사용하는 클라이언트 애플리케이션** 역할을 담당합니다.

```text
어르신
 ↓
Flutter App
 ↓
Spring Boot
 ↓
보호자 / 복지사와 데이터 공유
```

보호자와 복지사는 웹에서 대상자의 상태를 관리하고,  
어르신은 Flutter 앱을 통해 필요한 정보 확인 및 상태 응답을 수행하는 구조입니다.
