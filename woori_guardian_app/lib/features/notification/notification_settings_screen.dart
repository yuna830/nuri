import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _kGreen = Color(0xFF86A788);
const _kBg = Colors.white;
const _kDivider = Color(0xFFE5E5EA);

class _NotifItem {
  final String key;
  final String label;
  final String desc;
  final IconData icon;

  const _NotifItem({
    required this.key,
    required this.label,
    required this.desc,
    required this.icon,
  });
}

const _items = [
  _NotifItem(
    key: 'notif_sos',
    label: 'SOS 알림',
    desc: '보호 대상자가 SOS를 요청했을 때',
    icon: Icons.sos_outlined,
  ),
  _NotifItem(
    key: 'notif_danger',
    label: '위험 상황 알림',
    desc: '낙상 의심, 위험 감지 등 긴급 상황 발생 시',
    icon: Icons.warning_amber_outlined,
  ),
  _NotifItem(
    key: 'notif_zone_exit',
    label: '안전구역 이탈 알림',
    desc: '보호 대상자가 설정된 반경을 벗어났을 때',
    icon: Icons.location_off_outlined,
  ),
  _NotifItem(
    key: 'notif_location_missing',
    label: '위치 미수신 알림',
    desc: '일정 시간 동안 위치 정보가 수신되지 않을 때',
    icon: Icons.gps_off_outlined,
  ),
  _NotifItem(
    key: 'notif_call',
    label: '전화 알림',
    desc: '보호 대상자의 전화 수신/발신 관련 알림',
    icon: Icons.phone_outlined,
  ),
  _NotifItem(
    key: 'notif_welfare',
    label: '복지사 상담 요청',
    desc: '담당 복지사의 상담 요청이 있을 때',
    icon: Icons.support_agent_outlined,
  ),
  _NotifItem(
    key: 'notif_job',
    label: '일자리 관련 알림',
    desc: '보호 대상자의 일자리 신청/변경 알림',
    icon: Icons.work_outline,
  ),
];

class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState
    extends State<NotificationSettingsScreen> {
  final Map<String, bool> _states = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      for (final item in _items) {
        _states[item.key] = prefs.getBool(item.key) ?? true;
      }
    });
  }

  Future<void> _toggle(String key, bool value) async {
    setState(() => _states[key] = value);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, value);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        title: const Text('알림 설정'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _states.isEmpty
          ? const Center(child: CircularProgressIndicator(color: _kGreen))
          : ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
              itemCount: _items.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, color: _kDivider),
              itemBuilder: (context, i) {
                final item = _items[i];
                final enabled = _states[item.key] ?? true;
                return Container(
                  color: Colors.white,
                  child: ListTile(
                    leading: Icon(item.icon,
                        color: enabled ? _kGreen : const Color(0xFFAEAEB2),
                        size: 22),
                    title: Text(item.label,
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w500,
                            color: enabled
                                ? const Color(0xFF1C1C1E)
                                : const Color(0xFFAEAEB2))),
                    subtitle: Text(item.desc,
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF6C6C70))),
                    trailing: Switch(
                      value: enabled,
                      onChanged: (v) => _toggle(item.key, v),
                      activeColor: _kGreen,
                    ),
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  ),
                );
              },
            ),
    );
  }
}
