import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'http_client.dart';

class ScheduleApi {
  static Future<List<dynamic>> fetchTodaySchedules(int seniorId) async {
    final schedules = await fetchSeniorSchedules(seniorId);
    final today = DateTime.now();
    final todayText =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    return schedules.where((schedule) {
      final date = '${schedule['visitDate'] ?? schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
      return date.length >= 10 && date.substring(0, 10) == todayText;
    }).toList();
  }

  static Future<List<dynamic>> fetchSeniorSchedules(int seniorId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/schedules/senior/$seniorId'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200) return _normalizeList(jsonDecode(utf8.decode(res.bodyBytes)));
    throw Exception('일정 조회 실패 (${res.statusCode}): ${utf8.decode(res.bodyBytes)}');
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
      return jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
    }
    throw Exception('일정 등록 실패 (${res.statusCode}): ${utf8.decode(res.bodyBytes)}');
  }

  static Future<void> deleteSchedule(dynamic scheduleId) async {
    final res = await http.delete(
      Uri.parse('$baseUrl/schedules/$scheduleId'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200 || res.statusCode == 204) return;
    throw Exception('일정 삭제 실패 (${res.statusCode}): ${utf8.decode(res.bodyBytes)}');
  }
}

List<dynamic> _normalizeList(dynamic data) {
  if (data is List) return data;
  if (data is Map && data['data'] is List) return data['data'] as List;
  if (data is Map && data['content'] is List) return data['content'] as List;
  return [];
}
