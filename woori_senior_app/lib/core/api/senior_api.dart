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

  /// 알림 목록 주기적 갱신용 (홈 화면 polling)
  Future<List<dynamic>> fetchAlerts(int seniorId) =>
      _getJsonList('/api/alerts/senior/$seniorId');

  /// 알림 읽음 처리
  Future<void> readAlert(int alertId) async {
    await http.patch(
      Uri.parse('$apiBaseUrl/api/alerts/$alertId/read'),
      headers: {'Content-Type': 'application/json'},
    );
  }

  Future<void> sendSos(int seniorId, {double? lat, double? lon}) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/alerts/sos'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'seniorId': seniorId,
        'latitude': lat,
        'longitude': lon,
        'address': '모바일 앱',
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('SOS 전송 실패');
    }
  }

  /// SOS 잘못 누름 취소 알림
  Future<void> sendSosCancel(int seniorId, {double? lat, double? lon}) async {
    await http.post(
      Uri.parse('$apiBaseUrl/api/alerts/sos/cancel'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'seniorId': seniorId,
        'latitude': lat,
        'longitude': lon,
        'address': '모바일 앱',
      }),
    );
  }

  /// 안부 메시지 답장
  Future<void> sendCheckInReply({
    required int seniorId,
    required String reply,
    String originalMessage = '',
  }) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/alerts/check-in-reply'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'seniorId': seniorId,
        'reply': reply,
        'originalMessage': originalMessage,
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('답장 전송 실패');
    }
  }

  /// 오늘 일정 (날짜 지정)
  Future<List<dynamic>> fetchSchedulesByDate(int seniorId, String date) =>
      _getJsonList('/api/schedules/senior/$seniorId/date/$date');

  /// 낙상 이벤트 목록
  Future<List<dynamic>> fetchFallEvents({int page = 1}) =>
      _getJsonList('/api/fall-events?page=$page&size=20');

  /// 낙상 이력 알림
  Future<List<dynamic>> fetchFallAlerts(int seniorId) async {
    final all = await fetchAlerts(seniorId);
    return all
        .where((a) =>
            a is Map &&
            (a['type'] == 'FALL_DETECTED' || a['type'] == 'FALL_RISK'))
        .toList();
  }

  /// 위치 이력
  Future<List<dynamic>> fetchLocationHistory(int seniorId, String date) =>
      _getJsonList('/api/locations/senior/$seniorId/date?date=$date');

  /// 최신 위치 (서버 저장 데이터)
  Future<Map<String, dynamic>?> fetchLatestLocation(int seniorId) async {
    final response = await http.get(
      Uri.parse('$apiBaseUrl/api/locations/senior/$seniorId/latest'),
    );
    if (response.statusCode == 204 || response.statusCode == 404) return null;
    if (response.statusCode < 200 || response.statusCode >= 300) return null;
    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    return decoded is Map<String, dynamic> ? decoded : null;
  }

  /// 위치 저장 (accuracy 포함)
  Future<void> saveLocation({
    required int seniorId,
    required double lat,
    required double lon,
    String address = '',
    double? accuracy,
  }) async {
    await http.post(
      Uri.parse('$apiBaseUrl/api/locations'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'seniorId': seniorId,
        'latitude': lat,
        'longitude': lon,
        'address': address,
        if (accuracy != null) 'accuracy': accuracy,
      }),
    );
  }

  /// 안전 반경 목록
  Future<List<dynamic>> fetchSafeZones(int seniorId) =>
      _getJsonList('/api/safe-zones/senior/$seniorId');

  /// 오늘 날씨 (기상청 격자 nx, ny 기반)
  Future<Map<String, dynamic>> fetchWeather(int nx, int ny) =>
      _getJson('/api/weather?nx=$nx&ny=$ny');

  /// 기후 알림 (DB 저장된 것)
  Future<List<dynamic>> fetchClimateAlerts(int seniorId) =>
      _getJsonList('/api/climate-alerts/senior/$seniorId/today');

  /// 프로필 상세 (건강 정보 포함)
  Future<Map<String, dynamic>> fetchProfile(int seniorId) =>
      _getJson('/api/seniors/$seniorId');

  /// 프로필 수정
  Future<Map<String, dynamic>> updateProfile(
      int seniorId, Map<String, dynamic> data) async {
    final response = await http.put(
      Uri.parse('$apiBaseUrl/api/seniors/$seniorId'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(data),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('프로필 저장 실패');
    }

    return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }

  /// 일자리 공고 목록
  Future<Map<String, dynamic>> fetchJobList({
    int page = 1,
    String keyword = '',
    int size = 20,
  }) async {
    // Spring은 /api/job-cache (flat list) 로 캐싱된 공고를 제공
    final uri = Uri.parse('$apiBaseUrl/api/job-cache');
    final response = await http.get(uri);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      return {'list': [], 'total': 0};
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    List<dynamic> all = decoded is List ? decoded : [];

    // 키워드 필터 (서버에서 안 해주므로 클라이언트에서 처리)
    if (keyword.isNotEmpty) {
      final kw = keyword.toLowerCase();
      all = all.where((j) {
        if (j is! Map) return false;
        return ['recrtTitle', 'oranNm', 'workPlcNm', 'jobclsNm', 'source']
            .any((k) => '${j[k] ?? ''}'.toLowerCase().contains(kw));
      }).toList();
    }

    final total = all.length;
    final start = ((page - 1) * size).clamp(0, total);
    final end = (start + size).clamp(0, total);

    return {'list': all.sublist(start, end), 'total': total};
  }

  /// 일자리 신청 목록 (관심/신청 모두)
  Future<List<dynamic>> fetchJobApplications(int seniorId) =>
      _getJsonList('/api/job-interests/senior/$seniorId');

  /// 일자리 신청
  Future<void> applyJob({
    required int seniorId,
    required Map<String, dynamic> job,
    String applicationType = 'ONLINE',
    String status = '검토 대기',
  }) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/job-interests'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'seniorId': seniorId,
        'jobId': job['jobId'],
        'jobTitle': job['recrtTitle'],
        'company': job['oranNm'],
        'location': job['workPlcNm'],
        'applicationType': applicationType,
        'status': status,
        'source': job['source'],
        'detailAddress': job['plDetAddr'],
        'jobType': job['jobclsNm'],
        'workTime': job['workTime'],
        'weekHours': job['weekHours']?.toString(),
        'wage': job['wage'],
        'recruitCount': job['clltPrnnum']?.toString(),
        'fromDate': job['frDd'],
        'toDate': job['toDd'],
        'applyMethod': job['acptMthd'],
        'contactInfo': job['clerkContt'],
        'detail': job['detCnts'],
      }),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('일자리 신청 실패');
    }
  }

  /// 일자리 신청 상태 변경
  Future<Map<String, dynamic>> updateJobApplicationStatus(
      int applicationId, String status) async {
    final response = await http.patch(
      Uri.parse('$apiBaseUrl/api/job-interests/$applicationId/status'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'status': status}),
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('상태 변경 실패');
    }

    return jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final response = await http.get(Uri.parse('$apiBaseUrl$path'));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('API 요청 실패: $path');
    }

    final decoded = jsonDecode(utf8.decode(response.bodyBytes));
    if (decoded is! Map<String, dynamic>) {
      throw Exception('API 응답 형식 오류: $path');
    }
    return decoded;
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
