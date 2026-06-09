import 'package:shared_preferences/shared_preferences.dart';

class GuardianSessionStorage {
  static const String _keyGuardianId = 'guardianId';
  static const String _keyName = 'name';
  static const String _keyEmail = 'email';
  static const String _keyPhone = 'phone';
  static const String _keyAddress = 'address';

  Future<void> saveGuardianInfo({
    required String guardianId,
    required String name,
    required String email,
    String? phone,
    String? address,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyGuardianId, guardianId);
    await prefs.setString(_keyName, name);
    await prefs.setString(_keyEmail, email);
    if (phone != null) await prefs.setString(_keyPhone, phone);
    if (address != null) await prefs.setString(_keyAddress, address);
  }

  Future<Map<String, String?>> getGuardianInfo() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'guardianId': prefs.getString(_keyGuardianId),
      'name': prefs.getString(_keyName),
      'email': prefs.getString(_keyEmail),
      'phone': prefs.getString(_keyPhone),
      'address': prefs.getString(_keyAddress),
    };
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyGuardianId);
    await prefs.remove(_keyName);
    await prefs.remove(_keyEmail);
    await prefs.remove(_keyPhone);
    await prefs.remove(_keyAddress);
  }
}
