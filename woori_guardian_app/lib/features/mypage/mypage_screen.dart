import 'package:flutter/material.dart';
import '../../core/storage/consent_storage.dart';
import '../../core/storage/guardian_session_storage.dart';
import '../auth/guardian_login_screen.dart';
import '../notification/notification_settings_screen.dart';
import 'senior_consent_screen.dart';
import '../senior/add_senior_screen.dart';
import '../senior/senior_list_screen.dart';
import 'privacy_screen.dart';
import 'profile_edit_screen.dart';

// ── 색상 토큰 ──────────────────────────────────────────────────────────────────
const _kGreen = Color(0xFF86A788);
const _kGreenBg = Color(0xFFEBF8EE);
const _kBg = Colors.white;
const _kDivider = Color(0xFFE5E5EA);
const _kTextMain = Color(0xFF1C1C1E);
const _kTextSub = Color(0xFF6C6C70);
const _kTextHint = Color(0xFFAEAEB2);
const _kRed = Color(0xFFB85252);

class MypageScreen extends StatefulWidget {
  const MypageScreen({super.key});

  @override
  State<MypageScreen> createState() => _MypageScreenState();
}

class _MypageScreenState extends State<MypageScreen> {
  final _session = GuardianSessionStorage();
  final _consent = ConsentStorage();

  String _name = '';
  String _email = '';
  // TODO: 백엔드 Guardian 엔티티에 address 필드 추가 및 세션 저장 후 활용
  String _address = '';

  Map<String, bool> _consents = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final info = await _session.getGuardianInfo();
    final consents = await _consent.load();
    if (mounted) {
      setState(() {
        _name = info['name'] ?? '';
        _email = info['email'] ?? '';
        // TODO: 세션에 address 저장 후 info['address'] ?? '' 로 교체
        _address = info['address'] ?? '';
        _consents = consents;
      });
    }
  }

  Future<void> _saveConsent(String key, bool v) async {
    setState(() => _consents[key] = v);
    await _consent.set(key, v);
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        content: const Padding(
          padding: EdgeInsets.only(top: 12),
          child: Text(
            '로그아웃 하시겠습니까?',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: _kTextSub),
          ),
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        actions: [
          SizedBox(
            width: double.infinity,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: _kTextSub,
                    textStyle: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onPressed: () => Navigator.pop(context, false),
                  child: const Text('취소'),
                ),
                TextButton(
                  style: TextButton.styleFrom(
                    foregroundColor: _kRed,
                    textStyle: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  onPressed: () => Navigator.pop(context, true),
                  child: const Text('로그아웃'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      await _session.clearSession();
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const GuardianLoginScreen()),
        (_) => false,
      );
    }
  }

  void _go(Widget w) =>
      Navigator.push(context, MaterialPageRoute(builder: (_) => w));

  bool _cv(String key, bool def) => _consents[key] ?? def;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const ClampingScrollPhysics(),
      padding: EdgeInsets.zero,
      children: [
        // ── 프로필 요약 ──────────────────────────────────────
        _buildProfile(),
        const SizedBox(height: 16),

        // ── 섹션 1: 보호 대상자 관리 ─────────────────────────
        _sectionLabel('보호 대상자 관리'),
        const SizedBox(height: 6),
        _navItem(
          icon: Icons.people_outline,
          label: '보호 대상자 목록',
          onTap: () => _go(const SeniorListScreen()),
        ),
        _divider(),
        _navItem(
          icon: Icons.person_add_outlined,
          label: '보호 대상자 추가',
          onTap: () => _go(const AddSeniorScreen()),
        ),
        _divider(),
        _navItem(
          icon: Icons.assignment_outlined,
          label: '대상자 정보 동의 관리',
          onTap: () => _go(const SeniorConsentScreen()),
        ),
        const SizedBox(height: 24),

        // ── 섹션 2: 정보 제공 동의 ───────────────────────────
        _buildMyInfoConsentSection(),
        const SizedBox(height: 24),

        // ── 섹션 3: 앱 설정 ──────────────────────────────────
        _sectionLabel('앱 설정'),
        const SizedBox(height: 6),
        _navItem(
          icon: Icons.notifications_outlined,
          label: '알림 설정',
          onTap: () => _go(const NotificationSettingsScreen()),
        ),
        _divider(),
        _navItem(
          icon: Icons.privacy_tip_outlined,
          label: '개인정보 처리 안내',
          onTap: () => _go(const PrivacyScreen()),
        ),
        const SizedBox(height: 24),

        // ── 섹션 4: 계정 ─────────────────────────────────────
        _sectionLabel('계정'),
        const SizedBox(height: 6),
        _navItem(
          icon: Icons.logout,
          label: '로그아웃',
          labelColor: _kRed,
          iconColor: _kRed,
          onTap: _logout,
        ),
        const SizedBox(height: 16),
      ],
    );
  }

  // ── 프로필 헤더 ─────────────────────────────────────────────────────────────
  Widget _buildProfile() => Container(
    color: Colors.white,
    padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        CircleAvatar(
          radius: 28,
          backgroundColor: _kGreenBg,
          child: Text(
            _name.isNotEmpty ? _name[0] : '?',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
              color: _kGreen,
            ),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Text(
                      _name.isNotEmpty ? _name : '보호자',
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: _kTextMain,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () => _go(const ProfileEditScreen()),
                    child: const Text(
                      '정보 수정',
                      style: TextStyle(
                        fontSize: 13,
                        color: _kGreen,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
              if (_email.isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(
                  _email,
                  style: const TextStyle(fontSize: 13, color: _kTextSub),
                ),
              ],
              const SizedBox(height: 3),
              Text(
                _address.isNotEmpty ? _address : '주소 정보 없음',
                style: const TextStyle(fontSize: 13, color: _kTextHint),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ],
    ),
  );

  // 정보 제공 동의 섹션 빌더
  Widget _buildMyInfoConsentSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('내 정보 제공 설정'),
        const SizedBox(height: 6),
        _toggleItem(
          icon: Icons.contact_phone_outlined,
          label: '내 연락처 공개',
          desc: '보호 대상자가 전화/문자 연결을 할 수 있도록 내 연락처를 제공합니다.',
          key: ConsentStorage.guardianContactShareKey,
          def: true,
        ),
        _divider(),
        _toggleItem(
          icon: Icons.sos_outlined,
          label: '긴급 연락 수신 동의',
          desc: 'SOS, 낙상, 위험 상황 발생 시 긴급 연락 대상으로 등록됩니다.',
          key: ConsentStorage.emergencyContactReceiveKey,
          def: true,
        ),
        _divider(),
        _toggleItem(
          icon: Icons.support_agent_outlined,
          label: '복지사 상담 시 정보 제공',
          desc: '상담 연결이 필요할 때 담당 복지사에게 보호자 이름/연락처를 제공합니다.',
          key: ConsentStorage.welfareConsultInfoShareKey,
          def: true,
        ),
        _divider(),
        _toggleItem(
          icon: Icons.assignment_outlined,
          label: '신고 지원 정보 제공',
          desc: '실종/위험 신고 참고 정보에 보호자 이름/연락처를 포함합니다.',
          key: ConsentStorage.reportSupportInfoShareKey,
          def: true,
        ),
      ],
    );
  }

  // ── 공통 소컴포넌트 ─────────────────────────────────────────────────────────
  Widget _sectionLabel(String text) => Padding(
    padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
    child: Text(
      text,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: _kTextSub,
        letterSpacing: 0.3,
      ),
    ),
  );

  Widget _divider() =>
      const Divider(height: 1, indent: 16, endIndent: 16, color: _kDivider);

  Widget _navItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? labelColor,
    Color? iconColor,
    String? badge,
  }) => ColoredBox(
    color: Colors.white,
    child: ListTile(
      minVerticalPadding: 14,
      leading: Icon(icon, color: iconColor ?? _kTextSub, size: 22),
      title: Text(
        label,
        style: TextStyle(fontSize: 15, color: labelColor ?? _kTextMain),
      ),
      trailing: badge != null
          ? Text(badge, style: const TextStyle(fontSize: 12, color: _kTextHint))
          : const Icon(Icons.chevron_right, color: _kTextHint, size: 20),
      onTap: onTap,
    ),
  );

  Widget _toggleItem({
    required IconData icon,
    required String label,
    required String desc,
    required String key,
    required bool def,
  }) {
    final value = _cv(key, def);
    return ColoredBox(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            Icon(icon, color: value ? _kGreen : _kTextHint, size: 22),
            const SizedBox(width: 18),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 15,
                      color: value ? _kTextMain : _kTextHint,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    desc,
                    style: const TextStyle(
                      fontSize: 12,
                      color: _kTextSub,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            Switch(
              value: value,
              onChanged: (v) => _saveConsent(key, v),
              activeColor: _kGreen,
            ),
          ],
        ),
      ),
    );
  }
}
