import '../services/auth_service.dart';

Future<Map<String, String>> authHeaders() async {
  final token = await AuthService.getToken();
  return {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };
}
