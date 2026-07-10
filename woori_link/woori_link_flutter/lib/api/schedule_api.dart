import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'http_client.dart';

class ScheduleApi {
  static Future<List<dynamic>> fetchTodaySchedules(int seniorId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/schedules/senior/$seniorId/today'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200) return _normalizeList(jsonDecode(res.body));
    throw Exception('오늘 일정 조회 실패');
  }

  static Future<List<dynamic>> fetchSeniorSchedules(int seniorId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/schedules/senior/$seniorId'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200) return _normalizeList(jsonDecode(res.body));
    throw Exception('일정 조회 실패');
  }

  static Future<Map<String, dynamic>> createSchedule(
    Map<String, dynamic> payload,
  ) async {
    final res = await http.post(
      Uri.parse('$baseUrl/schedules'),
      headers: await authHeaders(),
      body: jsonEncode(payload),
    );
    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('일정 등록 실패');
  }
}

List<dynamic> _normalizeList(dynamic data) {
  if (data is List) return data;
  if (data is Map && data['data'] is List) return data['data'] as List;
  if (data is Map && data['content'] is List) return data['content'] as List;
  return [];
}
