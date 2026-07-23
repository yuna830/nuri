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
                : 'http://172.29.123.214:8090/api'
                //: 'http://10.0.2.2:8090/api'
          );


// 낙상 모델(fall-detection) 서버
// 카메라 + 휴대폰 센서 앙상블이 동작하는 FastAPI 서버.
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
                : 'http://172.29.123.214:8000'
                //: 'http://10.0.2.2:8000'
          );


const String fallDeviceId =
    String.fromEnvironment(
  'FALL_DEVICE_ID',
  defaultValue: 'woori-link-phone',
);
