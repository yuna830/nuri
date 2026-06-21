# woori_senior_app

어르신이 사용하는 Flutter 앱이다. 위치 전송, AI 복지 챗봇, 낙상 이력 확인, 일자리 조회 기능을 제공한다.

## 주요 기능

- 로그인 / 회원가입
- 홈 화면 - 날씨, 알림, 빠른 메뉴
- AI 복지 챗봇 (음성 입출력 지원, RAG API 연동)
- 실시간 위치 전송 - 백그라운드에서도 동작 (flutter_foreground_task)
- 낙상 감지 이력 조회
- 일자리 조회
- 카카오맵 기반 위치 화면
- FCM 푸시 알림

## 기술 스택

- Flutter 3 / Dart
- Firebase Cloud Messaging (FCM)
- 카카오맵 플러그인 (JavaScript Key 방식)
- flutter_foreground_task - 백그라운드 위치 전송
- speech_to_text + flutter_tts - 음성 입출력
- flutter_dotenv - 환경변수 관리

## 연동 서버

| 서버 | 기본 주소 | 용도 |
|---|---|---|
| Spring (woorispring) | `http://10.0.2.2:8080` | 메인 백엔드 API |
| 낙상 감지 서버 | `http://10.0.2.2:8000` | 낙상 이력 API |
| RAG API (ai_backend) | `http://10.0.2.2:8002` | AI 복지 챗봇 |

> 실기기 테스트 시 `10.0.2.2` 대신 실제 서버 IP로 변경 필요

## 환경 설정

프로젝트 루트에 `.env` 파일을 생성한다.

```env
API_BASE_URL=http://10.0.2.2:8080
FALL_API_BASE_URL=http://10.0.2.2:8000
CHAT_API_BASE_URL=http://10.0.2.2:8002
KAKAO_NATIVE_APP_KEY=YOUR_KAKAO_NATIVE_APP_KEY
KAKAO_JAVASCRIPT_KEY=YOUR_KAKAO_JAVASCRIPT_KEY
```

Firebase 설정
FCM 푸시 알림을 사용하려면 Firebase 프로젝트 설정 파일이 필요하다.

Android: android/app/google-services.json
iOS: ios/Runner/GoogleService-Info.plist
두 파일 모두 .gitignore에 포함되어 있으므로 직접 추가해야 한다.

실행 방법
```
flutter pub get
flutter run
```

카카오맵을 비활성화하고 실행하려면:
```
flutter run --dart-define=DISABLE_KAKAO_MAP=true
```

프로젝트 구조
```
lib/
├── core/
│   ├── api/          # API 호출 (senior_api.dart)
│   ├── config/       # 환경변수 설정 (app_config.dart)
│   ├── location/     # 백그라운드 위치 전송 서비스
│   ├── push/         # FCM 서비스
│   ├── storage/      # 로컬 저장소 (SharedPreferences)
│   └── widgets/      # 공통 위젯
└── features/
    ├── auth/         # 로그인 / 회원가입
    ├── home/         # 홈 화면
    ├── shell/        # 앱 탭 구조
    ├── chat/         # AI 복지 챗봇
    ├── fall/         # 낙상 이력
    ├── location/     # 위치 화면 (카카오맵)
    ├── weather/      # 날씨
    ├── job/          # 일자리 조회
    ├── profile/      # 프로필
    ├── settings/     # 설정
    └── notifications/ # 알림
```
