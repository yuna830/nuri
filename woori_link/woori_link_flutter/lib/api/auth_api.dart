import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';

class AuthApi {
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
