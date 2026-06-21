# woorireact

React + Vite 기반 웹 프론트엔드다. 어르신, 보호자, 복지사, 관리자 4개 역할을 하나의 앱에서 서빙한다.

## 주요 기능

| 역할 | 주요 화면 |
|---|---|
| 어르신 | 홈, 날씨, 낙상 이력, 위치, 일자리, 프로필, AI 챗봇 |
| 보호자 | 담당 어르신 현황, 위치 확인, 긴급 알림 |
| 복지사 | 대시보드, 어르신 상세, 일자리 관리, 복지정책 챗봇 |
| 관리자 | 계정 관리, 어르신/보호자/복지사 목록 |

## 기술 스택

- React 19 / Vite
- React Router v7
- Bootstrap 5 + react-bootstrap
- Axios
- Kakao Map (JavaScript Key 방식)
- Leaflet / react-leaflet

## 연동 서버

| 서버 | 기본 주소 | 용도 |
|---|---|---|
| Spring (woorispring) | `http://localhost:8080` | 메인 백엔드 API |
| 낙상 감지 서버 | `http://127.0.0.1:8000` | 낙상 감지 API |
| Chat/STT/TTS 서버 | `http://127.0.0.1:8002` | 음성 챗봇 API |
| RAG API (ai_backend) | `http://localhost:8001` | AI 복지 챗봇 |
| 얼굴 인식 서버 | `http://localhost:8003` | 얼굴 인식 API |

## 환경 설정

`.env.example`을 복사해 `.env.local`을 생성한다.

```bash
cp .env.example .env.local

실행 방법

npm install
npm run dev
```

### 라우트 구조
```
/              # 어르신 로그인
/signup        # 어르신 회원가입
/user          # 어르신 홈
/weather       # 날씨
/fall-history  # 낙상 이력
/location      # 위치
/jobs          # 일자리
/profile       # 프로필
/chat          # AI 챗봇
/glogin        # 보호자 로그인
/gsignup       # 보호자 회원가입
/guardian      # 보호자 홈
/wlogin        # 복지사 로그인
/wsignup       # 복지사 회원가입
/welfare       # 복지사 대시보드
/welfare/policy-chat  # 복지정책 챗봇
/admin/login   # 관리자 로그인
/admin         # 관리자 대시보드
```
