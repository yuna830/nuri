import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';

class AuthApi {
  static Future<Map<String, dynamic>> login(String phone, String password) async {
    final res = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phone, 'password': password}),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    final body = jsonDecode(res.body);
    throw Exception(body['message'] ?? '로그인에 실패했습니다.');
  }
}
