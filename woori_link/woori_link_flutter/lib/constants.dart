import 'package:flutter/foundation.dart';

const String baseUrl = kIsWeb
    ? 'http://localhost:8090/api'
    : 'http://127.0.0.1:8090/api';

// Fall-detection FastAPI server used by camera and phone sensor ensemble.
const String fallServerBaseUrl = kIsWeb
    ? 'http://localhost:8000'
    : 'http://127.0.0.1:8000';
