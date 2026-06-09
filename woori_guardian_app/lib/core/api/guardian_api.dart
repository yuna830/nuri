import 'dart:async';
import 'dart:convert';
import 'dart:developer' as dev;
import 'dart:io';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../models/senior.dart';
import '../models/alert.dart';
import '../models/safe_zone.dart';

class GuardianApi {
  Future<Map<String, dynamic>> loginGuardian(
    String email,
    String password,
  ) async {
    final baseUrl = AppConfig.apiBaseUrl;
    final url = Uri.parse('$baseUrl/guardians/login');

    dev.log('[LOGIN] API_BASE_URL: $baseUrl', name: 'GuardianApi');
    dev.log('[LOGIN] 요청 URL: $url', name: 'GuardianApi');
    dev.log('[LOGIN] 요청 email: $email', name: 'GuardianApi');

    try {
      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'email': email, 'password': password}),
          )
          .timeout(const Duration(seconds: 10));

      dev.log(
        '[LOGIN] 응답 statusCode: ${response.statusCode}',
        name: 'GuardianApi',
      );
      dev.log(
        '[LOGIN] 응답 body: ${utf8.decode(response.bodyBytes)}',
        name: 'GuardianApi',
      );

      if (response.statusCode == 200) {
        return jsonDecode(utf8.decode(response.bodyBytes));
      } else if (response.statusCode == 404) {
        throw Exception('EMAIL_NOT_FOUND');
      } else if (response.statusCode == 401) {
        throw Exception('PASSWORD_MISMATCH');
      } else {
        throw Exception('LOGIN_ERROR');
      }
    } on SocketException catch (e) {
      dev.log('[LOGIN] SocketException: $e', name: 'GuardianApi');
      throw Exception('NETWORK_ERROR');
    } on TimeoutException catch (e) {
      dev.log('[LOGIN] TimeoutException: $e', name: 'GuardianApi');
      throw Exception('NETWORK_ERROR');
    } on FormatException catch (e) {
      dev.log('[LOGIN] FormatException: $e', name: 'GuardianApi');
      throw Exception('LOGIN_ERROR');
    } catch (e) {
      final msg = e.toString();
      if (msg.contains('EMAIL_NOT_FOUND') ||
          msg.contains('PASSWORD_MISMATCH') ||
          msg.contains('LOGIN_ERROR') ||
          msg.contains('NETWORK_ERROR')) {
        rethrow;
      }
      dev.log(
        '[LOGIN] Exception (기타): ${e.runtimeType}: $e',
        name: 'GuardianApi',
      );
      throw Exception('NETWORK_ERROR');
    }
  }

  // 사용자 정확 검색
  Future<Map<String, dynamic>?> searchSeniorExact(
    String name,
    String phone,
  ) async {
    final uri = Uri.parse(
      '${AppConfig.apiBaseUrl}/seniors/search-exact',
    ).replace(queryParameters: {'name': name, 'phone': phone});
    try {
      final response = await http.get(uri).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(utf8.decode(response.bodyBytes));
        if (data.isEmpty) return null;
        return (data.first as Map<String, dynamic>)['senior']
            as Map<String, dynamic>?;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // 사용자 - 보호자 연결
  Future<void> connectSeniorToGuardian(
    int guardianId,
    int seniorId,
    String relation,
  ) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/guardians/$guardianId/seniors',
    );
    final response = await http
        .post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'seniorId': seniorId, 'relation': relation}),
        )
        .timeout(const Duration(seconds: 10));
    if (response.statusCode == 200 || response.statusCode == 201) return;
    final body = utf8.decode(response.bodyBytes);
    if (body.contains('Already connected'))
      throw Exception('ALREADY_CONNECTED');
    throw Exception('연결 실패 (${response.statusCode})');
  }

  // 보호자가 담당하는 사용자 목록 조회
  Future<List<Senior>> fetchGuardianSeniors(int guardianId) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/seniors/guardian/$guardianId',
    );

    try {
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(utf8.decode(response.bodyBytes));
        return data.map((json) => Senior.fromJson(json)).toList();
      } else {
        throw Exception('담당 어르신 목록을 불러오지 못했습니다.');
      }
    } catch (e) {
      throw Exception('목록 조회 중 오류가 발생했습니다: $e');
    }
  }

  // 사용자 최신 위치 조회
  Future<Map<String, dynamic>> fetchLatestLocation(int seniorId) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/locations/senior/$seniorId/latest',
    );

    dev.log('[LOCATION] 요청 URL: $url', name: 'GuardianApi');

    try {
      final response = await http.get(url);
      final bodyStr = utf8.decode(response.bodyBytes);

      dev.log(
        '[LOCATION] statusCode: ${response.statusCode}',
        name: 'GuardianApi',
      );
      dev.log('[LOCATION] response body: $bodyStr', name: 'GuardianApi');

      if (response.statusCode == 200) {
        final data = jsonDecode(bodyStr) as Map<String, dynamic>;
        dev.log(
          '[LOCATION] latitude: ${data['latitude']}, longitude: ${data['longitude']}',
          name: 'GuardianApi',
        );
        return data;
      } else if (response.statusCode == 404) {
        throw Exception('위치 정보가 없습니다.');
      } else {
        throw Exception('위치 정보를 불러오지 못했습니다. (${response.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('위치 정보')) rethrow;
      dev.log(
        '[LOCATION] Exception: ${e.runtimeType}: $e',
        name: 'GuardianApi',
      );
      throw Exception('위치 조회 중 오류가 발생했습니다: $e');
    }
  }

  // 날짜별 이동 경로 조회
  Future<List<Map<String, dynamic>>> fetchLocationHistoryByDate(
    int seniorId,
    DateTime date,
  ) async {
    final dateText =
        '${date.year.toString().padLeft(4, '0')}-'
        '${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')}';
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/locations/senior/$seniorId/date',
    ).replace(queryParameters: {'date': dateText});

    try {
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(utf8.decode(response.bodyBytes));
        return data.map((item) => item as Map<String, dynamic>).toList();
      }
      throw Exception('이동 경로를 불러오지 못했습니다. (${response.statusCode})');
    } catch (e) {
      if (e.toString().contains('이동 경로')) rethrow;
      throw Exception('이동 경로 조회 중 오류가 발생했습니다: $e');
    }
  }

  // 보호자 알림 목록 조회
  Future<List<AlertModel>> fetchGuardianAlerts(int guardianId) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/alerts/guardian/$guardianId',
    );

    try {
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(utf8.decode(response.bodyBytes));
        return data
            .map((json) => AlertModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        throw Exception('알림 목록을 불러오지 못했습니다. (${response.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('알림 목록')) rethrow;
      throw Exception('알림 조회 중 오류가 발생했습니다: $e');
    }
  }

  // 알림 읽음 처리
  Future<void> markAlertAsRead(int alertId) async {
    final url = Uri.parse('${AppConfig.apiBaseUrl}/alerts/$alertId/read');

    try {
      final response = await http.patch(url);

      if (response.statusCode != 200) {
        throw Exception('읽음 처리에 실패했습니다. (${response.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('읽음 처리')) rethrow;
      throw Exception('읽음 처리 중 오류가 발생했습니다: $e');
    }
  }

  // 알림 삭제
  Future<void> deleteAlert(int alertId) async {
    final url = Uri.parse('${AppConfig.apiBaseUrl}/alerts/$alertId');

    try {
      final response = await http.delete(url);

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw Exception('알림 삭제에 실패했습니다. (${response.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('알림 삭제')) rethrow;
      throw Exception('알림 삭제 중 오류가 발생했습니다: $e');
    }
  }

  // 알림 선택 삭제
  Future<void> deleteAlerts(List<int> alertIds) async {
    if (alertIds.isEmpty) return;

    final url = Uri.parse('${AppConfig.apiBaseUrl}/alerts/bulk-delete');

    try {
      final response = await http.delete(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'ids': alertIds}),
      );

      if (response.statusCode != 200 && response.statusCode != 204) {
        throw Exception('선택 알림 삭제에 실패했습니다. (${response.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('선택 알림 삭제')) rethrow;
      throw Exception('선택 알림 삭제 중 오류가 발생했습니다: $e');
    }
  }

  // 안전 구역 API (/api/safe-zones)

  Future<List<SafeZone>> fetchSafeZones(int seniorId) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/safe-zones/senior/$seniorId',
    );
    try {
      final res = await http.get(url);
      if (res.statusCode == 200) {
        final list = jsonDecode(utf8.decode(res.bodyBytes)) as List<dynamic>;
        return list
            .map((j) => SafeZone.fromJson(j as Map<String, dynamic>))
            .toList();
      }
      throw Exception('안전 구역 조회 실패 (${res.statusCode})');
    } catch (e) {
      if (e.toString().contains('안전 구역')) rethrow;
      throw Exception('안전 구역 조회 중 오류: $e');
    }
  }

  Future<SafeZone> createSafeZone(int seniorId, SafeZone zone) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/safe-zones/senior/$seniorId',
    );
    try {
      final res = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(zone.toJson()),
      );
      if (res.statusCode == 200 || res.statusCode == 201) {
        return SafeZone.fromJson(
          jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>,
        );
      }
      throw Exception('안전 구역 추가 실패 (${res.statusCode})');
    } catch (e) {
      if (e.toString().contains('안전 구역')) rethrow;
      throw Exception('안전 구역 추가 중 오류: $e');
    }
  }

  Future<SafeZone> updateSafeZone(
    int seniorId,
    int zoneId,
    SafeZone zone,
  ) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/safe-zones/senior/$seniorId/$zoneId',
    );
    try {
      final res = await http.put(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(zone.toJson()),
      );
      if (res.statusCode == 200) {
        return SafeZone.fromJson(
          jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>,
        );
      }
      throw Exception('안전 구역 수정 실패 (${res.statusCode})');
    } catch (e) {
      if (e.toString().contains('안전 구역')) rethrow;
      throw Exception('안전 구역 수정 중 오류: $e');
    }
  }

  Future<void> deleteSafeZone(int seniorId, int zoneId) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/safe-zones/senior/$seniorId/$zoneId',
    );
    try {
      final res = await http.delete(url);
      if (res.statusCode != 200 && res.statusCode != 204) {
        throw Exception('안전 구역 삭제 실패 (${res.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('안전 구역')) rethrow;
      throw Exception('안전 구역 삭제 중 오류: $e');
    }
  }

  // 사용자 일자리 신청 내역
  Future<List<Map<String, dynamic>>> fetchSeniorJobApplications(
    int seniorId,
  ) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/job-interests/senior/$seniorId',
    );

    final response = await http.get(url).timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      final data = jsonDecode(utf8.decode(response.bodyBytes)) as List<dynamic>;
      return data.map((item) => item as Map<String, dynamic>).toList();
    }

    throw Exception('일자리 신청 내역을 불러오지 못했습니다.');
  }

  // 복약 알림 전송
  Future<void> sendMedicationReminder({
    required int seniorId,
    required int guardianId,
    String? message,
  }) async {
    final url = Uri.parse('${AppConfig.apiBaseUrl}/alerts/medicine');
    try {
      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'seniorId': seniorId,
              'guardianId': guardianId,
              if (message != null && message.isNotEmpty) 'message': message,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('알림 전송에 실패했습니다. (${response.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('알림 전송')) rethrow;
      throw Exception('알림 전송 중 오류가 발생했습니다: $e');
    }
  }

  // 보호자 프로필 수정
  Future<Map<String, dynamic>> updateGuardianProfile({
    required int guardianId,
    required String name,
    required String email,
    required String phone,
    required String address,
  }) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/guardians/$guardianId/profile',
    );
    try {
      final response = await http
          .patch(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'name': name,
              'email': email,
              'phone': phone,
              'address': address,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        return jsonDecode(utf8.decode(response.bodyBytes));
      }
      throw Exception('프로필 수정에 실패했습니다. (${response.statusCode})');
    } catch (e) {
      if (e.toString().contains('프로필 수정')) rethrow;
      throw Exception('프로필 수정 중 오류가 발생했습니다: $e');
    }
  }

  // 복지사 상담 요청
  Future<void> respondWelfareConsult({
    required int alertId,
    required String responseType, // "즉시" 또는 "예약"
    String? scheduleAt,
  }) async {
    final url = Uri.parse(
      '${AppConfig.apiBaseUrl}/alerts/$alertId/welfare-consult-response',
    );
    try {
      final response = await http
          .patch(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'responseType': responseType,
              if (scheduleAt != null) 'scheduleAt': scheduleAt,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200) {
        throw Exception('상담 응답에 실패했습니다. (${response.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('상담 응답')) rethrow;
      throw Exception('상담 응답 중 오류가 발생했습니다: $e');
    }
  }

  // 이상 없음 -> 복지사에게 알림 자동 전달
  Future<void> sendCheckInReply({
    required int seniorId,
    required int guardianId,
    required String reply,
    String? originalMessage,
  }) async {
    final url = Uri.parse('${AppConfig.apiBaseUrl}/alerts/check-in-reply');
    try {
      final response = await http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'seniorId': seniorId,
              'guardianId': guardianId,
              'reply': reply,
              if (originalMessage != null) 'originalMessage': originalMessage,
            }),
          )
          .timeout(const Duration(seconds: 10));
      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('이상 없음 전송에 실패했습니다. (${response.statusCode})');
      }
    } catch (e) {
      if (e.toString().contains('이상 없음 전송')) rethrow;
      throw Exception('이상 없음 전송 중 오류가 발생했습니다: $e');
    }
  }

  // 개인정보/기능 동의 요청 알림 전송
  Future<void> sendConsentRequest({
    required int guardianId,
    required int seniorId,
    required String guardianName,
    required List<String> items,
  }) async {
    final url = Uri.parse('${AppConfig.apiBaseUrl}/alerts/consent-request');

    final response = await http
        .post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({
            'guardianId': guardianId,
            'seniorId': seniorId,
            'guardianName': guardianName,
            'items': items,
          }),
        )
        .timeout(const Duration(seconds: 10));

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('동의 요청 전송에 실패했습니다. (${response.statusCode})');
    }
  }

  // 동의 상태 조회
  Future<String> fetchConsentStatus({
    required int guardianId,
    required int seniorId,
  }) async {
    final url = Uri.parse('${AppConfig.apiBaseUrl}/alerts/consent-status')
        .replace(
          queryParameters: {
            'guardianId': guardianId.toString(),
            'seniorId': seniorId.toString(),
          },
        );
    try {
      final response = await http.get(url).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        return data['status'] as String? ?? 'DENIED';
      }
      return 'DENIED';
    } catch (_) {
      return 'DENIED';
    }
  }
}
