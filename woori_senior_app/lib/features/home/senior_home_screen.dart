import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';
import '../../core/utils/phone_formatter.dart';
import '../../core/storage/senior_session_storage.dart';
import '../auth/login_screen.dart';
import '../fall/fall_history_screen.dart';
import '../job/job_screen.dart';
import '../location/location_screen.dart';
import '../notifications/notification_screen.dart';
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

  // data: URL은 그대로 사용
  if (url.startsWith('data:')) return url;

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

/// data: URL이면 MemoryImage, 아니면 NetworkImage 반환
ImageProvider _profileImageProvider(String url) {
  if (url.startsWith('data:')) {
    try {
      final base64Data = url.substring(url.indexOf(',') + 1);
      return MemoryImage(base64Decode(base64Data));
    } catch (_) {}
  }
  return NetworkImage(url);
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
  Map<String, dynamic>? _weather;

  Timer? _alertTimer;
  bool _isPolling = false;
  List<dynamic> _alerts = [];
  bool _sosPending = false;

  // 나중에 누른 알림 ID (세션 중 재표시 방지)
  final Set<int> _dismissedAlertIds = {};

  // 보호자 미연동 안내 — 세션 중 1회만 표시
  bool _guardianNoticeShown = false;

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
    _fetchWeather();

    // 보호자 미연동 안내 — 최초 1회
    // hasGuardian == false 이면 보호자 없다고 본인이 선택한 것이므로 안내 생략
    if (!_guardianNoticeShown) {
      final profile = data.senior;
      // hasGuardian 은 senior 서브오브젝트 안에 있음
      final seniorObj = profile['senior'] is Map<String, dynamic>
          ? profile['senior'] as Map<String, dynamic>
          : <String, dynamic>{};
      final seniorSaidNoGuardian = seniorObj['hasGuardian'] == false;
      final guardianName = _textFrom(profile, ['guardianName'], '');
      if (!seniorSaidNoGuardian && guardianName.isEmpty) {
        _guardianNoticeShown = true;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _showGuardianNotice(profile);
        });
      }
    }

    return data;
  }

  void _showGuardianNotice(Map<String, dynamic> profile) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(24, 20, 24, MediaQuery.of(ctx).padding.bottom + 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // 핸들
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDDDDDD),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            // 아이콘
            Container(
              width: 60, height: 60,
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(30),
              ),
              child: const Icon(Icons.people_alt_outlined,
                  size: 32, color: Color(0xFF86A788)),
            ),
            const SizedBox(height: 16),
            const Text(
              '보호자를 연동해 보세요',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: Color(0xFF1F2A20),
              ),
            ),
            const SizedBox(height: 10),
            const Text(
              '보호자가 연동되면 비상시 바로 전화하거나\nSOS 알림을 보낼 수 있어요.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                color: Color(0xFF6D766A),
                height: 1.6,
              ),
            ),
            const SizedBox(height: 24),
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: Color(0xFFB0BDB1)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('나중에',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF6D766A))),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    _showGuardianConnectSheet(
                      context,
                      widget.seniorId,
                      onConnected: () => setState(() {
                        _homeDataFuture = _loadHomeData();
                      }),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF86A788),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('입력하기',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w900)),
                ),
              ),
            ]),
          ],
        ),
      ),
    );
  }

  Future<void> _fetchWeather() async {
    try {
      // 서울 기본 격자 (nx=60, ny=127) — 날씨 팁 표시용
      final w = await _api.fetchWeather(60, 127);
      if (mounted) setState(() => _weather = w);
    } catch (_) {}
  }

  void _startAlertPolling() {
    _alertTimer = Timer.periodic(const Duration(seconds: 15), (_) => _pollAlerts());
  }

  Future<void> _pollAlerts() async {
    if (_isPolling) return;
    _isPolling = true;
    try {
      final alerts = await _api.fetchAlerts(widget.seniorId);
      if (!mounted) return;
      _processAlerts(alerts);
    } catch (_) {} finally {
      _isPolling = false;
    }
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
      if (a is Map<String, dynamic> && test(a)) {
        final id = a['id'];
        final intId = id is int ? id : int.tryParse('$id');
        if (intId != null && _dismissedAlertIds.contains(intId)) continue;
        return a;
      }
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
        contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('🚨', style: TextStyle(fontSize: 54)),
            const SizedBox(height: 16),
            const Text('SOS를 보내시겠어요?',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          ],
        ),
        actionsAlignment: MainAxisAlignment.center,
        actionsPadding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
        actions: [
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF6D766A),
              side: const BorderSide(color: Color(0xFFB0BDB1)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
            ),
            onPressed: () => Navigator.pop(ctx),
            child: const Text('취소', style: TextStyle(fontWeight: FontWeight.w800)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD94E4E),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
            ),
            onPressed: () {
              Navigator.pop(ctx);
              _sendSos();
            },
            child: const Text('보내기', style: TextStyle(fontWeight: FontWeight.w800)),
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
    // 나중에 — 세션 중 재표시 방지, 읽음 처리는 수정 완료 후에
    final id = _infoAlert?['id'];
    final intId = id is int ? id : int.tryParse('$id');
    if (intId != null) _dismissedAlertIds.add(intId);
    setState(() => _infoAlert = null);
  }

  Future<void> _handleInfoAlert(BuildContext context) async {
    final alert = _infoAlert;
    if (alert == null) return;
    setState(() => _infoAlert = null);

    final id = alert['id'];
    final alertId = id is int ? id : int.tryParse('$id');
    final message = '${alert['message'] ?? ''}';

    // 메시지 내용으로 해당 탭 추정
    int sectionIndex = 0;
    if (RegExp(r'복약|약|복용').hasMatch(message)) sectionIndex = 2;
    else if (RegExp(r'만성|질환|수술').hasMatch(message)) sectionIndex = 3;
    else if (RegExp(r'거동|인지|감각|보행').hasMatch(message)) sectionIndex = 4;
    else if (RegExp(r'활동|이동|쉬는|작업').hasMatch(message)) sectionIndex = 5;
    else if (RegExp(r'복지|소득|가구|혜택').hasMatch(message)) sectionIndex = 6;
    else if (RegExp(r'일자리|희망|근무|직종').hasMatch(message)) sectionIndex = 7;

    if (!context.mounted) return;
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ProfileScreen(
          seniorId: widget.seniorId,
          initialSectionIndex: sectionIndex,
          pendingAlertId: alertId,
          onSaved: () {
            if (context.mounted) Navigator.pop(context);
          },
        ),
      ),
    ).then((_) {
      if (mounted) {
        setState(() {
          _guardianNoticeShown = false;
          _homeDataFuture = _loadHomeData();
        });
      }
    });
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
    // "확인했어요" (답장 없이 닫기) → 읽음 처리 안 함, 세션 중 재표시 방지
    final id = _checkInAlert?['id'];
    final intId = id is int ? id : int.tryParse('$id');
    if (intId != null) _dismissedAlertIds.add(intId);
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
                  weather: _weather,
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
              cancelLabel: '나중에',
              onCancel: _dismissInfoAlert,
              confirmLabel: '수정하러 가기',
              onConfirm: () => _handleInfoAlert(context),
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
    this.weather,
  });

  final SeniorHomeData data;
  final int fallCount;
  final Future<void> Function() onRefresh;
  final int seniorId;
  final ValueChanged<int>? onTabSwitch;
  final Map<String, dynamic>? weather;

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
    final guardianPhone = _textFrom(profile, ['guardianPhone'], '');
    final workerPhone = _textFrom(profile, ['socialWorkerPhone'], '');
    final guardianIdRaw = profile['guardianId'];
    final guardianId = guardianIdRaw == null ? null : (guardianIdRaw as num).toInt();
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
                    onTap: () => _showGuardianActionSheet(
                      context,
                      guardianName: _textFrom(profile, ['guardianName'], ''),
                      onCall: () => _callPhone(context, guardianPhone, '보호자'),
                      onEdit: () => _showGuardianEditSheet(
                        context,
                        seniorId,
                        guardianId,
                        _textFrom(profile, ['guardianName'], ''),
                        _textFrom(profile, ['relation'], ''),
                        guardianPhone,
                        onRefresh,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _ActionTile(
                    icon: Icons.support_agent,
                    title: '복지사 전화',
                    subtitle: workerSummary,
                    onTap: () => _callPhone(context, workerPhone, '복지사'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _LocationCard(region: region, onTap: onTabSwitch != null ? () => onTabSwitch!(1) : null),
          const SizedBox(height: 14),
          IntrinsicHeight(
            child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
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
                  onTap: () => Navigator.push(context, MaterialPageRoute(
                    builder: (_) => FallHistoryScreen(seniorId: seniorId),
                  )),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _SmallStatusCard(
                  title: '복약 알림',
                  value: '$medicineCount건',
                  description:
                      medicineCount > 0 ? '복약 알림을 확인하세요.' : '복용 알림이 없어요.',
                  icon: Icons.medication_outlined,
                  valueColor: const Color(0xFF1F2A20),
                  onTap: () => Navigator.push(context, MaterialPageRoute(
                    builder: (_) => NotificationScreen(seniorId: seniorId, typeFilter: 'MEDICINE'),
                  )),
                ),
              ),
            ],
          ),
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
          _ClimateAlertCard(alerts: data.climateAlerts, weather: weather),
        ],
      ),
    );
  }

  Future<void> _callPhone(BuildContext context, String phone, String label) async {
    final number = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (number.isEmpty) {
      _showInfo(context, '$label 전화', '전화번호가 등록되어 있지 않아요.');
      return;
    }
    try {
      await const MethodChannel('com.woori/phone').invokeMethod('dial', number);
    } catch (_) {
      if (context.mounted) {
        _showInfo(context, '$label 전화', '전화 앱을 열 수 없어요. ($number)');
      }
    }
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
    final name = _textFrom(profile, ['guardianName'], '');
    if (name.isNotEmpty) {
      final rel = _textFrom(profile, ['relation'], '');
      return rel.isEmpty ? name : '$name ($rel)';
    }
    final seniorObj = profile['senior'] is Map<String, dynamic>
        ? profile['senior'] as Map<String, dynamic>
        : <String, dynamic>{};
    if (seniorObj['hasGuardian'] == false) return '--';
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
      return alert['type'] == 'MEDICINE';
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
                    children: [
                      if (cancelLabel != null) ...[
                        Expanded(
                          child: OutlinedButton(
                            onPressed: onCancel,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF6D766A),
                              side: const BorderSide(color: Color(0xFFCCCCCC)),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                            child: Text(cancelLabel!,
                                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                          ),
                        ),
                        const SizedBox(width: 10),
                      ],
                      Expanded(
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: const Color(0xFF86A788),
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: onConfirm,
                          child: Text(confirmLabel,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                        ),
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
                ? Image(
                    image: _profileImageProvider(imageUrl),
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
    this.onEdit,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final subtitleLines = subtitle.split('\n');
    final primarySubtitle = subtitleLines.first;
    final secondarySubtitle = subtitleLines.skip(1).join('\n');

    return Stack(
      children: [
        _BaseCard(
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
        ),
        if (onEdit != null)
          Positioned(
            top: 6,
            right: 6,
            child: GestureDetector(
              onTap: onEdit,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: const Color(0xFF86A788).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.edit_outlined,
                  size: 15,
                  color: Color(0xFF6F9271),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.region, this.onTap});
  final String region;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      onTap: onTap,
      child: Row(
        children: [
          Expanded(
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
          ),
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
    this.onTap,
  });

  final String title;
  final String value;
  final String description;
  final IconData icon;
  final Color valueColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.max,
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

({String message, IconData icon, Color iconBg, Color iconColor}) _weatherTip(
    Map<String, dynamic> w) {
  double n(dynamic v) => double.tryParse('$v') ?? 0;
  final temp = n(w['temp'] ?? w['TMP'] ?? '20');
  final rainProb = n(w['rainProb'] ?? w['POP'] ?? '0');
  final wind = n(w['wind'] ?? w['WSD'] ?? '0');
  final humid = n(w['humid'] ?? w['REH'] ?? '50');

  if (temp >= 33) {
    return (message: '오늘 폭염 주의. 수분 섭취를 자주 하고 낮 외출을 자제하세요.', icon: Icons.wb_sunny, iconBg: const Color(0xFFFFECCC), iconColor: const Color(0xFFE07B00));
  }
  if (temp <= 0) {
    return (message: '오늘 한파 주의. 외출 시 보온에 신경 쓰고 빙판길을 조심하세요.', icon: Icons.ac_unit, iconBg: const Color(0xFFDCEEFF), iconColor: const Color(0xFF4C8ED9));
  }
  if (rainProb >= 60) {
    return (message: '오늘 비 올 확률 ${rainProb.toInt()}%. 우산과 미끄럼 방지 신발을 챙기세요.', icon: Icons.umbrella, iconBg: const Color(0xFFDCEEFF), iconColor: const Color(0xFF4C8ED9));
  }
  if (wind >= 9) {
    return (message: '오늘 강풍 주의. 외출 시 보행 보조도구를 꼭 챙기세요.', icon: Icons.air, iconBg: const Color(0xFFFFF3CD), iconColor: const Color(0xFFE07B00));
  }
  if (humid < 35) {
    return (message: '오늘 대기가 건조해요. 수분 섭취와 보습에 신경 쓰세요.', icon: Icons.water_drop_outlined, iconBg: const Color(0xFFEBF5E9), iconColor: const Color(0xFF4C8A50));
  }
  if (temp >= 27) {
    return (message: '오늘 더위 대비. 자외선 차단제를 바르고 그늘에서 쉬어가세요.', icon: Icons.wb_sunny_outlined, iconBg: const Color(0xFFFFECCC), iconColor: const Color(0xFFE07B00));
  }
  return (message: '오늘 기후는 비교적 안전해요. 가벼운 산책을 즐기세요.', icon: Icons.wb_sunny_outlined, iconBg: const Color(0xFFEBF5E9), iconColor: const Color(0xFF4C8A50));
}

class _ClimateAlertCard extends StatelessWidget {
  const _ClimateAlertCard({required this.alerts, this.weather});
  final List<dynamic> alerts;
  final Map<String, dynamic>? weather;

  @override
  Widget build(BuildContext context) {
    final bool hasAlert = alerts.isNotEmpty;

    final String message;
    final IconData icon;
    final Color iconBg;
    final Color iconColor;

    if (hasAlert) {
      final a = alerts.first is Map<String, dynamic>
          ? alerts.first as Map<String, dynamic>
          : <String, dynamic>{};
      message = _textFrom(a, ['message', 'type', 'level'], '기후 알림');
      final type = '${a['type'] ?? ''}';
      final level = '${a['level'] ?? ''}';
      final isDangerous = ['danger', 'warning'].contains(level);
      final isCaution = level == 'caution';
      if (type.contains('HEATWAVE') || type.contains('heat') || type.contains('더위')) {
        icon = Icons.wb_sunny; iconBg = const Color(0xFFFFECCC); iconColor = const Color(0xFFE07B00);
      } else if (type.contains('COLDWAVE') || type.contains('cold') || type.contains('한파')) {
        icon = Icons.ac_unit; iconBg = const Color(0xFFDCEEFF); iconColor = const Color(0xFF4C8ED9);
      } else if (type.contains('RAIN') || type.contains('rain') || type.contains('비')) {
        icon = Icons.umbrella; iconBg = const Color(0xFFDCEEFF); iconColor = const Color(0xFF4C8ED9);
      } else if (type.contains('SNOW') || type.contains('snow') || type.contains('눈')) {
        icon = Icons.ac_unit; iconBg = const Color(0xFFDCEEFF); iconColor = const Color(0xFF4C8ED9);
      } else if (type.contains('WIND') || type.contains('wind') || type.contains('바람')) {
        icon = Icons.air; iconBg = const Color(0xFFFFF3CD); iconColor = const Color(0xFFE07B00);
      } else if (isDangerous || isCaution) {
        icon = Icons.warning_amber_rounded; iconBg = const Color(0xFFFFF3CD); iconColor = const Color(0xFFE07B00);
      } else {
        icon = Icons.wb_sunny_outlined; iconBg = const Color(0xFFEBF5E9); iconColor = const Color(0xFF4C8A50);
      }
    } else if (weather != null) {
      final tip = _weatherTip(weather!);
      message = tip.message;
      icon = tip.icon;
      iconBg = tip.iconBg;
      iconColor = tip.iconColor;
    } else {
      message = '오늘 기후는 비교적 안전해요. 가벼운 산책을 즐기세요.';
      icon = Icons.wb_sunny_outlined;
      iconBg = const Color(0xFFEBF5E9);
      iconColor = const Color(0xFF4C8A50);
    }

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
                const Text('기후 알림',
                    style: TextStyle(
                        color: Color(0xFF1F2A20),
                        fontSize: 15,
                        fontWeight: FontWeight.w900)),
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
        _go(
          context,
          4,
          () => ProfileScreen(
            seniorId: seniorId,
            onSaved: () => Navigator.pop(context),
          ),
        ),
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

// ─────────────────────────────────────────────
//  보호자 액션 선택 바텀시트 (전화하기 / 수정하기)
// ─────────────────────────────────────────────

void _showGuardianActionSheet(
  BuildContext context, {
  required String guardianName,
  required VoidCallback onCall,
  required VoidCallback onEdit,
}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (sheetCtx) => Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 72),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: const Color(0xFFDDDDDD),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Text(
            guardianName.isNotEmpty ? guardianName : '보호자',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1F2A20),
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 56,
            child: FilledButton.icon(
              icon: const Icon(Icons.call, size: 22),
              label: const Text(
                '전화하기',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF86A788),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed: () {
                Navigator.pop(sheetCtx);
                onCall();
              },
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 56,
            child: OutlinedButton.icon(
              icon: const Icon(
                Icons.edit_outlined,
                size: 22,
                color: Color(0xFF6F9271),
              ),
              label: const Text(
                '수정하기',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF6F9271),
                ),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: Color(0xFF86A788), width: 1.5),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed: () {
                Navigator.pop(sheetCtx);
                onEdit();
              },
            ),
          ),
        ],
      ),
    ),
  );
}

// ─────────────────────────────────────────────
//  보호자 정보 수정 바텀시트
// ─────────────────────────────────────────────

void _showGuardianEditSheet(
  BuildContext context,
  int seniorId,
  int? guardianId,
  String currentName,
  String currentRelation,
  String currentPhone,
  Future<void> Function() onRefresh,
) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => _GuardianEditSheet(
      seniorId: seniorId,
      guardianId: guardianId,
      initialName: currentName,
      initialRelation: currentRelation,
      initialPhone: currentPhone,
      onSaved: onRefresh,
    ),
  );
}

class _GuardianEditSheet extends StatefulWidget {
  const _GuardianEditSheet({
    required this.seniorId,
    required this.guardianId,
    required this.initialName,
    required this.initialRelation,
    required this.initialPhone,
    required this.onSaved,
  });
  final int seniorId;
  final int? guardianId;
  final String initialName;
  final String initialRelation;
  final String initialPhone;
  final Future<void> Function() onSaved;

  @override
  State<_GuardianEditSheet> createState() => _GuardianEditSheetState();
}

class _GuardianEditSheetState extends State<_GuardianEditSheet> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _relationCtrl;
  late final TextEditingController _phoneCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.initialName);
    _relationCtrl = TextEditingController(text: widget.initialRelation);
    _phoneCtrl = TextEditingController(
      text: PhoneNumberFormatter().formatEditUpdate(
        const TextEditingValue(text: ''),
        TextEditingValue(text: widget.initialPhone),
      ).text,
    );
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _relationCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (widget.guardianId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('보호자가 연동되어 있지 않습니다.')),
      );
      return;
    }
    setState(() => _saving = true);
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    try {
      await const SeniorApi().patchGuardianRelation(
        guardianId: widget.guardianId!,
        seniorId: widget.seniorId,
        relation: _relationCtrl.text.trim(),
      );
      if (mounted) {
        navigator.pop();
        await widget.onSaved();
        messenger.showSnackBar(
          const SnackBar(content: Text('보호자 정보가 저장되었습니다.')),
        );
      }
    } catch (_) {
      if (mounted) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text('저장에 실패했습니다. 다시 시도해주세요.'),
            backgroundColor: Color(0xFFD94E4E),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + MediaQuery.of(context).padding.bottom + 72,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 핸들
          Center(
            child: Container(
              width: 40, height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: const Color(0xFFE0E0E0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const Text(
            '보호자 정보 수정',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF1F2A20)),
          ),
          const SizedBox(height: 20),
          // 이름 (보호자 계정 이름 — 읽기 전용)
          _EditField(label: '이름', controller: _nameCtrl, hint: '홍길동', readOnly: true),
          const SizedBox(height: 14),
          // 관계 (수정 가능)
          _EditField(
            label: '관계',
            controller: _relationCtrl,
            hint: '예: 아들, 딸, 배우자, 친구 등',
          ),
          const SizedBox(height: 14),
          // 전화번호 (보호자 계정 전화번호 — 읽기 전용)
          _EditField(
            label: '전화번호',
            controller: _phoneCtrl,
            hint: '010-0000-0000',
            isPhone: true,
            readOnly: true,
          ),
          const SizedBox(height: 24),
          // 저장 버튼
          SizedBox(
            height: 52,
            child: FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF86A788),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: _saving
                  ? const SizedBox(width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('저장', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            ),
          ),
        ],
      ),
    );
  }
}

class _EditField extends StatelessWidget {
  const _EditField({
    required this.label,
    required this.controller,
    required this.hint,
    this.isPhone = false,
    this.readOnly = false,
  });
  final String label;
  final TextEditingController controller;
  final String hint;
  final bool isPhone;
  final bool readOnly;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF6D766A))),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          readOnly: readOnly,
          keyboardType: isPhone ? TextInputType.phone : TextInputType.text,
          inputFormatters: (isPhone && !readOnly)
              ? [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(11),
                  PhoneNumberFormatter(),
                ]
              : null,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFFCECECE)),
            filled: true,
            fillColor: readOnly ? const Color(0xFFEEEEEE) : const Color(0xFFF5F7F5),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }
}

// ─── 보호자 검색 연동 바텀시트 ─────────────────────────────────────────────────

void _showGuardianConnectSheet(
  BuildContext context,
  int seniorId, {
  required VoidCallback onConnected,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.white,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => _GuardianConnectSheet(
      seniorId: seniorId,
      onConnected: onConnected,
    ),
  );
}

class _GuardianConnectSheet extends StatefulWidget {
  const _GuardianConnectSheet({
    required this.seniorId,
    required this.onConnected,
  });
  final int seniorId;
  final VoidCallback onConnected;

  @override
  State<_GuardianConnectSheet> createState() => _GuardianConnectSheetState();
}

class _GuardianConnectSheetState extends State<_GuardianConnectSheet> {
  // 0: 검색, 1: 관계 선택
  int _step = 0;

  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _relationCtrl = TextEditingController();

  Map<String, dynamic>? _found;   // 검색 결과
  bool _searching = false;
  bool _saving = false;
  String? _errorMsg;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _relationCtrl.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final name = _nameCtrl.text.trim();
    final phone = _phoneCtrl.text.trim();
    if (name.isEmpty || phone.isEmpty) {
      setState(() => _errorMsg = '이름과 전화번호를 모두 입력해주세요.');
      return;
    }
    setState(() { _searching = true; _errorMsg = null; });
    try {
      final result = await const SeniorApi().searchGuardian(
        name: name, phone: phone,
      );
      if (result == null) {
        setState(() => _errorMsg = '일치하는 보호자를 찾을 수 없어요.\n이름과 전화번호를 다시 확인해주세요.');
      } else {
        FocusScope.of(context).unfocus();
        setState(() { _found = result; _step = 1; });
      }
    } catch (_) {
      setState(() => _errorMsg = '검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (mounted) setState(() => _searching = false);
    }
  }

  Future<void> _connect() async {
    final relation = _relationCtrl.text.trim();
    if (relation.isEmpty) {
      setState(() => _errorMsg = '관계를 입력해주세요.');
      return;
    }
    setState(() { _saving = true; _errorMsg = null; });
    try {
      final guardianId = _found!['id'] as int? ??
          int.tryParse('${_found!['id']}') ?? 0;
      await const SeniorApi().connectGuardian(
        guardianId: guardianId,
        seniorId: widget.seniorId,
        relation: relation,
      );
      if (!mounted) return;
      Navigator.pop(context);
      widget.onConnected();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('보호자가 연동됐어요 🎉'),
          backgroundColor: Color(0xFF86A788),
        ),
      );
    } catch (_) {
      setState(() => _errorMsg = '연동에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 24, right: 24, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 120,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 핸들
          Center(
            child: Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDDDDDD),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // 헤더
          Row(children: [
            if (_step == 1)
              GestureDetector(
                onTap: () => setState(() { _step = 0; _found = null; _errorMsg = null; }),
                child: const Padding(
                  padding: EdgeInsets.only(right: 8),
                  child: Icon(Icons.arrow_back_ios_new, size: 18, color: Color(0xFF1F2A20)),
                ),
              ),
            Expanded(
              child: Text(
                _step == 0 ? '보호자 검색' : '관계 선택',
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF1F2A20)),
              ),
            ),
          ]),
          const SizedBox(height: 6),
          Text(
            _step == 0
                ? '보호자 앱에 가입된 이름과 전화번호로 검색해요.'
                : '어르신과 보호자의 관계를 선택해주세요.',
            style: const TextStyle(fontSize: 13, color: Color(0xFF6D766A)),
          ),
          const SizedBox(height: 20),

          if (_step == 0) ...[
            // ── 검색 단계 ──
            _ConnectField(label: '보호자 이름', controller: _nameCtrl, hint: '예: 김철수'),
            const SizedBox(height: 12),
            _ConnectField(
              label: '보호자 전화번호',
              controller: _phoneCtrl,
              hint: '010-0000-0000',
              keyboardType: TextInputType.phone,
              isPhone: true,
            ),
            const SizedBox(height: 20),
            if (_errorMsg != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF0F0),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(_errorMsg!,
                    style: const TextStyle(fontSize: 13, color: Color(0xFFD94E4E))),
              ),
              const SizedBox(height: 12),
            ],
            FilledButton(
              onPressed: _searching ? null : _search,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF86A788),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _searching
                  ? const SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('검색',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            ),
          ] else ...[
            // ── 관계 선택 단계 ──

            // 찾은 보호자 카드
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F5E9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                const CircleAvatar(
                  radius: 22,
                  backgroundColor: Color(0xFF86A788),
                  child: Icon(Icons.person, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${_found!['name'] ?? ''}',
                            style: const TextStyle(
                                fontSize: 16, fontWeight: FontWeight.w900,
                                color: Color(0xFF1F2A20))),
                        Text('${_found!['phone'] ?? ''}',
                            style: const TextStyle(
                                fontSize: 13, color: Color(0xFF6D766A))),
                      ]),
                ),
                const Icon(Icons.check_circle, color: Color(0xFF86A788), size: 22),
              ]),
            ),
            const SizedBox(height: 20),

            // 관계 입력
            _ConnectField(
              label: '관계',
              controller: _relationCtrl,
              hint: '예: 아들, 딸, 배우자, 친구 등',
              keyboardType: TextInputType.text,
            ),
            const SizedBox(height: 16),
            if (_errorMsg != null) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF0F0),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(_errorMsg!,
                    style: const TextStyle(fontSize: 13, color: Color(0xFFD94E4E))),
              ),
              const SizedBox(height: 12),
            ],
            FilledButton(
              onPressed: _saving ? null : _connect,
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF86A788),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('연동 완료',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            ),
          ],
        ],
      ),
    );
  }
}

class _ConnectField extends StatelessWidget {
  const _ConnectField({
    required this.label,
    required this.controller,
    required this.hint,
    this.keyboardType,
    this.isPhone = false,
  });
  final String label;
  final TextEditingController controller;
  final String hint;
  final TextInputType? keyboardType;
  final bool isPhone;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1F2A20))),
        const SizedBox(height: 6),
        TextField(
          controller: controller,
          keyboardType: keyboardType ?? TextInputType.text,
          textInputAction: isPhone ? TextInputAction.done : TextInputAction.next,
          inputFormatters: isPhone ? [PhoneNumberFormatter()] : null,
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFFCECECE), fontSize: 14),
            filled: true,
            fillColor: const Color(0xFFF7F5E8),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }
}
