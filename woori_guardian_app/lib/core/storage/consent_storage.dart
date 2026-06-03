import 'package:shared_preferences/shared_preferences.dart';

class ConsentStorage {
  static const _keyLocation = 'consent_location_use';
  static const _keyContact = 'consent_contact_use';
  static const _keyHealth = 'consent_health_include';
  static const _keyReportCopy = 'consent_report_copy';

  Future<Map<String, bool>> load() async {
    final p = await SharedPreferences.getInstance();
    return {
      _keyLocation: p.getBool(_keyLocation) ?? true,
      _keyContact: p.getBool(_keyContact) ?? true,
      _keyHealth: p.getBool(_keyHealth) ?? false,
      _keyReportCopy: p.getBool(_keyReportCopy) ?? true,
    };
  }

  Future<void> set(String key, bool value) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(key, value);
  }

  static const locationKey = _keyLocation;
  static const contactKey = _keyContact;
  static const healthKey = _keyHealth;
  static const reportCopyKey = _keyReportCopy;
}
