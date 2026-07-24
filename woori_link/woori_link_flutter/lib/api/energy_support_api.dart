import 'dart:convert';

import 'package:http/http.dart' as http;

import '../constants.dart';
import 'http_client.dart';

class EnergySupportApi {
  static String _connectionMessage() {
    return '서버에 연결하지 못했습니다. '
        '서버가 켜져 있는지와 API 주소($baseUrl)를 확인해 주세요.';
  }

  static String _decodeBody(http.Response response) {
    if (response.bodyBytes.isEmpty) {
      return '';
    }
    return utf8.decode(response.bodyBytes);
  }

  static Exception _requestException(
    String action,
    http.Response response,
  ) {
    final body = _decodeBody(response);

    if (body.trim().isEmpty) {
      return Exception('$action 실패 (${response.statusCode})');
    }

    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'] ?? decoded['error'];
        if (message is String && message.trim().isNotEmpty) {
          return Exception('$action 실패: $message');
        }
      }
    } catch (_) {
      // JSON이 아닌 응답은 원문으로 처리한다.
    }

    return Exception('$action 실패 (${response.statusCode}): $body');
  }

  static Future<Map<String, dynamic>?> _getDetail(
    String path,
    String action,
  ) async {
    late final http.Response response;

    try {
      response = await http.get(
        Uri.parse('$baseUrl$path'),
        headers: await authHeaders(),
      );
    } on http.ClientException {
      throw Exception(_connectionMessage());
    } catch (error) {
      throw Exception('$action 중 오류가 발생했습니다: $error');
    }

    if (response.statusCode == 200) {
      final body = _decodeBody(response);
      if (body.trim().isEmpty) {
        return null;
      }

      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      throw Exception('$action 응답 형식이 올바르지 않습니다.');
    }

    if (response.statusCode == 404) {
      return null;
    }

    throw _requestException(action, response);
  }

  static Future<Map<String, dynamic>> _saveDetail(
    String path,
    String action,
    Map<String, dynamic> body,
  ) async {
    late final http.Response response;

    try {
      response = await http.put(
        Uri.parse('$baseUrl$path'),
        headers: await authHeaders(),
        body: jsonEncode(body),
      );
    } on http.ClientException {
      throw Exception(_connectionMessage());
    } catch (error) {
      throw Exception('$action 중 오류가 발생했습니다: $error');
    }

    if (response.statusCode == 200 || response.statusCode == 201) {
      final responseBody = _decodeBody(response);
      if (responseBody.trim().isEmpty) {
        return <String, dynamic>{};
      }

      final decoded = jsonDecode(responseBody);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
      throw Exception('$action 응답 형식이 올바르지 않습니다.');
    }

    throw _requestException(action, response);
  }

  /// GET /api/energy-support/profile/{seniorId}
  static Future<Map<String, dynamic>?> getEnergySupportProfile(
    int seniorId,
  ) {
    if (seniorId <= 0) {
      return Future.error(
        Exception('에너지복지 프로필을 조회할 사용자 ID가 없습니다.'),
      );
    }

    return _getDetail(
      '/energy-support/profile/$seniorId',
      '에너지복지 프로필 조회',
    );
  }

  /// PUT /api/energy-support/profile/{seniorId}
  static Future<Map<String, dynamic>> saveEnergySupportProfile(
    int seniorId,
    Map<String, dynamic> body,
  ) {
    if (seniorId <= 0) {
      return Future.error(
        Exception('에너지복지 프로필을 저장할 사용자 ID가 없습니다.'),
      );
    }

    return _saveDetail(
      '/energy-support/profile/$seniorId',
      '에너지복지 프로필 저장',
      body,
    );
  }

  /// GET /api/energy-support/electricity/{seniorId}
  static Future<Map<String, dynamic>?> getElectricityDiscountDetail(
    int seniorId,
  ) {
    if (seniorId <= 0) {
      return Future.error(
        Exception('전기요금 정보를 조회할 사용자 ID가 없습니다.'),
      );
    }

    return _getDetail(
      '/energy-support/electricity/$seniorId',
      '전기요금 정보 조회',
    );
  }

  /// PUT /api/energy-support/electricity/{seniorId}
  static Future<Map<String, dynamic>> saveElectricityDiscountDetail(
    int seniorId,
    Map<String, dynamic> body,
  ) {
    if (seniorId <= 0) {
      return Future.error(
        Exception('전기요금 정보를 저장할 사용자 ID가 없습니다.'),
      );
    }

    return _saveDetail(
      '/energy-support/electricity/$seniorId',
      '전기요금 정보 저장',
      body,
    );
  }

  /// GET /api/energy-support/gas/{seniorId}
  static Future<Map<String, dynamic>?> getGasDiscountDetail(
    int seniorId,
  ) {
    if (seniorId <= 0) {
      return Future.error(
        Exception('도시가스 정보를 조회할 사용자 ID가 없습니다.'),
      );
    }

    return _getDetail(
      '/energy-support/gas/$seniorId',
      '도시가스 정보 조회',
    );
  }

  /// PUT /api/energy-support/gas/{seniorId}
  static Future<Map<String, dynamic>> saveGasDiscountDetail(
    int seniorId,
    Map<String, dynamic> body,
  ) {
    if (seniorId <= 0) {
      return Future.error(
        Exception('도시가스 정보를 저장할 사용자 ID가 없습니다.'),
      );
    }

    return _saveDetail(
      '/energy-support/gas/$seniorId',
      '도시가스 정보 저장',
      body,
    );
  }
}
