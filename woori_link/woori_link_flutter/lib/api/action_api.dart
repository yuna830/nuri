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
    if (res.statusCode == 200) return jsonDecode(res.body);
    return [];
  }

  static Future<void> createAction(Map<String, dynamic> body) async {
    await http.post(
      Uri.parse('$baseUrl/actions'),
      headers: await authHeaders(),
      body: jsonEncode(body),
    );
  }

  static Future<void> completeAction(int actionId) async {
    await http.patch(
      Uri.parse('$baseUrl/actions/$actionId/status'),
      headers: await authHeaders(),
      body: jsonEncode({'status': 'COMPLETED'}),
    );
  }
}
