import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  /// API 베이스 URL
  /// 우선순위: .env > --dart-define > 기본값 (에뮬레이터: 10.0.2.2)
  static String get apiBaseUrl =>
      ((dotenv.env['API_BASE_URL'] ??
              const String.fromEnvironment(
                'API_BASE_URL',
                defaultValue: 'http://10.0.2.2:8080/api',
              )))
          .trim();
}
