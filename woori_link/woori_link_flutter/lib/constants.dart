import 'package:flutter/foundation.dart';

const String baseUrl = kIsWeb
    ? 'http://localhost:8090/api'
    : 'http://127.0.0.1:8090/api';

// Fall-detection FastAPI server used by camera and phone sensor ensemble.
const String fallServerBaseUrl = kIsWeb
    ? 'http://localhost:8000'
    : 'http://127.0.0.1:8000';

// 낙상 모델(fall-detection) 서버 — 카메라+폰 센서 앙상블이 도는 FastAPI 서버.
const String _configuredFallServerBaseUrl =
    String.fromEnvironment('FALL_SERVER_BASE_URL');
final String fallServerBaseUrl = _configuredFallServerBaseUrl.isNotEmpty
    ? _configuredFallServerBaseUrl
    : (kIsWeb ? 'http://localhost:8000' : 'http://10.0.2.2:8000');

const String fallDeviceId = String.fromEnvironment(
  'FALL_DEVICE_ID',
  defaultValue: 'woori-link-phone',
);

