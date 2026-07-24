const String _configuredApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
);

final String baseUrl = _requiredUrl(
  _configuredApiBaseUrl,
  'API_BASE_URL',
);

// 낙상 모델(fall-detection) 서버
// 카메라 + 휴대폰 센서 앙상블이 동작하는 FastAPI 서버.
const String _configuredFallServerBaseUrl = String.fromEnvironment(
  'FALL_SERVER_BASE_URL',
);

final String fallServerBaseUrl = _requiredUrl(
  _configuredFallServerBaseUrl,
  'FALL_SERVER_BASE_URL',
);

const String fallDeviceId = String.fromEnvironment(
  'FALL_DEVICE_ID',
  defaultValue: 'woori-link-phone',
);

String _requiredUrl(String value, String name) {
  final normalized = value.trim().replaceFirst(RegExp(r'/$'), '');

  if (normalized.isEmpty) {
    throw StateError(
      '$name must be provided with --dart-define.',
    );
  }

  return normalized;
}