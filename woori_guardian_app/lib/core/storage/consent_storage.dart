import 'package:shared_preferences/shared_preferences.dart';

class ConsentStorage {
  static const _keyGuardianContactShare = 'consent_guardian_contact_share';
  static const _keyEmergencyContactReceive = 'consent_emergency_contact_receive';
  static const _keyWelfareConsultInfoShare = 'consent_welfare_consult_info_share';
  static const _keyReportSupportInfoShare = 'consent_report_support_info_share';

  Future<Map<String, bool>> load() async {
    final p = await SharedPreferences.getInstance();
    return {
      _keyGuardianContactShare: p.getBool(_keyGuardianContactShare) ?? true,
      _keyEmergencyContactReceive: p.getBool(_keyEmergencyContactReceive) ?? true,
      _keyWelfareConsultInfoShare: p.getBool(_keyWelfareConsultInfoShare) ?? true,
      _keyReportSupportInfoShare: p.getBool(_keyReportSupportInfoShare) ?? true,
    };
  }

  Future<void> set(String key, bool value) async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(key, value);
  }

  static const guardianContactShareKey = _keyGuardianContactShare;
  static const emergencyContactReceiveKey = _keyEmergencyContactReceive;
  static const welfareConsultInfoShareKey = _keyWelfareConsultInfoShare;
  static const reportSupportInfoShareKey = _keyReportSupportInfoShare;
}