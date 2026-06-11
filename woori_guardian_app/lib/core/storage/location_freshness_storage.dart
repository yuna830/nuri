import 'package:shared_preferences/shared_preferences.dart';

/// 위치 미갱신(미접속) 판단 기준 시간 설정.
/// 마지막 GPS 수신 후 이 시간이 지나면 홈 카드 상태를 '확인 필요'로 표시한다.
class LocationFreshnessStorage {
  static const String _keyStaleHours = 'locationStaleHours';
  static const int defaultStaleHours = 6;

  Future<int> getStaleHours() async {
    final prefs = await SharedPreferences.getInstance();
    final hours = prefs.getInt(_keyStaleHours) ?? defaultStaleHours;
    return hours < 1 ? defaultStaleHours : hours;
  }

  Future<void> setStaleHours(int hours) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_keyStaleHours, hours < 1 ? defaultStaleHours : hours);
  }
}
