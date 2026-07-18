import 'package:flutter/foundation.dart';

const String baseUrl = kIsWeb
    ? 'http://localhost:8090/api'
    : 'http://10.0.2.2:8090/api';
    // : 'http://192.168.0.17:8090/api';

// 낙상 모델(fall-detection) 서버 — 카메라+폰 센서 앙상블이 도는 FastAPI 서버.
const String fallServerBaseUrl = kIsWeb
    ? 'http://localhost:8000'
    : 'http://192.168.0.17:8000';