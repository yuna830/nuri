import 'package:shared_preferences/shared_preferences.dart';

class SeniorSessionStorage {
  static const String _seniorIdKey = 'seniorId';

  static Future<void> saveSeniorId(int seniorId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_seniorIdKey, seniorId);
  }

  static Future<int?> getSeniorId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_seniorIdKey);
  }

  static Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_seniorIdKey);
  }
}