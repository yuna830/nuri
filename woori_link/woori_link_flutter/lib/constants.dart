import 'package:flutter/foundation.dart';

const String _configuredApiBaseUrl = String.fromEnvironment('API_BASE_URL');
final String baseUrl = _configuredApiBaseUrl.isNotEmpty
    ? _configuredApiBaseUrl
    : (kIsWeb
        ? 'http://localhost:8090/api'
        // Android emulator uses 10.0.2.2 to reach the host machine.
        // Real USB device: use --dart-define=API_BASE_URL=http://127.0.0.1:8090/api
        // after adb reverse tcp:8090 tcp:8090.
        : 'http://10.0.2.2:8090/api');

// 낙상 모델(fall-detection) 서버 - 카메라+폰 센서 앙상블이 도는 FastAPI 서버.
const String _configuredFallServerBaseUrl =
    String.fromEnvironment('FALL_SERVER_BASE_URL');
final String fallServerBaseUrl = _configuredFallServerBaseUrl.isNotEmpty
    ? _configuredFallServerBaseUrl
    : (kIsWeb
        ? 'http://localhost:8000'
        // Android emulator uses 10.0.2.2 to reach the host machine.
        // Real USB device: use --dart-define=FALL_SERVER_BASE_URL=http://127.0.0.1:8000
        // after adb reverse tcp:8000 tcp:8000.
        : 'http://10.0.2.2:8000');

const String fallDeviceId = String.fromEnvironment(
  'FALL_DEVICE_ID',
  defaultValue: 'woori-link-phone',
);

