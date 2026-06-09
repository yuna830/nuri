import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:kpostal/kpostal.dart';
import '../../core/api/guardian_api.dart';
import '../../core/storage/consent_storage.dart';
import '../../core/storage/guardian_session_storage.dart';
import '../auth/guardian_login_screen.dart';
import '../notification/notification_settings_screen.dart';
import 'senior_consent_screen.dart';
import '../senior/add_senior_screen.dart';
import '../senior/senior_list_screen.dart';
import 'privacy_screen.dart';

// ── 색상 ──────────────────────────────────────────────────────────────────
const _kGreen = Color(0xFF86A788);
const _kGreenBg = Color(0xFFEBF8EE);
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

  String _guardianId = '';
  String _name = '';
  String _email = '';
  String _phone = '';
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
        _guardianId = info['guardianId'] ?? '';
        _name = info['name'] ?? '';
        _email = info['email'] ?? '';
        _phone = info['phone'] ?? '';
        _address = info['address'] ?? '';
        _consents = consents;
      });
    }
  }

  Future<void> _saveConsent(String key, bool v) async {
    setState(() => _consents[key] = v);
    await _consent.set(key, v);
  }

  void _showProfileEditModal() {
    final nameCtrl = TextEditingController(text: _name);
    final emailCtrl = TextEditingController(text: _email);
    final phoneCtrl = TextEditingController(text: _phone);
    final addressCtrl = TextEditingController(text: _address);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        bool isSaving = false;

        return StatefulBuilder(
          builder: (ctx, setModalState) {
            Future<void> onSave() async {
              setModalState(() => isSaving = true);
              final nav = Navigator.of(ctx);
              try {
                final id = int.tryParse(_guardianId) ?? 0;
                final updated = await GuardianApi().updateGuardianProfile(
                  guardianId: id,
                  name: nameCtrl.text.trim(),
                  email: emailCtrl.text.trim(),
                  phone: phoneCtrl.text.trim(),
                  address: addressCtrl.text.trim(),
                );
                await _session.saveGuardianInfo(
                  guardianId: _guardianId,
                  name: updated['name'] ?? nameCtrl.text.trim(),
                  email: updated['email'] ?? emailCtrl.text.trim(),
                  phone: updated['phone'] ?? phoneCtrl.text.trim(),
                  address: updated['address'] ?? addressCtrl.text.trim(),
                );
                nav.pop();
                _load();
              } catch (e) {
                setModalState(() => isSaving = false);
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(e.toString().replaceAll('Exception: ', '')),
                    backgroundColor: _kRed,
                  ),
                );
              }
            }

            return SingleChildScrollView(
              padding: EdgeInsets.only(
                left: 24,
                right: 24,
                top: 24,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 32,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 핸들
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: _kDivider,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  // 이름 + 전화번호 한 줄
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: _modalField('이름', nameCtrl, hintText: '이름'),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 3,
                        child: _modalField(
                          '전화번호',
                          phoneCtrl,
                          hintText: '010-0000-0000',
                          keyboardType: TextInputType.phone,
                          inputFormatters: [_PhoneInputFormatter()],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  // 이메일
                  _modalField(
                    '이메일',
                    emailCtrl,
                    hintText: '이메일을 입력하세요',
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 14),
                  // 주소 (카카오 주소 검색)
                  // 주소 검색 (인라인)
                  // 주소
                  const Text(
                    '주소',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: _kTextSub,
                    ),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: addressCtrl,
                    readOnly: true,
                    onTap: () {
                      Navigator.push(
                        ctx,
                        PageRouteBuilder(
                          pageBuilder: (_, __, ___) => KpostalView(
                            callback: (Kpostal result) {
                              addressCtrl.text = result.address;
                              setModalState(() {});
                            },
                          ),
                          transitionsBuilder: (_, animation, __, child) {
                            return SlideTransition(
                              position:
                                  Tween<Offset>(
                                    begin: const Offset(0, 1),
                                    end: Offset.zero,
                                  ).animate(
                                    CurvedAnimation(
                                      parent: animation,
                                      curve: Curves.easeOut,
                                    ),
                                  ),
                              child: child,
                            );
                          },
                          transitionDuration: const Duration(milliseconds: 300),
                        ),
                      );
                    },
                    decoration: InputDecoration(
                      hintText: '주소를 검색하세요',
                      hintStyle: const TextStyle(color: _kTextHint),
                      filled: true,
                      fillColor: const Color(0xFFF5F5F5),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      suffixIcon: const Icon(
                        Icons.search,
                        color: _kGreen,
                        size: 20,
                      ),
                    ),
                  ),

                  const SizedBox(height: 28),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: _kGreen,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
                      ),
                      onPressed: isSaving ? null : onSave,
                      child: isSaving
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : const Text(
                              '저장',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _modalField(
    String label,
    TextEditingController ctrl, {
    String? hintText,
    TextInputType keyboardType = TextInputType.text,
    List<TextInputFormatter>? inputFormatters, // ← 추가
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: _kTextSub,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          inputFormatters: inputFormatters, // ← 추가
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: const TextStyle(color: _kTextHint),
            filled: true,
            fillColor: const Color(0xFFF5F5F5),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 12,
            ),
          ),
        ),
      ],
    );
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
                    onTap: _showProfileEditModal,
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

class _PhoneInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    final buffer = StringBuffer();

    for (int i = 0; i < digits.length && i < 11; i++) {
      if (i == 3 || i == 7) buffer.write('-');
      buffer.write(digits[i]);
    }

    final formatted = buffer.toString();
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
