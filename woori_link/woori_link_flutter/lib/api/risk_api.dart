import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';

class RiskApi {
  static Future<Map<String, dynamic>?> getLatestRisk(int seniorId) async {
    final res =
        await http.get(Uri.parse('$baseUrl/risk/senior/$seniorId/latest'));
    if (res.statusCode == 200) return jsonDecode(res.body);
    return null;
  }

  static Future<Map<String, dynamic>> assessRisk(int seniorId) async {
    final res =
        await http.post(Uri.parse('$baseUrl/risk/assess/$seniorId'));
    if (res.statusCode == 200) return jsonDecode(res.body);
    throw Exception('위험도 평가 실패');
  }
}
