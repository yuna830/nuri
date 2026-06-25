import 'package:shared_preferences/shared_preferences.dart';

class AuthService {
  static const _keyToken = 'token';
  static const _keyUserId = 'userId';
  static const _keyName = 'name';
  static const _keyRole = 'role';

  static Future<void> saveSession(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyToken, data['token']);
    await prefs.setInt(_keyUserId, (data['userId'] as num).toInt());
    await prefs.setString(_keyName, data['name'] ?? '');
    await prefs.setString(_keyRole, data['role'] ?? '');
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyToken);
  }

  static Future<int?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_keyUserId);
  }

  static Future<String?> getName() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyName);
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  static Future<bool> isLoggedIn() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }
}
