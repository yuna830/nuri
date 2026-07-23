import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';

class AuthApi {
  static String _connectionMessage() {
    return '서버에 연결하지 못했습니다. 서버가 켜져 있는지와 API 주소($baseUrl)를 확인해 주세요.';
  }


  static Future<void> register(
    String name,
    String phone,
    String inviteCode,
  ) async {
    late final http.Response res;
    try {
      res = await http.post(
        Uri.parse('$baseUrl/senior-auth/register'),
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: jsonEncode({
          'name': name,
          'phone': phone,
          'inviteCode': inviteCode,
        }),
      );
    } on http.ClientException {
      throw Exception(_connectionMessage());
    }

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
    late final http.Response res;
    try {
      res = await http.post(
        Uri.parse('$baseUrl/senior-auth/login'),
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: jsonEncode({'name': name, 'phone': phone}),
      );
    } on http.ClientException {
      throw Exception(_connectionMessage());
    }

    if (res.statusCode == 200) return jsonDecode(res.body);

    try {
      final body = jsonDecode(utf8.decode(res.bodyBytes));
      throw Exception(body['message'] ?? '로그인에 실패했습니다.');
    } catch (_) {
      throw Exception('로그인에 실패했습니다. (${res.statusCode})');
    }
  }
}
