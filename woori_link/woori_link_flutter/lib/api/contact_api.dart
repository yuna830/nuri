import 'dart:convert';

import 'package:http/http.dart' as http;

import '../constants.dart';
import 'http_client.dart';

class ContactApi {
  static Future<Map<String, dynamic>?> getGuardian(int? id) async {
    if (id == null) return null;
    final res = await http.get(
      Uri.parse('$baseUrl/guardians/$id'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200) {
      return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    }
    return null;
  }

  static Future<Map<String, dynamic>?> getWelfareWorker(int? id) async {
    if (id == null) return null;
    final res = await http.get(
      Uri.parse('$baseUrl/welfare-workers/$id'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200) {
      return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    }
    return null;
  }
}
