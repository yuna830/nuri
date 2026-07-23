import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'http_client.dart';

class CareMonitoringApi {
  static Future<List<dynamic>> getAlerts(int seniorId) async {
    final response = await http.get(Uri.parse('$baseUrl/care/seniors/$seniorId/alerts'), headers: await authHeaders());
    if (response.statusCode != 200) throw Exception('Alert load failed');
    return jsonDecode(utf8.decode(response.bodyBytes)) as List<dynamic>;
  }

  static Future<void> acknowledgeAlert(int alertId) async {
    final response = await http.patch(Uri.parse('$baseUrl/care/senior-alerts/$alertId'), headers: await authHeaders());
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Alert update failed');
  }

  static Future<void> acknowledgeAllAlerts(int seniorId) async {
    final response = await http.patch(Uri.parse('$baseUrl/care/seniors/$seniorId/alerts/read-all'), headers: await authHeaders());
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Alert update failed');
  }

  static Future<void> deleteAlert(int alertId) async {
    final response = await http.delete(Uri.parse('$baseUrl/care/senior-alerts/$alertId'), headers: await authHeaders());
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Alert delete failed');
  }

  static Future<void> deleteAllAlerts(int seniorId) async {
    final response = await http.delete(Uri.parse('$baseUrl/care/seniors/$seniorId/alerts'), headers: await authHeaders());
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Alert delete failed');
  }

  static Future<List<dynamic>> getCheckIns(int seniorId) async {
    final response = await http.get(Uri.parse('$baseUrl/care/seniors/$seniorId/check-ins'), headers: await authHeaders());
    if (response.statusCode != 200) throw Exception('Check-in load failed');
    return jsonDecode(response.body) as List<dynamic>;
  }

  static Future<void> respondToCheckIn(int checkInId, String message) async {
    final response = await http.patch(Uri.parse('$baseUrl/care/check-ins/$checkInId/response'), headers: await authHeaders(),
      body: jsonEncode({'message': message}));
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Check-in response failed');
  }

  static Future<void> reportSos(int seniorId, String note) async {
    final response = await http.post(
      Uri.parse('$baseUrl/care/seniors/$seniorId/events'),
      headers: await authHeaders(),
      body: jsonEncode({'type': 'SOS', 'note': note}),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('SOS request failed');
  }

  static Future<void> reportFall(int seniorId, {double? latitude, double? longitude}) async {
    final response = await http.post(Uri.parse('$baseUrl/care/seniors/$seniorId/events'), headers: await authHeaders(),
      body: jsonEncode({'type': 'FALL_DETECTED', 'latitude': latitude, 'longitude': longitude}));
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Fall report failed');
  }

  static Future<void> sendLocation(int seniorId, double latitude, double longitude) async {
    final response = await http.post(Uri.parse('$baseUrl/care/seniors/$seniorId/locations'), headers: await authHeaders(),
      body: jsonEncode({'latitude': latitude, 'longitude': longitude}));
    if (response.statusCode < 200 || response.statusCode >= 300) throw Exception('Location upload failed');
  }
}
