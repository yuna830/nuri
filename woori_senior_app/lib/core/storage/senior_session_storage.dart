import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class SeniorSessionStorage {
  static const String _seniorIdKey = 'seniorId';
  static const String _profilePrefix = 'profile_';

  static Future<void> saveSeniorId(int seniorId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_seniorIdKey, seniorId);
  }

  static Future<int?> getSeniorId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_seniorIdKey);
  }

  static Future<void> saveProfile(int seniorId, Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_profilePrefix$seniorId', jsonEncode(data));
  }

  static Future<Map<String, dynamic>?> getProfile(int seniorId) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('$_profilePrefix$seniorId');
    if (raw == null) return null;
    try {
      final decoded = jsonDecode(raw);
      return decoded is Map<String, dynamic> ? decoded : null;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_seniorIdKey);
  }
}
