import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  static const _storage = FlutterSecureStorage();
  static const _keyToken = 'token';
  static const _keyUserId = 'userId';
  static const _keyName = 'name';
  static const _keyRole = 'role';

  static Future<void> saveSession(Map<String, dynamic> data) async {
    final token = data['token']?.toString().trim() ?? '';
    final userId = data['userId']?.toString().trim() ?? '';
    final role = data['role']?.toString().trim() ?? '';

    if (token.isEmpty || userId.isEmpty || int.tryParse(userId) == null || role != 'SENIOR') {
      await logout();
      throw Exception('로그인 정보가 올바르지 않습니다. 다시 로그인해 주세요.');
    }

    await _storage.write(key: _keyToken, value: token);
    await _storage.write(key: _keyUserId, value: userId);
    await _storage.write(key: _keyName, value: data['name']?.toString() ?? '');
    await _storage.write(key: _keyRole, value: role);
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: _keyToken);
  }

  static Future<int?> getUserId() async {
    final val = await _storage.read(key: _keyUserId);
    return val != null ? int.tryParse(val) : null;
  }

  static Future<String?> getName() async {
    return await _storage.read(key: _keyName);
  }

  static Future<String?> getRole() async {
    return await _storage.read(key: _keyRole);
  }

  static Future<void> logout() async {
    await _storage.deleteAll();
  }

  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    final userId = await getUserId();
    final role = await getRole();
    final valid = token != null && token.isNotEmpty && userId != null && role == 'SENIOR';
    if (!valid) await logout();
    return valid;
  }
}
