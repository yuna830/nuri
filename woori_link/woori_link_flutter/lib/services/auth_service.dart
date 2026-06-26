import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  static const _storage = FlutterSecureStorage();
  static const _keyToken = 'token';
  static const _keyUserId = 'userId';
  static const _keyName = 'name';
  static const _keyRole = 'role';

  static Future<void> saveSession(Map<String, dynamic> data) async {
    await _storage.write(key: _keyToken, value: data['token']);
    await _storage.write(key: _keyUserId, value: data['userId'].toString());
    await _storage.write(key: _keyName, value: data['name'] ?? '');
    await _storage.write(key: _keyRole, value: data['role'] ?? '');
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

  static Future<void> logout() async {
    await _storage.deleteAll();
  }

  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
