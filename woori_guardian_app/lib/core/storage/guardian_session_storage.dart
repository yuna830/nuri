import 'package:shared_preferences/shared_preferences.dart';

class GuardianSessionStorage {
  static const String _keyGuardianId = 'guardianId';
  static const String _keyName = 'name';
  static const String _keyEmail = 'email';

  Future<void> saveGuardianInfo({
    required String guardianId,
    required String name,
    required String email,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyGuardianId, guardianId);
    await prefs.setString(_keyName, name);
    await prefs.setString(_keyEmail, email);
  }

  Future<Map<String, String?>> getGuardianInfo() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'guardianId': prefs.getString(_keyGuardianId),
      'name': prefs.getString(_keyName),
      'email': prefs.getString(_keyEmail),
    };
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyGuardianId);
    await prefs.remove(_keyName);
    await prefs.remove(_keyEmail);
  }
}
