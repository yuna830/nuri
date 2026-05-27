import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';

class SeniorHomeData {
  const SeniorHomeData({
    required this.senior,
    required this.schedules,
    required this.climateAlerts,
    required this.alerts,
  });

  final Map<String, dynamic> senior;
  final List<dynamic> schedules;
  final List<dynamic> climateAlerts;
  final List<dynamic> alerts;
}

class SeniorApi {
  const SeniorApi();

  Future<SeniorHomeData> fetchHomeData(int seniorId) async {
    final results = await Future.wait([
      _getJson('/api/seniors/$seniorId'),
      _getJsonList('/api/schedules/senior/$seniorId/today'),
      _getJsonList('/api/climate-alerts/senior/$seniorId/today'),
      _getJsonList('/api/alerts/senior/$seniorId'),
    ]);

    return SeniorHomeData(
      senior: results[0] as Map<String, dynamic>,
      schedules: results[1] as List<dynamic>,
      climateAlerts: results[2] as List<dynamic>,
      alerts: results[3] as List<dynamic>,
    );
  }

  Future<void> sendSos(int seniorId) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/alerts/sos'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'seniorId': seniorId,
        'latitude': null,
        'longitude': null,
        'address': '모바일 앱',
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('SOS 전송 실패');
    }
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final response = await http.get(Uri.parse('$apiBaseUrl$path'));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('API 요청 실패: $path');
    }

    return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }

  Future<List<dynamic>> _getJsonList(String path) async {
    final response = await http.get(Uri.parse('$apiBaseUrl$path'));

    if (response.statusCode == 204) {
      return [];
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('API 요청 실패: $path');
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    return decoded is List ? decoded : [];
  }

  Future<Map<String, dynamic>> loginSenior({
    required String name,
    required String phone,
  }) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/seniors/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'name': name, 'phone': phone}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('로그인 실패');
    }

    return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> signUpSenior({
    required String name,
    required String phone,
    required String birthDate,
    required String gender,
    required String region,
    String incomeLevel = '',
    String householdType = '',
  }) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/seniors'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'name': name,
        'phone': phone,
        'birthDate': birthDate,
        'gender': gender,
        'region': region,
        'incomeLevel': incomeLevel,
        'householdType': householdType,

        'age': '',
        'disabilityGrade': '',
        'disabilityType': '',
        'profileImageUrl': '',
        'height': '',
        'weight': '',
        'smoking': '',
        'drinking': '',
        'allergies': '',
        'medicineCount': '',
        'medicationsJson': '[]',
        'diabetes': '',
        'hypertension': '',
        'heart': '',
        'joint': '',
        'stroke': '',
        'kidney': '',
        'lung': '',
        'liver': '',
        'cancer': '',
        'walkingAid': '',
        'dementia': '',
        'vision': '',
        'hearing': '',
        'recentFall': '',
        'hasSurgery': '',
        'surgeryDetail': '',
        'otherDisease': '',
        'maxHours': '',
        'maxDistance': '',
        'disabledWork': [],
        'payType': '',
        'hopeDays': [],
        'hopeJobType': [],
        'hopeCondition': [],
        'memo': '',
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('회원가입 실패');
    }

    return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }
}
