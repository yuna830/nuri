import 'package:flutter/foundation.dart';

const String _configuredApiBaseUrl =
    String.fromEnvironment(
  'API_BASE_URL',
);

final String baseUrl =
    _configuredApiBaseUrl.isNotEmpty
        ? _configuredApiBaseUrl
        : (
            kIsWeb
                ? 'http://localhost:8090/api'
                : 'http://127.0.0.1:8090/api'
          );

const String _configuredFallServerBaseUrl =
    String.fromEnvironment(
  'FALL_SERVER_BASE_URL',
);

final String fallServerBaseUrl =
    _configuredFallServerBaseUrl.isNotEmpty
        ? _configuredFallServerBaseUrl
        : (
            kIsWeb
                ? 'http://localhost:8000'
                : 'http://127.0.0.1:8000'
          );

const String fallDeviceId =
    String.fromEnvironment(
  'FALL_DEVICE_ID',
  defaultValue: 'woori-link-phone',
);