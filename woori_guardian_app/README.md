# woori_guardian_app

보호자가 어르신의 위치와 안전을 확인하고 복지 정보를 조회하는 Flutter 앱이다.

## 주요 기능

- 어르신 목록 조회, 추가, 상세 정보 확인
- 실시간 위치 확인 및 안전 반경 설정 (카카오맵)
- 얼굴 인식 카메라로 어르신 확인 (Google ML Kit + face_api 연동)
- AI 복지 챗봇 (RAG API 연동)
- FCM 푸시 알림 - 안전 반경 이탈, 동의 요청
- 실종 신고 접수

## 기술 스택

- Flutter 3 / Dart
- Firebase Cloud Messaging (FCM) - 푸시 알림
- Google ML Kit Face Detection - 얼굴 감지
- 카카오맵 SDK - 위치 지도
- flutter_dotenv - 환경변수 관리

## 연동 서버

| 서버 | 기본 주소 | 용도 |
|---|---|---|
| Spring (woorispring) | `http://10.0.2.2:8080/api` | 메인 백엔드 API |
| face_api (raspi-client) | `http://10.0.2.2:8000` | 얼굴 인식 서버 |
| RAG API (ai_backend) | `http://10.0.2.2:8001` | AI 복지 챗봇 |

> 실기기 테스트 시 `10.0.2.2` 대신 실제 서버 IP로 변경 필요

## 환경 설정

프로젝트 루트에 `.env` 파일을 생성한다.

```env
API_BASE_URL=http://10.0.2.2:8080/api
FACE_API_BASE_URL=http://10.0.2.2:8000
RAG_API_BASE_URL=http://10.0.2.2:8001
KAKAO_NATIVE_APP_KEY=카카오_네이티브_앱_키
KAKAO_REST_API_KEY=카카오_REST_API_키
```

Firebase 설정
FCM 푸시 알림을 사용하려면 Firebase 프로젝트에서 발급한 설정 파일이 필요하다.

Android: android/app/google-services.json
iOS: ios/Runner/GoogleService-Info.plist
두 파일 모두 .gitignore에 포함되어 있으므로 직접 추가해야 한다.

실행 방법
flutter pub get
flutter run
카카오맵을 비활성화하고 실행하려면:

flutter run --dart-define=DISABLE_KAKAO_MAP=true
프로젝트 구조
lib/
├── core/
│   ├── api/          # API 호출 (guardian_api.dart)
│   ├── config/       # 환경변수 설정 (app_config.dart)
│   ├── models/       # 데이터 모델 (senior, alert, safe_zone)
│   ├── push/         # FCM 서비스
│   ├── storage/      # 로컬 저장소 (SharedPreferences)
│   ├── theme/        # 앱 색상
│   └── widgets/      # 공통 위젯
└── features/
    ├── auth/         # 로그인
    ├── home/         # 홈 화면
    ├── senior/       # 어르신 목록/상세/추가
    ├── location/     # 위치 확인 (카카오맵)
    ├── face/         # 얼굴 인식 카메라
    ├── chat/         # AI 복지 챗봇
    ├── notification/ # 알림 목록/설정
    ├── report/       # 실종 신고
    ├── contact/      # 어르신 연락
    └── mypage/       # 마이페이지, 동의 관리
