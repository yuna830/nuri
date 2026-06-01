// 안드로이드 에뮬레이터에서 PC 로컬 서버 접근 시 10.0.2.2 사용
// 실제 기기 or 웹이면 --dart-define=API_BASE_URL=http://localhost:8080 으로 오버라이드
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8080',
);
