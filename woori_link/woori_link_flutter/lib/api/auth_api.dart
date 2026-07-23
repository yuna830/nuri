import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';

class AuthApi {
  static Future<void> register(
    String name,
    String phone,
    String inviteCode,
  ) async {
    final res = await http.post(
      Uri.parse('$baseUrl/senior-auth/register'),
      headers: {'Content-Type': 'application/json; charset=utf-8'},
      body: jsonEncode({
        'name': name,
        'phone': phone,
        'inviteCode': inviteCode,
      }),
    );

    if (res.statusCode >= 200 && res.statusCode < 300) return;

    try {
      final body = jsonDecode(utf8.decode(res.bodyBytes));
      throw Exception(body['message'] ?? '회원가입에 실패했습니다.');
    } catch (error) {
      if (error is Exception) rethrow;
      throw Exception('회원가입에 실패했습니다. (${res.statusCode})');
    }
  }

  static Future<Map<String, dynamic>> login(String name, String phone) async {
    final res = await http.post(
      Uri.parse('$baseUrl/senior-auth/login'),
      headers: {'Content-Type': 'application/json; charset=utf-8'},
      body: jsonEncode({'name': name, 'phone': phone}),
    );

    if (res.statusCode == 200) return jsonDecode(res.body);

    try {
      final body = jsonDecode(utf8.decode(res.bodyBytes));
      throw Exception(body['message'] ?? '로그인에 실패했습니다.');
    } catch (_) {
      throw Exception('로그인에 실패했습니다. (${res.statusCode})');
    }
  }
}
