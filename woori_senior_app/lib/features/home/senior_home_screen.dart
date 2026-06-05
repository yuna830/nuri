import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';
import '../../core/storage/senior_session_storage.dart';
import '../auth/login_screen.dart';
import '../fall/fall_history_screen.dart';
import '../job/job_screen.dart';
import '../location/location_screen.dart';
import '../profile/profile_screen.dart';
import '../weather/weather_screen.dart';

// ─────────────────────────────────────────────
//  helpers (top-level, 외부 접근 가능)
// ─────────────────────────────────────────────

String scheduleTitle(dynamic schedule) {
  if (schedule is! Map<String, dynamic>) return '일정';
  for (final key in ['title', 'content', 'text']) {
    final v = schedule[key];
    final t = v == null ? '' : '$v'.trim();
    if (t.isNotEmpty && t != 'null') return t;
  }
  return '일정';
}

String scheduleTime(dynamic schedule) {
  if (schedule is! Map<String, dynamic>) return '';
  for (final key in ['scheduleTime', 'time']) {
    final v = schedule[key];
    final t = v == null ? '' : '$v'.trim();
    if (t.isNotEmpty) return t.length >= 5 ? t.substring(0, 5) : t;
  }
  return '';
}

/// profileImageUrl 정규화
/// - 상대경로 (/uploads/...) → apiBaseUrl 붙이기
/// - localhost/127.0.0.1 URL → apiBaseUrl 호스트로 교체
/// - 그 외 완전한 URL → 그대로 사용
String _resolveImageUrl(String url) {
  if (url.isEmpty) return url;

  // 상대경로
  if (url.startsWith('/')) return '$apiBaseUrl$url';

  // localhost or 127.0.0.1 → 에뮬레이터에서 접근 불가, apiBaseUrl로 교체
  try {
    final uri = Uri.parse(url);
    if (uri.host == 'localhost' || uri.host == '127.0.0.1' || uri.host == '::1') {
      final base = Uri.parse(apiBaseUrl);
      return uri.replace(host: base.host, port: base.port).toString();
    }
  } catch (_) {}

  return url;
}

List<String> _parseList(dynamic v) {
  if (v == null) return [];
  if (v is List) return v.map((e) => '$e').toList();
  final s = '$v'.trim();
  if (s.isEmpty || s == '[]') return [];
  return s.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
}

String _textFrom(Map<String, dynamic> data, List<String> keys, String fallback) {
  for (final key in keys) {
    final v = data[key];
    final t = v == null ? '' : '$v'.trim();
    if (t.isNotEmpty && t != 'null') return t;
  }
  return fallback;
}

bool _isToday(dynamic value) {
  if (value == null) return false;
  final d = DateTime.tryParse('$value');
  if (d == null) return false;
  final now = DateTime.now();
  return d.year == now.year && d.month == now.month && d.day == now.day;
}

// ─────────────────────────────────────────────
//  alert 유형 helpers
// ─────────────────────────────────────────────
bool _isSos(Map a) => a['type'] == 'SOS';
bool _isCallRequest(Map a) => a['type'] == 'CALL_REQUEST' && a['isRead'] != true;
bool _isMedicine(Map a) => a['type'] == 'MEDICINE' && a['isRead'] != true;
bool _isInfoRequest(Map a) => a['type'] == 'INFO_UPDATE_REQUEST' && a['isRead'] != true;
bool _isCheckIn(Map a) => a['type'] == 'CHECK_IN_MESSAGE' && a['isRead'] != true;

// ─────────────────────────────────────────────
//  SeniorHomeScreen
// ─────────────────────────────────────────────

typedef ActionRegistrar = void Function({
  required VoidCallback action,
  required IconData icon,
  required String tooltip,
});

class SeniorHomeScreen extends StatefulWidget {
  const SeniorHomeScreen({
    super.key,
    required this.seniorId,
    this.onTabSwitch,
    this.hideAppBar = false,
    this.onRegisterAction,
  });

  final int seniorId;
  final ValueChanged<int>? onTabSwitch;
  final bool hideAppBar;
  final ActionRegistrar? onRegisterAction;

  @override
  State<SeniorHomeScreen> createState() => _SeniorHomeScreenState();
}

class _SeniorHomeScreenState extends State<SeniorHomeScreen>
    with WidgetsBindingObserver {
  final _api = const SeniorApi();

  late Future<SeniorHomeData> _homeDataFuture;
  SeniorHomeData? _cachedData;

  Timer? _alertTimer;
  List<dynamic> _alerts = [];
  bool _sosPending = false;

  // 각 알림 타입별 현재 알림 (null=없음)
  Map<String, dynamic>? _callAlert;
  Map<String, dynamic>? _medicineAlert;
  Map<String, dynamic>? _infoAlert;
  Map<String, dynamic>? _checkInAlert;

  // 안부 답장 입력용
  final _replyController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _homeDataFuture = _loadHomeData();
    _startAlertPolling();
    widget.onRegisterAction?.call(
      action: _showLogoutDialog,
      icon: Icons.logout,
      tooltip: '로그아웃',
    );
  }

  @override
  void dispose() {
    _alertTimer?.cancel();
    _replyController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) {
      _pollAlerts();
      setState(() {
        _homeDataFuture = _loadHomeData();
      });
    }
  }

  Future<SeniorHomeData> _loadHomeData() async {
    final data = await _api.fetchHomeData(widget.seniorId);
    _cachedData = data;
    _processAlerts(data.alerts);
    return data;
  }

  void _startAlertPolling() {
    _alertTimer = Timer.periodic(const Duration(seconds: 5), (_) => _pollAlerts());
  }

  Future<void> _pollAlerts() async {
    try {
      final alerts = await _api.fetchAlerts(widget.seniorId);
      if (!mounted) return;
      _processAlerts(alerts);
    } catch (_) {}
  }

  void _processAlerts(List<dynamic> alerts) {
    if (!mounted) return;
    setState(() {
      _alerts = alerts;
      _callAlert = _firstOfType(alerts, _isCallRequest);
      _medicineAlert = _firstOfType(alerts, _isMedicine);
      _infoAlert = _firstOfType(alerts, _isInfoRequest);
      _checkInAlert = _firstOfType(alerts, _isCheckIn);

      // SOS pending: SOS가 있고 unread면 pending 표시
      final sosList = alerts.whereType<Map<String, dynamic>>().where(_isSos).toList();
      if (_sosPending && sosList.isEmpty) _sosPending = false;
    });
  }

  Map<String, dynamic>? _firstOfType(List<dynamic> alerts, bool Function(Map) test) {
    for (final a in alerts) {
      if (a is Map<String, dynamic> && test(a)) return a;
    }
    return null;
  }

  int _todayFallCount() {
    return _alerts.where((a) {
      if (a is! Map<String, dynamic>) return false;
      final type = '${a['type'] ?? ''}';
      if (type != 'FALL_DETECTED' && type != 'FALL_RISK') return false;
      return _isToday(a['createdAt']);
    }).length;
  }

  Future<void> _refresh() async {
    setState(() {
      _homeDataFuture = _loadHomeData();
    });
  }

  // ── SOS ────────────────────────────────────────
  void _showSosDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Text('🚨', style: TextStyle(fontSize: 54)),
        title: const Text('SOS를 보내시겠어요?',
            textAlign: TextAlign.center,
            style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('보호자와 담당 복지사에게 긴급 알림이 전송됩니다.',
            textAlign: TextAlign.center),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFD94E4E)),
            onPressed: () {
              Navigator.pop(ctx);
              _sendSos();
            },
            child: const Text('보내기'),
          ),
        ],
      ),
    );
  }

  Future<void> _sendSos() async {
    try {
      await _api.sendSos(widget.seniorId);
      if (!mounted) return;
      setState(() => _sosPending = true);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SOS가 보호자에게 전송되었어요.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SOS 전송에 실패했어요. 잠시 후 다시 눌러주세요.')),
      );
    }
  }

  Future<void> _cancelSos() async {
    try {
      await _api.sendSosCancel(widget.seniorId);
    } catch (_) {}
    if (!mounted) return;
    setState(() => _sosPending = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('보호자에게 잘못 누름 알림을 보냈어요.')),
    );
  }

  // ── 알림 처리 ──────────────────────────────────
  Future<void> _readAlert(dynamic alertId) async {
    if (alertId == null) return;
    // JSON int는 int or num으로 올 수 있음
    final id = alertId is int ? alertId : int.tryParse('$alertId');
    if (id == null) return;
    try {
      await _api.readAlert(id);
    } catch (_) {}
  }

  Future<void> _handleCallAlert() async {
    final alert = _callAlert;
    await _readAlert(alert?['id']);
    setState(() => _callAlert = null);
    final phone = _cachedData?.senior['guardian'] is Map
        ? '${(_cachedData!.senior['guardian'] as Map)['phone'] ?? ''}'
        : '';
    if (phone.isNotEmpty && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('보호자($phone)에게 전화해주세요.')),
      );
    }
  }

  Future<void> _dismissCallAlert() async {
    await _readAlert(_callAlert?['id']);
    setState(() => _callAlert = null);
  }

  Future<void> _dismissMedicineAlert() async {
    await _readAlert(_medicineAlert?['id']);
    setState(() => _medicineAlert = null);
  }

  Future<void> _dismissInfoAlert() async {
    await _readAlert(_infoAlert?['id']);
    setState(() => _infoAlert = null);
  }

  Future<void> _sendCheckInReply() async {
    final reply = _replyController.text.trim();
    if (reply.isEmpty) return;
    try {
      await _api.sendCheckInReply(
        seniorId: widget.seniorId,
        reply: reply,
        originalMessage: '${_checkInAlert?['message'] ?? ''}',
      );
      await _readAlert(_checkInAlert?['id']);
      if (!mounted) return;
      setState(() => _checkInAlert = null);
      _replyController.clear();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('보호자에게 답장을 보냈어요.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('답장 전송에 실패했어요.')),
      );
    }
  }

  Future<void> _dismissCheckInAlert() async {
    await _readAlert(_checkInAlert?['id']);
    setState(() {
      _checkInAlert = null;
      _replyController.clear();
    });
  }

  // ── 로그아웃 ───────────────────────────────────
  void _showLogoutDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('로그아웃', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('로그아웃 하시겠어요?'),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await SeniorSessionStorage.clear();
              if (!mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(
                    builder: (_) => const SeniorLoginScreen()),
                (_) => false,
              );
            },
            child: const Text('로그아웃'),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────
  //  build
  // ─────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFDEC),
      appBar: widget.hideAppBar
          ? null
          : AppBar(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.white,
              elevation: 0,
              title: const Text(
                '우리 woori',
                style: TextStyle(
                  color: Color(0xFF86A788),
                  fontSize: 24,
                  fontWeight: FontWeight.w900,
                ),
              ),
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFFD94E4E),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: _showSosDialog,
                    icon: const Text('🚨'),
                    label: const Text('SOS',
                        style: TextStyle(fontWeight: FontWeight.w900)),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.logout, color: Color(0xFF86A788)),
                  tooltip: '로그아웃',
                  onPressed: _showLogoutDialog,
                ),
              ],
            ),
      body: Stack(
        children: [
          SafeArea(
            child: FutureBuilder<SeniorHomeData>(
              future: _homeDataFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting &&
                    _cachedData == null) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (snapshot.hasError && _cachedData == null) {
                  return _ErrorView(onRetry: _refresh);
                }

                final data = snapshot.data ?? _cachedData;
                if (data == null) return _ErrorView(onRetry: _refresh);
                return _HomeBody(
                  data: data,
                  fallCount: _todayFallCount(),
                  onRefresh: _refresh,
                  seniorId: widget.seniorId,
                  onTabSwitch: widget.onTabSwitch,
                );
              },
            ),
          ),
          // ── SOS pending 배너 ─────────────────
          if (_sosPending)
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              child: _SosPendingBanner(onCancel: _cancelSos),
            ),
          // ── 전화 요청 모달 ────────────────────
          if (_callAlert != null)
            _AlertOverlay(
              icon: '📞',
              title: '보호자가 전화를 요청했습니다.',
              message: '전화 앱에서 보호자에게 연락해주세요.',
              confirmLabel: '전화 받기',
              cancelLabel: '나중에',
              onConfirm: _handleCallAlert,
              onCancel: _dismissCallAlert,
            ),
          // ── 복약 알림 모달 ────────────────────
          if (_medicineAlert != null)
            _AlertOverlay(
              icon: '💊',
              title: '${_medicineAlert!['title'] ?? '복약 알림'}',
              message: '${_medicineAlert!['message'] ?? '복용 중인 약을 제때 복용해주세요.'}',
              confirmLabel: '확인했어요',
              onConfirm: _dismissMedicineAlert,
            ),
          // ── 정보 수정 요청 모달 ───────────────
          if (_infoAlert != null)
            _AlertOverlay(
              icon: '📋',
              title: '${_infoAlert!['title'] ?? '정보 수정 요청'}',
              message: '${_infoAlert!['message'] ?? '복지사가 정보 수정을 요청했습니다.'}',
              confirmLabel: '확인',
              onConfirm: _dismissInfoAlert,
            ),
          // ── 안부 메시지 모달 ──────────────────
          if (_checkInAlert != null)
            _CheckInOverlay(
              message: '${_checkInAlert!['message'] ?? '보호자가 안부 메시지를 보냈습니다.'}',
              controller: _replyController,
              onSend: _sendCheckInReply,
              onDismiss: _dismissCheckInAlert,
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  _HomeBody
// ─────────────────────────────────────────────
class _HomeBody extends StatelessWidget {
  const _HomeBody({
    required this.data,
    required this.fallCount,
    required this.onRefresh,
    required this.seniorId,
    this.onTabSwitch,
  });

  final SeniorHomeData data;
  final int fallCount;
  final Future<void> Function() onRefresh;
  final int seniorId;
  final ValueChanged<int>? onTabSwitch;

  @override
  Widget build(BuildContext context) {
    final profile = data.senior;
    final senior = profile['senior'] is Map<String, dynamic>
        ? profile['senior'] as Map<String, dynamic>
        : <String, dynamic>{};
    final healthInfo = profile['healthInfo'] is Map<String, dynamic>
        ? profile['healthInfo'] as Map<String, dynamic>
        : <String, dynamic>{};

    final name = _textFrom(senior, ['name'], '어르신');
    final region = _textFrom(senior, ['region', 'address'], '현재 위치 확인 중');
    final profileImageUrl = _textFrom(senior, ['profileImageUrl'], '');
    // ignore: avoid_print
    print('[DEBUG] profileImageUrl raw: $profileImageUrl → resolved: ${_resolveImageUrl(profileImageUrl)}');
    final livingCostStatus = _textFrom(healthInfo, ['livingCostStatus'], '');
    final householdType = _textFrom(healthInfo, ['householdType'], '');
    final pensionStatus = _textFrom(healthInfo, ['pensionStatus'], '');
    final housingType = _textFrom(healthInfo, ['housingType'], '');
    final currentBenefitsList = _parseList(healthInfo['currentBenefits']);
    final age = senior['age'] is int ? senior['age'] as int : int.tryParse('${senior['age'] ?? ''}');
    // 건강 관련 텍스트 합치기 (매칭용)
    final healthText = [
      healthInfo['diabetes'], healthInfo['hypertension'], healthInfo['heartDisease'],
      healthInfo['jointDisease'], healthInfo['stroke'], healthInfo['walkingAid'],
      healthInfo['dementia'], healthInfo['recentFall'],
    ].where((v) => v != null && v != '없음' && v != '').join(' ');
    final welfarePrograms = _matchWelfarePrograms(
      age: age,
      householdType: householdType,
      livingCostStatus: livingCostStatus,
      pensionStatus: pensionStatus,
      currentBenefits: currentBenefitsList,
      healthText: healthText,
    );

    final guardianSummary = _guardianSummary(profile);
    final workerSummary = _workerSummary(profile);
    final medicineCount = _medicineCount(data.alerts);

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
        children: [
          _ProfileHeader(name: name, region: region, profileImageUrl: profileImageUrl),
          const SizedBox(height: 16),
          _SosButton(onPressed: () {
            final state = context
                .findAncestorStateOfType<_SeniorHomeScreenState>();
            state?._showSosDialog();
          }),
          const SizedBox(height: 14),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: _ActionTile(
                    icon: Icons.call,
                    title: '보호자 전화',
                    subtitle: guardianSummary,
                    onTap: () => _showInfo(context, '보호자 전화',
                        '전화 앱에서 보호자에게 연락해주세요.'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _ActionTile(
                    icon: Icons.support_agent,
                    title: '복지사 전화',
                    subtitle: workerSummary,
                    onTap: () => _showInfo(context, '복지사 전화',
                        '담당 복지사에게 상담을 요청할 수 있어요.'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _LocationCard(region: region),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _SmallStatusCard(
                  title: '오늘 낙상',
                  value: '$fallCount건',
                  description: fallCount > 0 ? '감지 이력을 확인해주세요.' : '감지된 낙상이 없어요.',
                  icon: Icons.health_and_safety_outlined,
                  valueColor: fallCount > 0
                      ? const Color(0xFFD94E4E)
                      : const Color(0xFF1F2A20),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _SmallStatusCard(
                  title: '오늘 복약',
                  value: '$medicineCount건',
                  description:
                      medicineCount > 0 ? '복용 알림을 확인해주세요.' : '복용 알림이 없어요.',
                  icon: Icons.medication_outlined,
                  valueColor: medicineCount > 0
                      ? const Color(0xFF5E7CE2)
                      : const Color(0xFF1F2A20),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _WelfareCheckCard(
            livingCostStatus: livingCostStatus,
            householdType: householdType,
            pensionStatus: pensionStatus,
            housingType: housingType,
            programs: welfarePrograms,
            onTap: () => _showInfo(context, '복지제도 확인',
                '입력하신 복지 정보를 바탕으로 신청 가능한 제도를 안내합니다.'),
          ),
          const SizedBox(height: 14),
          _ScheduleCard(schedules: data.schedules),
          const SizedBox(height: 14),
          _ClimateAlertCard(alerts: data.climateAlerts),
        ],
      ),
    );
  }

  void _showInfo(BuildContext context, String title, String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        content: Text(message),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }

  String _guardianSummary(Map<String, dynamic> profile) {
    // Spring SeniorProfileResponse: flat 필드 guardianName, guardianPhone
    final name = _textFrom(profile, ['guardianName'], '');
    if (name.isNotEmpty) {
      final rel = _textFrom(profile, ['relation'], '');
      return rel.isEmpty ? name : '$name ($rel)';
    }
    return '보호자 매칭 전';
  }

  String _workerSummary(Map<String, dynamic> profile) {
    final name = _textFrom(profile, ['socialWorkerName'], '');
    if (name.isNotEmpty) {
      final center = _textFrom(profile, ['socialWorkerCenter'], '');
      return center.isEmpty ? name : '$name\n$center';
    }
    return '복지사 매칭 전';
  }

  int _medicineCount(List<dynamic> alerts) {
    return alerts.where((alert) {
      if (alert is! Map<String, dynamic>) return false;
      return alert['type'] == 'MEDICINE' &&
          alert['isRead'] != true &&
          _isToday(alert['createdAt']);
    }).length;
  }

  String _nextScheduleSummary(List<dynamic> schedules) {
    if (schedules.isEmpty) return '오늘 등록된 일정이 없어요.';
    final time = scheduleTime(schedules.first);
    final title = scheduleTitle(schedules.first);
    return time.isEmpty ? '다음: $title' : '다음: $time $title';
  }
}

// ─────────────────────────────────────────────
//  _ErrorView
// ─────────────────────────────────────────────
class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('정보를 불러오지 못했어요.',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('다시 불러오기')),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  SOS pending 배너
// ─────────────────────────────────────────────
class _SosPendingBanner extends StatelessWidget {
  const _SosPendingBanner({required this.onCancel});
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFD94E4E),
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
      child: Row(
        children: [
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('SOS가 보호자에게 전송되었어요.',
                    style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 15)),
                SizedBox(height: 2),
                Text('실수로 누르셨으면 아래를 눌러주세요.',
                    style: TextStyle(color: Color(0xFFFFD0D0), fontSize: 13)),
              ],
            ),
          ),
          TextButton(
            style: TextButton.styleFrom(foregroundColor: Colors.white),
            onPressed: onCancel,
            child: const Text('잘못 눌렀어요',
                style: TextStyle(fontWeight: FontWeight.w900)),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  Alert overlay
// ─────────────────────────────────────────────
class _AlertOverlay extends StatelessWidget {
  const _AlertOverlay({
    required this.icon,
    required this.title,
    required this.message,
    required this.confirmLabel,
    required this.onConfirm,
    this.cancelLabel,
    this.onCancel,
  });

  final String icon;
  final String title;
  final String message;
  final String confirmLabel;
  final VoidCallback? onConfirm;
  final String? cancelLabel;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onCancel,
      child: Container(
        color: Colors.black54,
        child: Center(
          child: GestureDetector(
            onTap: () {},
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 32),
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(icon, style: const TextStyle(fontSize: 48)),
                  const SizedBox(height: 12),
                  Text(title,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 17, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  Text(message,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 14, color: Color(0xFF6D766A))),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (cancelLabel != null) ...[
                        TextButton(
                          onPressed: onCancel,
                          child: Text(cancelLabel!),
                        ),
                        const SizedBox(width: 12),
                      ],
                      FilledButton(
                        style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF86A788)),
                        onPressed: onConfirm,
                        child: Text(confirmLabel),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  안부 메시지 overlay
// ─────────────────────────────────────────────
class _CheckInOverlay extends StatelessWidget {
  const _CheckInOverlay({
    required this.message,
    required this.controller,
    required this.onSend,
    required this.onDismiss,
  });

  final String message;
  final TextEditingController controller;
  final VoidCallback onSend;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onDismiss,
      child: Container(
        color: Colors.black54,
        child: Center(
          child: GestureDetector(
            onTap: () {},
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 24),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('보호자 안부 메시지',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF6FAF4),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(message,
                        style: const TextStyle(
                            fontSize: 15, color: Color(0xFF1F2A20))),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    maxLines: 3,
                    decoration: InputDecoration(
                      hintText: '답장을 입력해주세요.',
                      filled: true,
                      fillColor: const Color(0xFFF7F5E8),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF86A788)),
                          onPressed: onSend,
                          child: const Text('답장 보내기'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      TextButton(
                        onPressed: onDismiss,
                        child: const Text('확인했어요'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  재사용 위젯들
// ─────────────────────────────────────────────

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({
    required this.name,
    required this.region,
    this.profileImageUrl = '',
  });

  final String name;
  final String region;
  final String profileImageUrl;

  @override
  Widget build(BuildContext context) {
    final initial = name.isNotEmpty ? name.characters.first : '우';
    final hasImage = profileImageUrl.isNotEmpty;

    final imageUrl = _resolveImageUrl(profileImageUrl);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF86A788),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Container(
            width: 62,
            height: 62,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.24),
              shape: BoxShape.circle,
            ),
            clipBehavior: Clip.antiAlias,
            child: hasImage
                ? Image.network(
                    imageUrl,
                    width: 62,
                    height: 62,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Text(initial,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w900)),
                  )
                : Text(initial,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.w900)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('$name님 안녕하세요',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.w900)),
                const SizedBox(height: 6),
                const Text('우리 돌봄 서비스 · 디바이스 연결됨',
                    style: TextStyle(
                        color: Color(0xFFEAF4EA),
                        fontSize: 14,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 5),
                Text(region,
                    style: const TextStyle(
                        color: Color(0xFFEAF4EA),
                        fontSize: 13,
                        fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SosButton extends StatelessWidget {
  const _SosButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 112,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFD94E4E),
          foregroundColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        ),
        onPressed: onPressed,
        child: const Text('🚨 긴급 SOS 요청',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final subtitleLines = subtitle.split('\n');
    final primarySubtitle = subtitleLines.first;
    final secondarySubtitle = subtitleLines.skip(1).join('\n');

    return _BaseCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Icon(icon, color: const Color(0xFF6F9271), size: 28),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1F2A20),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            primarySubtitle,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 16,
              height: 1.35,
              fontWeight: FontWeight.w900,
              color: Color(0xFF6D766A),
            ),
          ),
          if (secondarySubtitle.isNotEmpty) ...[
            const SizedBox(height: 2),
            Text(
              secondarySubtitle,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                height: 1.35,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6D766A),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.region});
  final String region;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '현재 위치'),
          const SizedBox(height: 10),
          const Row(
            children: [
              Icon(Icons.check_circle, color: Color(0xFF86A788), size: 20),
              SizedBox(width: 8),
              Text('안전 반경 안',
                  style: TextStyle(
                      color: Color(0xFF48624B),
                      fontSize: 16,
                      fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 8),
          Text(region,
              style: const TextStyle(
                  color: Color(0xFF6D766A),
                  fontSize: 15,
                  fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class _SmallStatusCard extends StatelessWidget {
  const _SmallStatusCard({
    required this.title,
    required this.value,
    required this.description,
    required this.icon,
    this.valueColor = const Color(0xFF1F2A20),
  });

  final String title;
  final String value;
  final String description;
  final IconData icon;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF86A788), size: 30),
          const SizedBox(height: 10),
          Text(title,
              style: const TextStyle(
                  color: Color(0xFF6D766A),
                  fontSize: 14,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(
                  color: valueColor,
                  fontSize: 28,
                  fontWeight: FontWeight.w900)),
          Text(description,
              style: const TextStyle(
                  color: Color(0xFF6D766A),
                  fontSize: 13,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _WelfareCheckCard extends StatelessWidget {
  const _WelfareCheckCard({
    required this.livingCostStatus,
    required this.householdType,
    required this.pensionStatus,
    required this.housingType,
    required this.programs,
    required this.onTap,
  });

  final String livingCostStatus;
  final String householdType;
  final String pensionStatus;
  final String housingType;
  final List<_WelfareProgram> programs;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // 입력된 항목만 표시
    final lines = <(String, String)>[
      if (livingCostStatus.isNotEmpty && livingCostStatus != '잘 모르겠어요')
        ('생활비 상황', livingCostStatus),
      if (householdType.isNotEmpty && householdType != '잘 모르겠어요')
        ('가구 형태', householdType),
      if (pensionStatus.isNotEmpty && pensionStatus != '잘 모르겠어요')
        ('연금 수급', pensionStatus),
      if (housingType.isNotEmpty && housingType != '잘 모르겠어요')
        ('주거 형태', housingType),
    ];

    return _BaseCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '복지제도 확인'),
          const SizedBox(height: 8),
          const Text(
            '소득과 가구 정보를 바탕으로 받을 수 있는 복지제도를 함께 확인해요.',
            style: TextStyle(
                color: Color(0xFF4A5F4B),
                fontSize: 14,
                fontWeight: FontWeight.w600,
                height: 1.45),
          ),
          const SizedBox(height: 12),
          if (lines.isEmpty)
            const Text('복지정보를 입력하면 맞춤 정보를 확인할 수 있어요.',
                style: TextStyle(color: Color(0xFF9AAF9B), fontSize: 14))
          else
            ...lines.map((e) => _InfoLine(label: e.$1, value: e.$2)),
          if (programs.isNotEmpty) ...[
            const SizedBox(height: 14),
            const Divider(height: 1, color: Color(0xFFE8F0E8)),
            const SizedBox(height: 12),
            const Text('신청 가능 제도',
                style: TextStyle(
                    color: Color(0xFF5F7D61),
                    fontSize: 13,
                    fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            ...programs.map((p) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF4FBF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFD4E8D6)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(p.name,
                      style: const TextStyle(
                          color: Color(0xFF1F2A20),
                          fontSize: 14,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 4),
                  Text(p.summary,
                      style: const TextStyle(
                          color: Color(0xFF4A5F4B),
                          fontSize: 13,
                          height: 1.4)),
                  const SizedBox(height: 4),
                  Text(p.reason,
                      style: const TextStyle(
                          color: Color(0xFF86A788),
                          fontSize: 12,
                          fontWeight: FontWeight.w700)),
                ],
              ),
            )),
          ],
        ],
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Text(label,
              style: const TextStyle(
                  color: Color(0xFF6D766A),
                  fontSize: 14,
                  fontWeight: FontWeight.w800)),
          const Spacer(),
          Text(value,
              style: const TextStyle(
                  color: Color(0xFF1F2A20),
                  fontSize: 15,
                  fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.schedules});
  final List<dynamic> schedules;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '오늘 일정'),
          const SizedBox(height: 12),
          if (schedules.isEmpty)
            const Text('등록된 일정이 없어요.',
                style: TextStyle(
                    color: Color(0xFF6D766A),
                    fontSize: 15,
                    fontWeight: FontWeight.w700))
          else
            ...schedules.map((s) => _ScheduleRow(
                  time: scheduleTime(s),
                  text: scheduleTitle(s),
                )),
        ],
      ),
    );
  }
}

class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow({required this.time, required this.text});
  final String time;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(time.isEmpty ? '시간 없음' : time,
                style: const TextStyle(
                    color: Color(0xFF48624B),
                    fontSize: 14,
                    fontWeight: FontWeight.w900)),
          ),
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
                color: Color(0xFF86A788), shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text,
                style: const TextStyle(
                    color: Color(0xFF1F2A20),
                    fontSize: 16,
                    fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}

class _ClimateAlertCard extends StatelessWidget {
  const _ClimateAlertCard({required this.alerts});
  final List<dynamic> alerts;

  @override
  Widget build(BuildContext context) {
    final bool hasAlert = alerts.isNotEmpty;
    final String message = hasAlert
        ? (alerts.first is Map<String, dynamic>
            ? _textFrom(
                alerts.first as Map<String, dynamic>,
                ['message', 'type', 'level'],
                '기후 알림')
            : '기후 알림')
        : '현재 발령된 기상특보가 없습니다. 오늘 하루 기후 상태는 비교적 안전합니다.';

    final Color iconBg =
        hasAlert ? const Color(0xFFFFF3CD) : const Color(0xFFEBF5E9);
    final Color iconColor =
        hasAlert ? const Color(0xFFE07B00) : const Color(0xFF4C8A50);
    final IconData icon =
        hasAlert ? Icons.warning_amber_rounded : Icons.wb_sunny_rounded;

    return _BaseCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: iconColor, size: 26),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Text('기후 알림',
                        style: TextStyle(
                            color: Color(0xFF1F2A20),
                            fontSize: 15,
                            fontWeight: FontWeight.w900)),
                    if (alerts.length > 1) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE07B00),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text('${alerts.length}',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(message,
                    style: const TextStyle(
                        color: Color(0xFF4A5C4B),
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        height: 1.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  복지 프로그램 매칭 (웹앱 welfareRag.js 포팅)
// ─────────────────────────────────────────────

class _WelfareProgram {
  const _WelfareProgram({
    required this.name,
    required this.summary,
    required this.reason,
  });
  final String name;
  final String summary;
  final String reason;
}

List<_WelfareProgram> _matchWelfarePrograms({
  required int? age,
  required String householdType,
  required String livingCostStatus,
  required String pensionStatus,
  required List<String> currentBenefits,
  required String healthText, // 질환 정보 합친 문자열
}) {
  final results = <_WelfareProgram>[];
  final isAlone = householdType.contains('혼자') || householdType.contains('독거');
  final isLowIncome = livingCostStatus.contains('없어요') || livingCostStatus.contains('기초연금') || livingCostStatus.contains('지원');
  final alreadyBenefits = currentBenefits.join(' ');
  final hasHealthIssue = RegExp(r'치매|낙상|보행|관절|뇌졸중|거동|인지|요양').hasMatch(healthText);

  // 기초연금
  if ((age == null || age >= 65) && !alreadyBenefits.contains('기초연금')) {
    if (!pensionStatus.contains('기초연금을 받고')) {
      results.add(const _WelfareProgram(
        name: '기초연금',
        summary: '만 65세 이상 소득인정액 기준을 충족하는 경우 신청 가능합니다.',
        reason: '연령 기준 해당 · 주민센터 또는 복지로에서 확인',
      ));
    }
  }

  // 노인맞춤돌봄서비스
  if (isAlone || isLowIncome) {
    if (!alreadyBenefits.contains('노인맞춤돌봄')) {
      results.add(const _WelfareProgram(
        name: '노인맞춤돌봄서비스',
        summary: '혼자 지내거나 돌봄 공백이 있는 어르신에게 안부 확인, 생활 지원을 제공합니다.',
        reason: '가구 형태 및 생활 상황 해당 · 읍면동 주민센터 상담',
      ));
    }
  }

  // 응급안전안심서비스
  if (isAlone) {
    if (!alreadyBenefits.contains('응급안전')) {
      results.add(const _WelfareProgram(
        name: '응급안전안심서비스',
        summary: '독거 어르신에게 응급 호출·화재 감지 등 안전 장비를 연계합니다.',
        reason: '혼자 거주 해당 · 주민센터 또는 수행기관 문의',
      ));
    }
  }

  // 장기요양등급
  if (hasHealthIssue && (age == null || age >= 65)) {
    if (!alreadyBenefits.contains('장기요양')) {
      results.add(const _WelfareProgram(
        name: '장기요양등급',
        summary: '일상생활 도움이 필요한 경우 등급 신청을 검토할 수 있습니다.',
        reason: '건강 상태 해당 · 국민건강보험공단 확인',
      ));
    }
  }

  // 기초생활보장
  if (isLowIncome && livingCostStatus.contains('없어요')) {
    if (!alreadyBenefits.contains('기초생활')) {
      results.add(const _WelfareProgram(
        name: '기초생활보장',
        summary: '소득·재산이 기준 이하인 가구에 생계·의료·주거 급여를 지원합니다.',
        reason: '소득 상황 해당 · 복지로 모의계산 또는 주민센터 상담',
      ));
    }
  }

  return results.take(3).toList();
}

class _AppFeatureGrid extends StatelessWidget {
  const _AppFeatureGrid({required this.seniorId, this.onTabSwitch});

  final int seniorId;
  final ValueChanged<int>? onTabSwitch;

  // tab indices: 홈0 위치1 기후2 일자리3 내정보4 (채팅·알림은 헤더 버튼으로 이동)
  VoidCallback _go(BuildContext ctx, int tab, Widget Function() fallback) {
    return onTabSwitch != null
        ? () => onTabSwitch!(tab)
        : () => Navigator.push(ctx, MaterialPageRoute(builder: (_) => fallback()));
  }

  @override
  Widget build(BuildContext context) {
    final features = <(IconData, String, VoidCallback)>[
      (
        Icons.location_on_outlined,
        '위치 확인',
        _go(context, 1, () => LocationScreen(seniorId: seniorId)),
      ),
      (
        Icons.health_and_safety_outlined,
        '낙상 이력',
        () => Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (_) => FallHistoryScreen(seniorId: seniorId)),
            ),
      ),
      (
        Icons.wb_sunny_outlined,
        '기후 알림',
        _go(context, 2, () => WeatherScreen(seniorId: seniorId)),
      ),
      (
        Icons.person_outline,
        '내 정보',
        _go(context, 4, () => ProfileScreen(seniorId: seniorId)),
      ),
      (
        Icons.work_outline,
        '일자리',
        _go(context, 3, () => JobScreen(seniorId: seniorId)),
      ),
    ];

    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '앱 기능'),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: features
                .map((f) => _FeatureButton(
                      icon: f.$1,
                      label: f.$2,
                      onTap: f.$3,
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }
}

class _FeatureButton extends StatelessWidget {
  const _FeatureButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: (MediaQuery.of(context).size.width - 36 - 48 - 16) / 3,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: 88),
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF6FAF4),
            border: Border.all(color: const Color(0xFFDDE9D8)),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: const Color(0xFF86A788), size: 28),
              const SizedBox(height: 8),
              Text(label,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      color: Color(0xFF1F2A20),
                      fontSize: 13,
                      fontWeight: FontWeight.w900)),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});
  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(title,
        style: const TextStyle(
            color: Color(0xFF1F2A20),
            fontSize: 19,
            fontWeight: FontWeight.w900));
  }
}

class _BaseCard extends StatelessWidget {
  const _BaseCard({required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFDDE9D8)),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF86A788).withValues(alpha: 0.08),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: child,
    );

    if (onTap == null) return card;
    return InkWell(
        borderRadius: BorderRadius.circular(18), onTap: onTap, child: card);
  }
}
