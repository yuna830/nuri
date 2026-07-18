import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'http_client.dart';

class SeniorApi {
  static Future<Map<String, dynamic>> getSenior(int id) async {
    final res = await http.get(
      Uri.parse('$baseUrl/seniors/$id'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200) return jsonDecode(utf8.decode(res.bodyBytes));
    throw Exception('어르신 정보 조회 실패');
  }

  static Future<Map<String, dynamic>> updateSenior(
      int id, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/seniors/$id'),
      headers: await authHeaders(),
      body: jsonEncode(body),
    );
    if (res.statusCode == 200) return jsonDecode(utf8.decode(res.bodyBytes));
    throw Exception('어르신 정보 수정 실패');
  }
}
