import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';

class ActionApi {
  static Future<List<dynamic>> getActionsBySenior(int seniorId) async {
    final res =
        await http.get(Uri.parse('$baseUrl/actions/senior/$seniorId'));
    if (res.statusCode == 200) return jsonDecode(res.body);
    return [];
  }

  static Future<void> createAction(Map<String, dynamic> body) async {
    await http.post(
      Uri.parse('$baseUrl/actions'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
  }

  static Future<void> completeAction(int actionId) async {
    await http.patch(
      Uri.parse('$baseUrl/actions/$actionId/status'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'status': 'COMPLETED'}),
    );
  }
}
