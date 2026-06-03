import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/api/guardian_api.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';

// ── 색상 토큰 ─────────────────────────────────────────────────────────────────
const _kGreen    = Color(0xFF86A788);
const _kSafe     = Color(0xFF4A7A4C);
const _kSafeBg   = Color(0xFFEEF5EE);
const _kWarn     = Color(0xFFFF9500);
const _kWarnBg   = Color(0xFFFFF4E5);
const _kRed      = Color(0xFFB85252);
const _kRedBg    = Color(0xFFF5EAEA);
const _kIconGray = Color(0xFF8E8E93);
const _kIconBg   = Color(0xFFF0F0F2);
const _kBlue     = Color(0xFF1565C0);
const _kBlueBg   = Color(0xFFE3F2FD);
const _kTextMain = Color(0xFF1C1C1E);
const _kTextSub  = Color(0xFF6C6C70);
const _kTextHint = Color(0xFFAEAEB2);
const _kDivider  = Color(0xFFE5E5EA);
const _kBg = Colors.white;

class ContactSeniorScreen extends StatefulWidget {
  const ContactSeniorScreen({super.key});

  @override
  State<ContactSeniorScreen> createState() => _ContactSeniorScreenState();
}

class _ContactSeniorScreenState extends State<ContactSeniorScreen> {
  final _api            = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();

  List<Senior> _seniors        = [];
  bool         _loading        = true;
  Senior?      _selected;
  bool         _includeHealth  = false;

  @override
  void initState() {
    super.initState();
    _loadSeniors();
  }

  Future<void> _loadSeniors() async {
    try {
      final info = await _sessionStorage.getGuardianInfo();
      final gid  = info['guardianId'];
      if (gid == null || gid.isEmpty) return;
      final list = await _api.fetchGuardianSeniors(int.parse(gid));
      if (!mounted) return;
      setState(() {
        _seniors  = list;
        _selected = list.isNotEmpty ? list.first : null;
        _loading  = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // ── 액션 ─────────────────────────────────────────────────────────────────

  Future<void> _call(String number) async {
    final uri = Uri(scheme: 'tel', path: number);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _snack('전화를 연결할 수 없습니다.');
    }
  }

  Future<void> _sms(String number) async {
    final uri = Uri(scheme: 'sms', path: number);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _snack('문자를 보낼 수 없습니다.');
    }
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      _snack('링크를 열 수 없습니다.');
    }
  }

  void _copyReportInfo() {
    if (_selected == null) {
      _snack('대상자를 먼저 선택해주세요.');
      return;
    }
    final s   = _selected!;
    final buf = StringBuffer();
    buf.writeln('[실종/위험 신고 참고 정보]');
    buf.writeln();
    buf.writeln('대상자: ${s.name}');
    if (s.age != null) buf.writeln('나이: ${s.age}세');
    if (s.phone.isNotEmpty) buf.writeln('연락처: ${s.phone}');
    buf.writeln('마지막 확인 시간: ${s.lastLocationTime.isEmpty || s.lastLocationTime == '-' ? '정보 없음' : s.lastLocationTime}');
    buf.writeln('마지막 위치: ${s.lastLocationAddress}');
    buf.writeln('안전 상태: ${s.status == '안전' ? '안전 구역 내' : '안전 구역 이탈'}');

    if (_includeHealth) {
      if (s.keyDiseases.isNotEmpty) {
        buf.writeln('주요 특이사항: ${s.keyDiseases.join(', ')}');
      }
      if (s.medicineCount != null && s.medicineCount!.isNotEmpty) {
        buf.writeln('복약 정보: ${s.medicineCount}');
      }
      if (s.healthStatus != null && s.healthStatus!.isNotEmpty) {
        buf.writeln('건강 상태: ${s.healthStatus}');
      }
    }

    buf.writeln('보호자 메모: ');

    Clipboard.setData(ClipboardData(text: buf.toString()));
    _snack('신고 정보가 복사되었습니다. 안전Dream에서 붙여넣어 신고할 수 있습니다.');
  }

  void _snack(String msg) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(msg)));

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: _kBg,
      child: _loading
          ? const Center(
              child: CircularProgressIndicator(color: _kGreen))
          : ListView(
              padding: EdgeInsets.fromLTRB(
                  16, 12, 16,
                  MediaQuery.of(context).padding.bottom + 16),
              children: [
                if (_selected != null) _buildSeniorCard(),

                const SizedBox(height: 16),

                // ① 대상자 연락
                _groupLabel('대상자 연락'),
                const SizedBox(height: 8),
                _ActionCard(
                  icon: Icons.phone_outlined,
                  iconBg: _kIconBg,
                  iconColor: _kIconGray,
                  title: '대상자 전화',
                  subtitle: _selected?.phone.isNotEmpty == true
                      ? _selected!.phone
                      : '등록된 연락처로 전화 연결',
                  onTap: () {
                    final phone = _selected?.phone ?? '';
                    if (phone.isEmpty) {
                      _snack('등록된 연락처가 없습니다.');
                    } else {
                      _call(phone);
                    }
                  },
                ),
                const SizedBox(height: 8),
                _ActionCard(
                  icon: Icons.sms_outlined,
                  iconBg: _kIconBg,
                  iconColor: _kIconGray,
                  title: '문자 보내기',
                  subtitle: '기본 문자 앱으로 연결 (SMS)',
                  onTap: () {
                    final phone = _selected?.phone ?? '';
                    if (phone.isEmpty) {
                      _snack('등록된 연락처가 없습니다.');
                    } else {
                      _sms(phone);
                    }
                  },
                ),

                const SizedBox(height: 20),

                // ② 공식 신고/상담
                _groupLabel('공식 신고 / 상담'),
                const SizedBox(height: 8),

                // 신고 정보 복사 (건강정보 포함 토글 포함)
                _CopyCard(
                  selected: _selected,
                  includeHealth: _includeHealth,
                  onToggleHealth: (v) =>
                      setState(() => _includeHealth = v),
                  onCopy: _copyReportInfo,
                ),
                const SizedBox(height: 8),

                _ActionCard(
                  icon: Icons.open_in_new_outlined,
                  iconBg: _kIconBg,
                  iconColor: _kIconGray,
                  title: '안전Dream 열기',
                  subtitle: '실종 신고 공식 사이트로 이동',
                  onTap: () => _openUrl('https://www.safe182.go.kr'),
                ),
                const SizedBox(height: 8),

                _ActionCard(
                  icon: Icons.support_agent_outlined,
                  iconBg: _kIconBg,
                  iconColor: _kIconGray,
                  title: '경찰청 182 연결',
                  subtitle: '실종 전담 상담 번호',
                  trailing: const Text('182',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: _kBlue)),
                  onTap: () => _call('182'),
                ),
                const SizedBox(height: 8),

                _ActionCard(
                  icon: Icons.emergency_outlined,
                  iconBg: _kIconBg,
                  iconColor: _kIconGray,
                  title: '긴급상황 112 연결',
                  subtitle: '생명이 위험한 긴급 상황',
                  trailing: const Text('112',
                      style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: _kRed)),
                  onTap: () => _call('112'),
                ),
              ],
            ),
    );
  }

  // ── 대상자 선택 바텀시트 ──────────────────────────────────────────────────

  void _showSeniorPicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                  color: _kDivider,
                  borderRadius: BorderRadius.circular(2)),
            ),
            const SizedBox(height: 14),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text('대상자 선택',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: _kTextMain)),
            ),
            const SizedBox(height: 10),
            for (final s in _seniors) ...[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                  backgroundColor: _kSafeBg,
                  radius: 18,
                  child: const Icon(Icons.person, size: 18, color: _kSafe),
                ),
                title: Text(s.name,
                    style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: _kTextMain)),
                subtitle: Text(s.lastLocationAddress,
                    style: const TextStyle(
                        fontSize: 11, color: _kTextSub),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                trailing: _selected?.id == s.id
                    ? const Icon(Icons.check, size: 18, color: _kGreen)
                    : null,
                onTap: () {
                  setState(() => _selected = s);
                  Navigator.pop(ctx);
                },
              ),
              if (s != _seniors.last)
                const Divider(height: 1, color: _kDivider),
            ],
            const SizedBox(height: 4),
          ]),
        ),
      ),
    );
  }

  // ── 대상자 요약 카드 ───────────────────────────────────────────────────────

  Widget _buildSeniorCard() {
    final s       = _selected!;
    final isSafe  = s.status == '안전';
    final stColor = isSafe ? _kSafe : _kWarn;
    final stBg    = isSafe ? _kSafeBg : _kWarnBg;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kDivider),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration:
              BoxDecoration(color: stBg, shape: BoxShape.circle),
          child: Icon(Icons.person, size: 22, color: stColor),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Text(s.name,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: _kTextMain)),
                if (_seniors.length > 1) ...[
                  const SizedBox(width: 8),
                  GestureDetector(
                    onTap: _showSeniorPicker,
                    child: const Text('[대상 변경]',
                        style: TextStyle(
                            fontSize: 12,
                            color: _kGreen,
                            fontWeight: FontWeight.w500)),
                  ),
                ],
              ]),
              const SizedBox(height: 2),
              Text(s.lastLocationAddress,
                  style: const TextStyle(
                      fontSize: 12, color: _kTextSub),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(
              horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
              color: stBg,
              borderRadius: BorderRadius.circular(20)),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
                width: 5,
                height: 5,
                decoration: BoxDecoration(
                    color: stColor, shape: BoxShape.circle)),
            const SizedBox(width: 4),
            Text(s.status,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: stColor)),
          ]),
        ),
      ]),
    );
  }

  Widget _groupLabel(String text) => Text(text,
      style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: _kTextSub,
          letterSpacing: 0.2));
}

// ── 신고 정보 복사 카드 (건강정보 포함 토글) ──────────────────────────────────

class _CopyCard extends StatelessWidget {
  final Senior?  selected;
  final bool     includeHealth;
  final void Function(bool) onToggleHealth;
  final VoidCallback onCopy;

  const _CopyCard({
    required this.selected,
    required this.includeHealth,
    required this.onToggleHealth,
    required this.onCopy,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kDivider),
      ),
      child: Column(children: [
        ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          leading: Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
                color: _kIconBg,
                borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.content_copy_outlined,
                size: 18, color: _kIconGray),
          ),
          title: const Text('신고 정보 복사',
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: _kTextMain)),
          subtitle: const Text('클립보드에 복사 후 안전Dream에 붙여넣기',
              style: TextStyle(fontSize: 12, color: _kTextSub)),
          trailing: const Icon(Icons.chevron_right,
              size: 18, color: _kTextHint),
          onTap: onCopy,
        ),
        const Divider(height: 1, color: _kDivider),
        Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: 14, vertical: 8),
          child: Row(children: [
            const Icon(Icons.health_and_safety_outlined,
                size: 14, color: _kTextHint),
            const SizedBox(width: 6),
            const Expanded(
              child: Text('건강정보 포함 (민감정보)',
                  style: TextStyle(
                      fontSize: 12, color: _kTextSub)),
            ),
            Transform.scale(
              scale: 0.75,
              alignment: Alignment.centerRight,
              child: Switch(
                value: includeHealth,
                onChanged: onToggleHealth,
                activeColor: _kGreen,
                materialTapTargetSize:
                    MaterialTapTargetSize.shrinkWrap,
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

// ── 공통 액션 카드 ────────────────────────────────────────────────────────────

class _ActionCard extends StatelessWidget {
  final IconData   icon;
  final Color      iconBg;
  final Color      iconColor;
  final String     title;
  final String     subtitle;
  final Widget?    trailing;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.iconBg,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.trailing,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kDivider),
      ),
      child: ListTile(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        leading: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 18, color: iconColor),
        ),
        title: Text(title,
            style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: _kTextMain)),
        subtitle: Text(subtitle,
            style: const TextStyle(
                fontSize: 12, color: _kTextSub)),
        trailing: trailing ??
            const Icon(Icons.chevron_right,
                size: 18, color: _kTextHint),
        onTap: onTap,
      ),
    );
  }
}
