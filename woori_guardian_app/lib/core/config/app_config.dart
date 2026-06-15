import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  /// API 베이스 URL
  /// 우선순위: .env > --dart-define > 기본값
  static String get apiBaseUrl =>
      ((dotenv.env['API_BASE_URL'] ??
              const String.fromEnvironment(
                'API_BASE_URL',
                defaultValue: 'http://10.0.2.2:8080/api',
              )))
          .trim();

  /// 얼굴 인식 API 베이스 URL
  static String get faceApiBaseUrl =>
      ((dotenv.env['FACE_API_BASE_URL'] ??
              const String.fromEnvironment(
                'FACE_API_BASE_URL',
                defaultValue: 'http://10.0.2.2:8000',
              )))
          .trim();

  /// RAG / 경찰청 얼굴 비교 API 베이스 URL
  static String get ragApiBaseUrl =>
      ((dotenv.env['RAG_API_BASE_URL'] ??
              const String.fromEnvironment(
                'RAG_API_BASE_URL',
                defaultValue: 'http://10.0.2.2:8001',
              )))
          .trim();

  /// 카카오 Local REST API 키
  static String get kakaoRestApiKey =>
      ((dotenv.env['KAKAO_REST_API_KEY'] ??
              const String.fromEnvironment(
                'KAKAO_REST_API_KEY',
                defaultValue: '',
              )))
          .trim();
}