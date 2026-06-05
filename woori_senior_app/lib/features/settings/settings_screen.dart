import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/config/app_config.dart';

// ─── 설정 키 상수 ─────────────────────────────────────────────────────────────
class _Key {
  // 알림
  static const medicineAlarm = 'setting_medicine_alarm';
  static const phoneUse = 'setting_phone_use';
  static const smsUse = 'setting_sms_use';
  // 동의
  static const consentPersonal = 'consent_personal';
  static const consentLocation = 'consent_location';
  static const consentEmergency = 'consent_emergency';
  static const consentGuardian = 'consent_guardian'; // 보호자 연동 후 활성화
  static const consentSafeZone = 'consent_safe_zone';
  static const consentReport = 'consent_report';
  static const consentContact = 'consent_contact';
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, required this.seniorId});
  final int seniorId;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _loading = true;
  int? _guardianId; // 보호자 연결 시 설정됨

  // 알림
  bool _medicineAlarm = true;
  bool _phoneUse = true;
  bool _smsUse = true;

  // 동의
  bool _consentPersonal = false;
  bool _consentLocation = false;
  bool _consentEmergency = false;
  bool _consentGuardian = false;
  bool _consentSafeZone = false;
  bool _consentReport = false;
  bool _consentContact = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();

    // 보호자 연결 여부 확인
    try {
      final res = await http.get(
        Uri.parse('$apiBaseUrl/api/seniors/${widget.seniorId}'),
      ).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
        final guardianId = data['guardianId'];
        if (guardianId != null) {
          _guardianId = guardianId is int ? guardianId : int.tryParse('$guardianId');
        }
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _medicineAlarm = prefs.getBool(_Key.medicineAlarm) ?? true;
      _phoneUse = prefs.getBool(_Key.phoneUse) ?? true;
      _smsUse = prefs.getBool(_Key.smsUse) ?? true;
      _consentPersonal = prefs.getBool(_Key.consentPersonal) ?? false;
      _consentLocation = prefs.getBool(_Key.consentLocation) ?? false;
      _consentEmergency = prefs.getBool(_Key.consentEmergency) ?? false;
      // 보호자가 연결돼 있을 때만 활성화, 기본 on
      _consentGuardian = _guardianId != null
          ? (prefs.getBool(_Key.consentGuardian) ?? true)
          : false;
      _consentSafeZone = prefs.getBool(_Key.consentSafeZone) ?? false;
      _consentReport = prefs.getBool(_Key.consentReport) ?? false;
      _consentContact = prefs.getBool(_Key.consentContact) ?? false;
      _loading = false;
    });
  }

  Future<void> _set(String key, bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  // 보호자 연동 동의 토글 → off 시 연결 해제
  Future<void> _onGuardianToggle(bool value) async {
    if (value) {
      setState(() => _consentGuardian = true);
      _set(_Key.consentGuardian, true);
      return;
    }

    // off → 연결 해제 확인 다이얼로그
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('보호자 연동 해제', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('보호자 연동을 해제하면 보호자가 내 정보를 볼 수 없게 됩니다.\n정말 해제하시겠어요?'),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFD94E4E)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('해제'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    try {
      final res = await http.delete(
        Uri.parse('$apiBaseUrl/api/guardians/$_guardianId/seniors/${widget.seniorId}'),
      ).timeout(const Duration(seconds: 6));

      if (!mounted) return;
      if (res.statusCode == 200 || res.statusCode == 204) {
        setState(() {
          _consentGuardian = false;
          _guardianId = null;
        });
        _set(_Key.consentGuardian, false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('보호자 연동이 해제되었습니다.')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('해제에 실패했습니다. 다시 시도해주세요.')),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('네트워크 오류가 발생했습니다.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9F7),
      appBar: AppBar(
        backgroundColor: const Color(0xFF86A788),
        surfaceTintColor: const Color(0xFF86A788),
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text('설정',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF86A788)))
          : ListView(
              children: [
                // ── 알림 설정 ──────────────────────────────
                _SectionHeader('알림 설정'),
                _ToggleTile(
                  icon: Icons.medication_outlined,
                  title: '복약 알림',
                  subtitle: '복용 시간에 알림을 보냅니다.',
                  value: _medicineAlarm,
                  onChanged: (v) {
                    setState(() => _medicineAlarm = v);
                    _set(_Key.medicineAlarm, v);
                  },
                ),
                _ToggleTile(
                  icon: Icons.call_outlined,
                  title: '전화 사용',
                  subtitle: '보호자·복지사 전화 연결에 사용합니다.',
                  value: _phoneUse,
                  onChanged: (v) {
                    setState(() => _phoneUse = v);
                    _set(_Key.phoneUse, v);
                  },
                ),
                _ToggleTile(
                  icon: Icons.sms_outlined,
                  title: '문자 사용',
                  subtitle: '긴급 상황 시 문자 알림을 보냅니다.',
                  value: _smsUse,
                  onChanged: (v) {
                    setState(() => _smsUse = v);
                    _set(_Key.smsUse, v);
                  },
                ),

                // ── 정보 제공 동의 ─────────────────────────
                _SectionHeader('정보 제공 동의'),
                _ToggleTile(
                  icon: Icons.person_outline,
                  title: '개인정보 동의',
                  subtitle: '서비스 이용을 위한 개인정보 수집·이용에 동의합니다.',
                  value: _consentPersonal,
                  onChanged: (v) {
                    setState(() => _consentPersonal = v);
                    _set(_Key.consentPersonal, v);
                  },
                ),
                _ToggleTile(
                  icon: Icons.location_on_outlined,
                  title: '위치 공유',
                  subtitle: '마지막 위치와 이동 정보를 보호자가 확인합니다.',
                  value: _consentLocation,
                  onChanged: (v) {
                    setState(() => _consentLocation = v);
                    _set(_Key.consentLocation, v);
                  },
                ),
                _ToggleTile(
                  icon: Icons.emergency_outlined,
                  title: '긴급 연락 권한',
                  subtitle: 'SOS 발생 시 보호자에게 즉시 연락합니다.',
                  value: _consentEmergency,
                  onChanged: (v) {
                    setState(() => _consentEmergency = v);
                    _set(_Key.consentEmergency, v);
                  },
                ),
                _ToggleTile(
                  icon: Icons.people_outline,
                  title: '보호자 연동 동의',
                  subtitle: _guardianId != null
                      ? '끄면 보호자 연동이 해제됩니다.'
                      : '보호자가 연동되면 활성화됩니다.',
                  value: _consentGuardian,
                  enabled: _guardianId != null,
                  onChanged: _onGuardianToggle,
                ),
                _ToggleTile(
                  icon: Icons.shield_outlined,
                  title: '안전구역 설정 동의',
                  subtitle: '설정된 안전 반경과 이탈 여부를 보호자가 확인합니다.',
                  value: _consentSafeZone,
                  onChanged: (v) {
                    setState(() => _consentSafeZone = v);
                    _set(_Key.consentSafeZone, v);
                  },
                ),
                _ToggleTile(
                  icon: Icons.report_outlined,
                  title: '신고 정보 사용 동의',
                  subtitle: '안전Dream 신고용 참고 정보를 제공합니다.',
                  value: _consentReport,
                  onChanged: (v) {
                    setState(() => _consentReport = v);
                    _set(_Key.consentReport, v);
                  },
                ),
                _ToggleTile(
                  icon: Icons.contacts_outlined,
                  title: '연락처 정보 제공 동의',
                  subtitle: '전화·문자 연결을 위해 연락처를 사용합니다.',
                  value: _consentContact,
                  onChanged: (v) {
                    setState(() => _consentContact = v);
                    _set(_Key.consentContact, v);
                  },
                ),
                const SizedBox(height: 32),
              ],
            ),
    );
  }
}

// ─── 섹션 헤더 ────────────────────────────────────────────────────────────────
class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 6),
      child: Text(
        title,
        style: const TextStyle(
          color: Color(0xFF6D766A),
          fontSize: 13,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

// ─── 토글 타일 ────────────────────────────────────────────────────────────────
class _ToggleTile extends StatelessWidget {
  const _ToggleTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final color = enabled ? const Color(0xFF86A788) : const Color(0xFFBDBDBD);

    return Container(
      color: Colors.white,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Icon(icon, color: color, size: 24),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          color: enabled
                              ? const Color(0xFF1F2A20)
                              : const Color(0xFFBDBDBD),
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          color: enabled
                              ? const Color(0xFF6D766A)
                              : const Color(0xFFD1D5DB),
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: enabled ? value : false,
                  onChanged: enabled ? onChanged : null,
                  activeColor: const Color(0xFF86A788),
                ),
              ],
            ),
          ),
          const Divider(height: 1, indent: 54, color: Color(0xFFF0F0F0)),
        ],
      ),
    );
  }
}
