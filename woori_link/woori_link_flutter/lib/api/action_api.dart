import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'http_client.dart';

class ActionApi {
  static Future<List<dynamic>> getActionsBySenior(int seniorId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/actions/senior/$seniorId'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200) return jsonDecode(utf8.decode(res.bodyBytes));
    return [];
  }

  static Future<Map<String, dynamic>> createAction(Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('$baseUrl/actions'),
      headers: await authHeaders(),
      body: jsonEncode(body),
    );

    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(utf8.decode(res.bodyBytes));
    }

    throw Exception(
      '조치 요청 실패 (${res.statusCode}): ${utf8.decode(res.bodyBytes)}',
    );
  }

  static Future<void> completeAction(int actionId) async {
    final res = await http.patch(
      Uri.parse('$baseUrl/actions/$actionId/status?status=COMPLETED'),
      headers: await authHeaders(),
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw Exception(
        '조치 완료 처리 실패 (${res.statusCode}): ${utf8.decode(res.bodyBytes)}',
      );
    }
  }
}