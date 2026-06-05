// 안드로이드 에뮬레이터에서 PC 로컬 서버 접근 시 10.0.2.2 사용
// 실제 기기 or 웹이면 --dart-define=API_BASE_URL=http://192.168.0.12:8080 으로 오버라이드
import 'package:flutter_dotenv/flutter_dotenv.dart';

String get apiBaseUrl {
  return dotenv.env['API_BASE_URL'] ?? 'http://10.0.2.2:8080';
}

String get kakaoNativeAppKey {
  return dotenv.env['KAKAO_NATIVE_APP_KEY'] ?? '';
}

String get fallServerBaseUrl {
  return dotenv.env['FALL_API_BASE_URL'] ?? 'http://10.0.2.2:8000';
}

String get kakaoJavaScriptKey {
  return dotenv.env['KAKAO_JAVASCRIPT_KEY'] ?? '';
}
