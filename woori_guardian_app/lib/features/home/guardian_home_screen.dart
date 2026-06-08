import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../location/location_tab_screen.dart';
import '../notification/notification_center_screen.dart';
import '../report/report_screen.dart';
import '../contact/contact_senior_screen.dart';
import '../mypage/mypage_screen.dart';
import '../auth/guardian_login_screen.dart';
import '../face/face_check_camera_screen.dart';
import '../../core/api/guardian_api.dart';
import '../../core/config/app_config.dart';
import '../../core/models/senior.dart';
import '../../core/storage/consent_storage.dart';
import '../../core/storage/guardian_session_storage.dart';
import '../../core/widgets/app_header.dart';
import '../../core/push/fcm_service.dart';
import '../chat/guardian_chat_screen.dart';
import '../senior/senior_detail_screen.dart';

// 한 곳에서 색상을 관리해 변경 시 전체가 일관되게 반영됩니다.
abstract final class _C {
  /// 브랜드 그린 — AppBar·메인 버튼·포인트에만 사용
  static const green = Color(0xFF86A788);

  /// 텍스트: 제목
  static const textTitle = Color(0xFF1C1C1E);

  /// 텍스트: 보조 정보
  static const textSub = Color(0xFF6C6C70);

  /// 텍스트: 힌트 / 타임스탬프
  static const textHint = Color(0xFFAEAEB2);

  /// 구분선 / 카드 테두리
  static const divider = Color(0xFFE5E5EA);

  /// 상태: 안전 — 앱 브랜드 초록 계열로 통일
  static const safe = Color(0xFF4A7A4C);
  static const safeBg = Color(0xFFEEF5EE);

  /// 상태: 주의
  static const warn = Color(0xFFFF9500);
  static const warnBg = Color(0xFFFFF4E5);

  /// 위험(신고) 빨강
  static const danger = Color(0xFFB85252);
}

// GuardianHomeScreen — 탭 셸

class GuardianHomeScreen extends StatefulWidget {
  const GuardianHomeScreen({super.key});

  @override
  State<GuardianHomeScreen> createState() => _GuardianHomeScreenState();
}

class _GuardianHomeScreenState extends State<GuardianHomeScreen> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();

  int _selectedIndex = 0;
  String _guardianName = '';
  String _guardianEmail = '';
  int _unreadCount = 0;
  int _unreadChatCount = 0;
  Timer? _unreadTimer;

  int? _selectedSeniorId; // 위치 탭으로 넘길 어르신 ID

  static const _tabTitles = ['', '위치', '실종/위험 신고', '긴급 연락', ''];

  @override
  void initState() {
    super.initState();
    _loadSessionInfo();
    _unreadTimer = Timer.periodic(
      const Duration(seconds: 10),
      (_) => _refreshUnreadCounts(),
    );
  }

  @override
  void dispose() {
    _unreadTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadSessionInfo() async {
    try {
      final info = await _sessionStorage.getGuardianInfo();
      final idStr = info['guardianId'];
      if (idStr == null || idStr.trim().isEmpty) {
        if (!mounted) return;
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const GuardianLoginScreen()),
          (_) => false,
        );
        return;
      }
      final guardianId = int.tryParse(idStr);
      if (guardianId == null) {
        await _sessionStorage.clearSession();
        if (!mounted) return;
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const GuardianLoginScreen()),
          (_) => false,
        );
        return;
      }

      if (mounted) {
        setState(() {
          _guardianName = info['name'] ?? '';
          _guardianEmail = info['email'] ?? '';
        });
      }

      // FCM 초기화 및 토큰 등록
      await FcmService.init(role: 'GUARDIAN', userId: guardianId);

      await _refreshUnreadCounts();
    } catch (_) {}
  }

  Future<void> _refreshUnreadCount([int? gId]) async {
    try {
      final id = gId ?? await _getGuardianId();
      if (id == null) return;
      final alerts = await _api.fetchGuardianAlerts(id);
      if (mounted) {
        setState(() => _unreadCount = alerts.where((a) => !a.isRead).length);
      }
    } catch (_) {}
  }

  Future<void> _refreshUnreadCounts() async {
    final guardianId = await _getGuardianId();
    if (guardianId == null) return;

    await Future.wait([
      _refreshUnreadCount(guardianId),
      _refreshUnreadChatCount(guardianId),
    ]);
  }

  Future<void> _refreshUnreadChatCount(int guardianId) async {
    try {
      final seniors = await _api.fetchGuardianSeniors(guardianId);
      var total = 0;

      for (final senior in seniors) {
        final url = Uri.parse(
          '${AppConfig.apiBaseUrl}/chat/unread'
          '?viewerRole=GUARDIAN&seniorId=${senior.id}',
        );

        final response = await http
            .get(url)
            .timeout(const Duration(seconds: 5));
        if (response.statusCode != 200) continue;

        final data = jsonDecode(utf8.decode(response.bodyBytes));
        if (data is Map<String, dynamic>) {
          total += (data['count'] as num?)?.toInt() ?? 0;
        }
      }

      if (mounted) {
        setState(() => _unreadChatCount = total);
      }
    } catch (_) {}
  }

  Future<void> _openChat() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const GuardianChatScreen()),
    );
    _refreshUnreadCounts();
  }

  Future<int?> _getGuardianId() async {
    final info = await _sessionStorage.getGuardianInfo();
    final s = info['guardianId'];
    if (s == null || s.isEmpty) return null;
    return int.tryParse(s);
  }

  void _navigateToLocationTab(int seniorId) {
    setState(() {
      _selectedSeniorId = seniorId;
      _selectedIndex = 1;
    });
  }

  void _navigateToReportTab() => setState(() => _selectedIndex = 2);

  Future<void> _openNotificationCenter() async {
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const NotificationCenterScreen()),
    );
    _refreshUnreadCount();
  }

  String get _headerTitle {
    if (_selectedIndex == 0) {
      final name = _guardianName.isNotEmpty ? _guardianName : '보호자';
      return '$name님, 안녕하세요';
    }
    if (_selectedIndex == 4) {
      return '보호자 페이지';
    }
    return _tabTitles[_selectedIndex];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppHeader(
        title: _headerTitle,
        unreadCount: _unreadCount,
        chatUnreadCount: _unreadChatCount,
        onNotificationTap: _openNotificationCenter,
        onChatTap: _openChat,
      ),
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          _HomeTab(
            onViewLocation: _navigateToLocationTab,
            onReport: _navigateToReportTab,
          ),
          LocationTabScreen(initialSeniorId: _selectedSeniorId),
          const ReportScreen(),
          const ContactSeniorScreen(),
          const MypageScreen(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _selectedIndex,
        onTap: (i) => setState(() => _selectedIndex = i),
        selectedItemColor: _C.green,
        unselectedItemColor: _C.textHint,
        backgroundColor: Colors.white,
        elevation: 8,
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.home_outlined),
            activeIcon: Icon(Icons.home),
            label: '홈',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.location_on_outlined),
            activeIcon: Icon(Icons.location_on),
            label: '위치',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.report_problem_outlined),
            activeIcon: Icon(Icons.report_problem),
            label: '신고',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.phone_outlined),
            activeIcon: Icon(Icons.phone),
            label: '연락',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: '마이',
          ),
        ],
      ),
    );
  }
}

// _HomeTab

class _HomeTab extends StatefulWidget {
  final void Function(int seniorId) onViewLocation;
  final VoidCallback onReport;

  const _HomeTab({required this.onViewLocation, required this.onReport});

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();

  bool _isLoading = true;
  String? _errorMessage;
  List<Senior> _seniors = [];

  @override
  void initState() {
    super.initState();
    _loadSeniors();
  }

  Future<void> _loadSeniors() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    try {
      final info = await _sessionStorage.getGuardianInfo();
      final idStr = info['guardianId'];
      if (idStr == null || idStr.isEmpty) {
        throw Exception('보호자 세션 정보가 없습니다. 다시 로그인해주세요.');
      }
      final seniors = await _api.fetchGuardianSeniors(int.parse(idStr));
      if (mounted)
        setState(() {
          _seniors = seniors;
          _isLoading = false;
        });
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator(color: _C.green));
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: _C.danger),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                style: const TextStyle(color: _C.danger, fontSize: 15),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loadSeniors,
                style: FilledButton.styleFrom(backgroundColor: _C.green),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
      );
    }

    if (_seniors.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.people_outline, size: 56, color: _C.textHint),
            const SizedBox(height: 12),
            const Text(
              '담당 어르신이 없습니다.',
              style: TextStyle(fontSize: 16, color: _C.textSub),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadSeniors,
      color: _C.green,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
        children: [
          _FaceCheckCard(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const FaceCheckCameraScreen(),
                ),
              );
            },
          ),
          const SizedBox(height: 12),
          for (var i = 0; i < _seniors.length; i++) ...[
            _SeniorCard(
              senior: _seniors[i],
              onViewLocation: widget.onViewLocation,
              onReport: widget.onReport,
              onOpenDetail: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => SeniorDetailScreen(senior: _seniors[i]),
                  ),
                );
              },
            ),
            if (i < _seniors.length - 1) const SizedBox(height: 12),
          ],
        ],
      ),
    );
  }
}

// _SeniorCard

class _FaceCheckCard extends StatelessWidget {
  final VoidCallback onTap;

  const _FaceCheckCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE0E8E0), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _C.safeBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.camera_alt_outlined,
                  color: _C.safe,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '얼굴 확인',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: _C.textTitle,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      '카메라로 얼굴을 촬영해 등록된 실종자 정보와 비교합니다.',
                      style: TextStyle(fontSize: 12, color: _C.textSub),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right, size: 22, color: _C.textHint),
            ],
          ),
        ),
      ),
    );
  }
}

class _SeniorCard extends StatelessWidget {
  final Senior senior;
  final void Function(int seniorId) onViewLocation;
  final VoidCallback onReport;
  final VoidCallback onOpenDetail;

  const _SeniorCard({
    required this.senior,
    required this.onViewLocation,
    required this.onReport,
    required this.onOpenDetail,
  });

  Future<void> _callPhone(BuildContext context, String phone) async {
    final consents = await ConsentStorage().load();

    if (!(consents[ConsentStorage.guardianContactShareKey] ?? true)) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('내 연락처 공개가 비활성화되어 있습니다. 마이페이지 > 내 정보 제공 설정에서 켜주세요.'),
          ),
        );
      }
      return;
    }

    final uri = Uri(scheme: 'tel', path: phone);

    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('전화 앱을 열 수 없습니다.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onOpenDetail,
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFFE0E8E0), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.06),
                blurRadius: 14,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── 헤더: 이름 + 나이 / 상태 배지 ──────────────────
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      senior.name,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: _C.textTitle,
                      ),
                    ),
                    if (senior.age != null) ...[
                      const SizedBox(width: 6),
                      Text(
                        '${senior.age}세',
                        style: const TextStyle(fontSize: 13, color: _C.textSub),
                      ),
                    ],
                    const Spacer(),
                    _StatusBadge(status: senior.status),
                  ],
                ),

                const SizedBox(height: 12),
                const Divider(color: _C.divider, height: 1),
                const SizedBox(height: 10),

                // ── 정보 행들 ─────────────────────────────────────
                _InfoRow(
                  icon: Icons.location_on_outlined,
                  label: senior.lastLocationAddress,
                  sub: '마지막 확인 ${senior.lastLocationTime}',
                ),

                if (senior.keyDiseases.isNotEmpty) ...[
                  const SizedBox(height: 7),
                  _InfoRow(
                    icon: Icons.local_hospital_outlined,
                    label: senior.keyDiseases.join(' · '),
                  ),
                ],

                if (senior.medicineCount != null &&
                    senior.medicineCount!.isNotEmpty) ...[
                  const SizedBox(height: 7),
                  _InfoRow(
                    icon: Icons.medication_outlined,
                    label: '복약 중 ${senior.medicineCount}',
                  ),
                ],

                // 질환 없을 때만 healthStatus 표시
                if (senior.keyDiseases.isEmpty &&
                    senior.healthStatus != null &&
                    senior.healthStatus!.isNotEmpty) ...[
                  const SizedBox(height: 7),
                  _InfoRow(
                    icon: Icons.favorite_outline,
                    label: senior.healthStatus!,
                  ),
                ],

                const SizedBox(height: 14),

                // ── 버튼 영역 ─────────────────────────────────────
                // 위치: 메인(filled) / 전화: 보조(outlined) / 신고: 위험(text)
                Row(
                  children: [
                    // 전화 — 보조 액션 (outlined, 아이콘만)
                    SizedBox(
                      width: 44,
                      height: 40,
                      child: OutlinedButton(
                        onPressed: senior.phone.isNotEmpty
                            ? () => _callPhone(context, senior.phone)
                            : null,
                        style: OutlinedButton.styleFrom(
                          padding: EdgeInsets.zero,
                          side: BorderSide(
                            color: senior.phone.isNotEmpty
                                ? _C.divider
                                : _C.textHint.withValues(alpha: 0.3),
                          ),
                          foregroundColor: _C.textSub,
                          disabledForegroundColor: _C.textHint,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Icon(Icons.call_outlined, size: 18),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // 위치 보기 — 메인 액션 (filled, 확장, 텍스트 유지)
                    Expanded(
                      child: SizedBox(
                        height: 40,
                        child: FilledButton.icon(
                          onPressed: () => onViewLocation(senior.id),
                          style: FilledButton.styleFrom(
                            backgroundColor: _C.green,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                          icon: const Icon(
                            Icons.location_on_outlined,
                            size: 16,
                          ),
                          label: const Text(
                            '위치 보기',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // 신고 — 위험 액션 (아이콘만, 빨간 테두리)
                    SizedBox(
                      width: 44,
                      height: 40,
                      child: OutlinedButton(
                        onPressed: onReport,
                        style: OutlinedButton.styleFrom(
                          padding: EdgeInsets.zero,
                          foregroundColor: _C.danger,
                          side: BorderSide(
                            color: _C.danger.withValues(alpha: 0.4),
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        child: const Icon(
                          Icons.report_problem_outlined,
                          size: 18,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 작은 위젯들
// ═══════════════════════════════════════════════════════════════════════════════

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final isSafe = status == '안전';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: isSafe ? _C.safeBg : _C.warnBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: isSafe ? _C.safe : _C.warn,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            status,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isSafe ? _C.safe : _C.warn,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? sub;

  const _InfoRow({required this.icon, required this.label, this.sub});

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          // 아이콘 색상은 단일 gray — 카드 내 컬러 노이즈 제거
          child: Icon(icon, size: 14, color: _C.textHint),
        ),
        const SizedBox(width: 7),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  color: _C.textTitle,
                  height: 1.3,
                ),
              ),
              if (sub != null)
                Text(
                  sub!,
                  style: const TextStyle(
                    fontSize: 11,
                    color: _C.textHint,
                    height: 1.4,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
