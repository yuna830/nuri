import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/theme/app_colors.dart';

const _kGreen = AppColors.green;
const _kBg = Color(0xFFF5F7F5);
const _kDivider = AppColors.divider;
const _kTextMain = AppColors.textMain;
const _kTextSub = AppColors.textSub;
const _kTextHint = AppColors.textHint;

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

// 긴급 알림 — 안전과 직결되는 알림
const _urgentItems = [
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
];

// 일반 알림 — 일상 소식
const _generalItems = [
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
      for (final item in [..._urgentItems, ..._generalItems]) {
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
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _sectionLabel('긴급 알림'),
                const SizedBox(height: 8),
                _buildGroupCard(_urgentItems, iconColor: AppColors.red),
                const SizedBox(height: 20),
                _sectionLabel('일반 알림'),
                const SizedBox(height: 8),
                _buildGroupCard(_generalItems, iconColor: _kGreen),
                const SizedBox(height: 16),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 4),
                  child: Text(
                    '알림을 끄면 해당 상황이 발생해도 푸시 알림이 오지 않습니다. 긴급 알림은 켜두는 것을 권장합니다.',
                    style: TextStyle(
                      fontSize: 12,
                      color: _kTextHint,
                      height: 1.5,
                    ),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _sectionLabel(String text) => Padding(
    padding: const EdgeInsets.only(left: 4),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: _kTextSub,
      ),
    ),
  );

  Widget _buildGroupCard(List<_NotifItem> items, {required Color iconColor}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kDivider),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        children: [
          for (final item in items) ...[
            _buildItemTile(item, iconColor),
            if (item != items.last)
              const Divider(height: 1, indent: 64, color: _kDivider),
          ],
        ],
      ),
    );
  }

  Widget _buildItemTile(_NotifItem item, Color iconColor) {
    final enabled = _states[item.key] ?? true;

    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: (enabled ? iconColor : _kTextHint).withValues(
                alpha: 0.12,
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              item.icon,
              size: 19,
              color: enabled ? iconColor : _kTextHint,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.label,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: enabled ? _kTextMain : _kTextHint,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.desc,
                  style: const TextStyle(
                    fontSize: 11.5,
                    color: _kTextSub,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: enabled,
            onChanged: (v) => _toggle(item.key, v),
            activeColor: _kGreen,
          ),
        ],
      ),
    );
  }
}
