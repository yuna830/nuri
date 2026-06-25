import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';

class SeniorApi {
  static Future<Map<String, dynamic>> getSenior(int id) async {
    final res = await http.get(Uri.parse('$baseUrl/seniors/$id'));
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('어르신 정보 조회 실패');
  }

  static Future<Map<String, dynamic>> updateSenior(
      int id, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/seniors/$id'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('어르신 정보 수정 실패');
  }
}
