import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'http_client.dart';

class SeniorApi {
  static String _connectionMessage() {
    return '서버에 연결하지 못했습니다. 서버가 켜져 있는지와 API 주소($baseUrl)를 확인해 주세요.';
  }

  static Future<Map<String, dynamic>> getSenior(int id) async {
    late final http.Response res;
    try {
      res = await http.get(
        Uri.parse('$baseUrl/seniors/$id'),
        headers: await authHeaders(),
      );
    } on http.ClientException {
      throw Exception(_connectionMessage());
    }
    if (res.statusCode == 200) return jsonDecode(utf8.decode(res.bodyBytes));
    throw Exception('님 정보 조회 실패');
  }

  static Future<Map<String, dynamic>> updateSenior(
      int id, Map<String, dynamic> body) async {
    late final http.Response res;
    try {
      res = await http.patch(
        Uri.parse('$baseUrl/seniors/$id'),
        headers: await authHeaders(),
        body: jsonEncode(body),
      );
    } on http.ClientException {
      throw Exception(_connectionMessage());
    }
    if (res.statusCode == 200) return jsonDecode(utf8.decode(res.bodyBytes));
    throw Exception('님 정보 수정 실패');
  }
}
