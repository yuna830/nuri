import 'package:flutter/foundation.dart';

const String _configuredApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
);

final String baseUrl =
    _configuredApiBaseUrl.isNotEmpty
        ? _configuredApiBaseUrl
        : (
            kIsWeb
                ? 'http://localhost:8090/api'
                //: 'http://127.0.0.1:8090/api'
                // USB device dev: run `adb reverse tcp:8090 tcp:8090`.
                // Wi-Fi/device builds can override with --dart-define=API_BASE_URL=...
                : 'http://172.29.123.214:8090/api'
                //: 'http://10.0.2.2:8090/api'
          );
