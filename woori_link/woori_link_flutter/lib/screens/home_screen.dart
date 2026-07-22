import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api/senior_api.dart';
import '../api/risk_api.dart';
import '../api/action_api.dart';
import '../api/care_monitoring_api.dart';
import '../api/product_api.dart';
import '../services/auth_service.dart';
import '../theme.dart';
import 'chat_screen.dart';
import 'login_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, this.onTabSelected, this.onRecallRequestsSelected});

  final ValueChanged<int>? onTabSelected;
  final VoidCallback? onRecallRequestsSelected;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _senior;
  Map<String, dynamic>? _risk;
  List<dynamic> _actions = [];
  bool _loading = true;
  Map<String, dynamic>? _pendingCheckIn;
  Timer? _refreshTimer;
  final Set<String> _shownTomorrowReminderKeys = {};

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) return;
      final results = await Future.wait([
        SeniorApi.getSenior(seniorId),
        RiskApi.getLatestRisk(seniorId).then((r) => r ?? {}),
        ActionApi.getActionsBySenior(seniorId),
        CareMonitoringApi.getCheckIns(seniorId),
        ProductApi.getProductsBySenior(seniorId),
      ]);
      if (!mounted) return;
      final products = results[4] as List<dynamic>;
      setState(() {
        _senior = results[0] as Map<String, dynamic>;
        final r = results[1] as Map<String, dynamic>;
        _risk = r.isNotEmpty ? r : null;
        _actions = _pendingActions(results[2] as List<dynamic>, products);
        final checkIns = results[3] as List<dynamic>;
        final pending = checkIns.cast<Map<String, dynamic>>().where((item) => item['status'] == 'PENDING').toList();
        _pendingCheckIn = pending.isEmpty ? null : pending.first;
        _loading = false;
      });
      _showTomorrowVisitReminders();
    } catch (_) {
      if (!silent && mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> _pendingActions(List<dynamic> actions, List<dynamic> products) {
    final visible = <Map<String, dynamic>>[];
    final recallByKey = <String, Map<String, dynamic>>{};

    for (final item in actions) {
      if (item is! Map) continue;
      final action = Map<String, dynamic>.from(item);
      final type = '${action['actionType'] ?? ''}';
      final status = type == 'RECALL'
          ? _effectiveRecallStatus(action, products)
          : '${action['status'] ?? 'PENDING'}';
      if (status != 'PENDING' && status != 'IN_PROGRESS') continue;

      final product = type == 'RECALL'
          ? _productForRecallAction(action, products)
          : null;
      final nextActionDate = '${product?['nextActionDate'] ?? ''}'.trim();
      final normalized = {
        ...action,
        'status': status,
        if (nextActionDate.isNotEmpty) '_nextActionDate': nextActionDate,
      };
      if (type == 'RECALL') {
        final key = _recallActionKey(normalized, products);
        final previous = recallByKey[key];
        if (previous == null || _isNewer(normalized, previous)) {
          recallByKey[key] = normalized;
        }
      } else {
        visible.add(normalized);
      }
    }

    visible.addAll(recallByKey.values);
    visible.sort((a, b) => _actionDate(b).compareTo(_actionDate(a)));
    return visible;
  }

  String _recallActionKey(Map<String, dynamic> action, List<dynamic> products) {
    final product = _productForRecallAction(action, products);
    final matchedProductId = '${product?['id'] ?? ''}'.trim();
    if (matchedProductId.isNotEmpty) return 'id:$matchedProductId';

    final note = '${action['note'] ?? ''}';
    final actionProductId = _extractActionProductId(note);
    if (actionProductId.isNotEmpty) return 'id:$actionProductId';

    final modelNumber = _extractActionModelNumber(note);
    if (modelNumber.isNotEmpty) return 'model:${modelNumber.toLowerCase()}';

    final productName = '${action['productName'] ?? ''}'.trim().toLowerCase();
    if (productName.isNotEmpty) return productName;

    return '${action['id'] ?? action['createdAt'] ?? ''}';
  }

  bool _isNewer(Map<String, dynamic> left, Map<String, dynamic> right) {
    return _actionDate(left).isAfter(_actionDate(right));
  }

  DateTime _actionDate(Map<String, dynamic> action) {
    return DateTime.tryParse('${action['updatedAt'] ?? action['createdAt'] ?? ''}') ??
        DateTime.fromMillisecondsSinceEpoch(0);
  }

  String _effectiveRecallStatus(Map<String, dynamic> action, List<dynamic> products) {
    final product = _productForRecallAction(action, products);
    if (product == null) return '${action['status'] ?? 'PENDING'}';

    final finalResult = '${product['finalResult'] ?? ''}';
    final followUpProgress = '${product['followUpProgressStatus'] ?? ''}';
    if (finalResult.isNotEmpty || followUpProgress == 'COMPLETED') {
      return 'COMPLETED';
    }

    final currentUseStatus = '${product['currentUseStatus'] ?? 'UNKNOWN'}';
    final followUpType = '${product['followUpType'] ?? ''}'.trim();
    final stopGuidanceCompleted = product['stopGuidanceCompleted'] == true;
    if (currentUseStatus != 'UNKNOWN' ||
        followUpType.isNotEmpty ||
        stopGuidanceCompleted) {
      return 'IN_PROGRESS';
    }

    return '${action['status'] ?? 'PENDING'}';
  }

  Map<String, dynamic>? _productForRecallAction(Map<String, dynamic> action, List<dynamic> products) {
    final actionProductName = '${action['productName'] ?? ''}'.trim();
    final actionNote = '${action['note'] ?? ''}';
    final actionProductId = _extractActionProductId(actionNote);
    final actionModelNumber = _extractActionModelNumber(actionNote);

    for (final item in products) {
      if (item is! Map) continue;
      final product = Map<String, dynamic>.from(item);
      if ('${product['recallStatus'] ?? ''}' != 'RECALLED') continue;
      final productId = '${product['id'] ?? ''}'.trim();
      final modelNumber = '${product['modelNumber'] ?? ''}'.trim();
      if (actionProductId.isNotEmpty && actionProductId == productId) {
        return product;
      }
      if (actionModelNumber.isNotEmpty &&
          modelNumber.isNotEmpty &&
          actionModelNumber == modelNumber) {
        return product;
      }
    }

    for (final item in products) {
      if (item is! Map) continue;
      final product = Map<String, dynamic>.from(item);
      if ('${product['recallStatus'] ?? ''}' != 'RECALLED') continue;
      final productName = '${product['productName'] ?? ''}'.trim();
      if (actionProductName.isNotEmpty && actionProductName == productName) {
        return product;
      }
    }

    return null;
  }

  String _extractActionModelNumber(String note) {
    final match = RegExp(r'모델명:\s*([^\r\n]+)').firstMatch(note);
    return match?.group(1)?.trim() ?? '';
  }

  String _extractActionProductId(String note) {
    final match = RegExp(r'제품ID:\s*([0-9]+)').firstMatch(note);
    return match?.group(1)?.trim() ?? '';
  }

  Future<void> _respondToCheckIn() async {
    final checkIn = _pendingCheckIn;
    if (checkIn == null) return;
    await CareMonitoringApi.respondToCheckIn(checkIn['id'] as int, 'I am okay');
    if (mounted) setState(() => _pendingCheckIn = null);
  }

  Color _riskColor(String? level) {
    if (level == 'HIGH') return kDanger;
    if (level == 'MEDIUM') return kWarning;
    return kPrimary;
  }

  String _riskLabel(String? level) {
    if (level == 'HIGH') return '위험';
    if (level == 'MEDIUM') return '주의';
    return '안전';
  }

  String _actionTitle(Map<String, dynamic> action) {
    final productName = '${action['productName'] ?? ''}'.trim();
    switch ('${action['actionType'] ?? ''}') {
      case 'RECALL':
        return productName.isEmpty ? '리콜 조치 요청' : '리콜 조치 요청 · $productName';
      case 'VOUCHER':
        return '에너지바우처 신청 지원';
      case 'SOS':
        return 'SOS 신고 조치';
      case 'GAS_CHECK':
        return '가스 안전 점검';
      case 'ELECTRIC_CHECK':
        return '전기 안전 점검';
      case 'VISIT':
        return '방문 조치';
      default:
        return '${action['description'] ?? action['actionType'] ?? '조치 요청'}';
    }
  }

  String _actionStatusLabel(String? status) {
    if (status == 'PENDING') return '미조치';
    if (status == 'IN_PROGRESS') return '조치 진행 중';
    if (status == 'COMPLETED') return '조치 완료';
    if (status == 'CANCELLED') return '취소됨';
    return '상태 확인 중';
  }

  Color _actionStatusColor(String? status) {
    if (status == 'IN_PROGRESS') return kPrimary;
    if (status == 'COMPLETED') return kTextMuted;
    return kWarning;
  }

  IconData _actionIcon(Map<String, dynamic> action) {
    switch ('${action['actionType'] ?? ''}') {
      case 'RECALL':
        return Icons.warning_amber_rounded;
      case 'VOUCHER':
        return Icons.bolt;
      case 'SOS':
        return Icons.sos;
      case 'VISIT':
        return Icons.home_repair_service_outlined;
      default:
        return Icons.assignment_outlined;
    }
  }

  String _actionNotePreview(Map<String, dynamic> action) {
    final note = '${action['note'] ?? ''}'.trim();
    if (note.isEmpty) return '';
    final marker = '제품안전정보센터 리콜 사유:';
    final markerIndex = note.indexOf(marker);
    final raw = markerIndex >= 0 ? note.substring(0, markerIndex) : note;
    return raw
        .split(RegExp(r'\r?\n'))
        .map((line) => line.trim())
        .where((line) =>
            line.isNotEmpty &&
            !line.startsWith('제품ID:') &&
            !line.startsWith('모델명:'))
        .take(2)
        .join(' ');
  }

  DateTime? _actionNextDate(Map<String, dynamic> action) {
    final rawActionDate = '${action['dueDate'] ?? ''}'.trim();
    final rawProductDate = '${action['_nextActionDate'] ?? ''}'.trim();
    final raw = rawActionDate.isNotEmpty ? rawActionDate : rawProductDate;
    if (raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  String _actionScheduleLabel(Map<String, dynamic> action) {
    final date = _actionNextDate(action);
    if (date == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(date.year, date.month, date.day);
    final diff = target.difference(today).inDays;
    final formatted = DateFormat('yyyy.MM.dd').format(date);
    if (diff == 0) return '오늘 방문 예정 ($formatted)';
    if (diff == 1) return '내일 방문 예정 ($formatted)';
    if (diff > 1) return '$diff일 뒤 방문 예정 ($formatted)';
    return '방문 예정일 지남 ($formatted)';
  }

  bool _isTomorrowAction(Map<String, dynamic> action) {
    final date = _actionNextDate(action);
    if (date == null) return false;
    final now = DateTime.now();
    final tomorrow = DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    return date.year == tomorrow.year &&
        date.month == tomorrow.month &&
        date.day == tomorrow.day;
  }

  String _actionReminderKey(Map<String, dynamic> action) {
    final id = '${action['id'] ?? ''}'.trim();
    if (id.isNotEmpty) return id;
    return '${action['actionType'] ?? ''}:${action['productName'] ?? ''}:${action['dueDate'] ?? action['_nextActionDate'] ?? ''}';
  }

  void _showTomorrowVisitReminders() {
    if (_senior?['recallReminderEnabled'] == false) return;

    final fresh = _actions
        .whereType<Map>()
        .map((action) => Map<String, dynamic>.from(action))
        .where((action) {
          final status = '${action['status'] ?? 'PENDING'}';
          return status != 'COMPLETED' &&
              status != 'CANCELLED' &&
              _isTomorrowAction(action) &&
              !_shownTomorrowReminderKeys.contains(_actionReminderKey(action));
        })
        .toList();
    if (fresh.isEmpty || !mounted) return;

    for (final action in fresh) {
      _shownTomorrowReminderKeys.add(_actionReminderKey(action));
    }

    final names = fresh
        .take(2)
        .map((action) => '${action['productName'] ?? '리콜 제품'}')
        .join(', ');
    final extra = fresh.length > 2 ? ' 외 ${fresh.length - 2}건' : '';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('내일 방문 예정인 조치가 있어요: $names$extra'),
          action: SnackBarAction(
            label: '보기',
            onPressed: () {
              ScaffoldMessenger.of(context).hideCurrentSnackBar();
              widget.onRecallRequestsSelected?.call();
            },
          ),
        ),
      );
    });
  }

  int _actionCountByStatus(String status) {
    return _actions.where((item) {
      if (item is! Map) return false;
      return '${item['status'] ?? ''}' == status;
    }).length;
  }

  Future<void> _logout() async {
    await AuthService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final name = _senior?['name'] ?? '님';
    final address = _senior?['address'] ?? '';
    final riskLevel = _risk?['level'] as String?;
    final riskScore = _risk?['totalScore'] as int?;

    return Scaffold(
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (_pendingCheckIn != null) ...[
            FloatingActionButton.extended(
              heroTag: 'checkInFab',
              onPressed: _respondToCheckIn,
              icon: const Icon(Icons.favorite),
              label: const Text('안부 확인: 괜찮아요'),
              backgroundColor: kPrimary,
            ),
            const SizedBox(height: 12),
          ],
          FloatingActionButton(
            heroTag: 'chatFab',
            tooltip: '상담 챗봇',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ChatScreen()),
              );
            },
            backgroundColor: kPrimary,
            child: const _RobotFaceIcon(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(),
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 128,
              pinned: true,
              backgroundColor: kPrimary,
              actions: [
                IconButton(
                  tooltip: '로그아웃',
                  icon: const Icon(Icons.logout),
                  onPressed: _logout,
                ),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [kPrimaryDark, kPrimary],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                  padding: const EdgeInsets.fromLTRB(20, 48, 20, 14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        '안녕하세요, $name님',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        address,
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // 위험도 카드
                  if (_risk != null) ...[
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Text('오늘의 위험도',
                                    style: TextStyle(
                                        fontSize: 15, fontWeight: FontWeight.w700)),
                                const Spacer(),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color:
                                        _riskColor(riskLevel).withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    _riskLabel(riskLevel),
                                    style: TextStyle(
                                        color: _riskColor(riskLevel),
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(4),
                              child: LinearProgressIndicator(
                                value: (riskScore ?? 0) / 100,
                                minHeight: 8,
                                backgroundColor: kBorder,
                                valueColor: AlwaysStoppedAnimation(
                                    _riskColor(riskLevel)),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text('${riskScore ?? 0}점',
                                style: const TextStyle(
                                    fontSize: 12, color: kTextMuted)),
                            if (_risk!['riskReason'] != null) ...[
                              const SizedBox(height: 8),
                              Text(_risk!['riskReason'],
                                  style: const TextStyle(
                                      fontSize: 12, color: kTextMuted)),
                            ],
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],

                  // 체크리스트
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('안전 체크리스트',
                              style: TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.w700)),
                          const SizedBox(height: 12),
                          _checkItem(
                            '기상특보 확인',
                            _risk?['weatherRisk'] == true,
                            _risk?['weatherRisk'] == true ? '⚠️ 특보 발효 중' : '이상 없음',
                          ),
                          _checkItem(
                            '리콜 제품 확인',
                            _risk?['recallRisk'] == true,
                            _risk?['recallRisk'] == true ? '⚠️ 리콜 제품 있음' : '이상 없음',
                          ),
                          _checkItem(
                            '에너지바우처',
                            _risk?['voucherUnapplied'] == true,
                            _risk?['voucherUnapplied'] == true ? '❌ 미신청' : '신청 완료',
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // 대기 중인 서비스
                  if (_actions.isNotEmpty) ...[
                    InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: widget.onRecallRequestsSelected,
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 42,
                                    height: 42,
                                    decoration: BoxDecoration(
                                      color: kWarning.withOpacity(0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(
                                      Icons.assignment_late_outlined,
                                      color: kWarning,
                                      size: 24,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        const Text(
                                          '조치가 필요한 요청',
                                          style: TextStyle(
                                            fontSize: 17,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '미조치 ${_actionCountByStatus('PENDING')}건 · 진행 중 ${_actionCountByStatus('IN_PROGRESS')}건',
                                          style: const TextStyle(
                                            color: kTextMuted,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: kDanger.withOpacity(0.08),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      '${_actions.length}건',
                                      style: const TextStyle(
                                        color: kDanger,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              ..._actions.take(2).map((a) {
                                final action =
                                    Map<String, dynamic>.from(a as Map);
                                final title = _actionTitle(action);
                                final status =
                                    '${action['status'] ?? 'PENDING'}';
                                final note = _actionNotePreview(action);
                                final scheduleLabel =
                                    _actionScheduleLabel(action);
                                final color = _actionStatusColor(status);
                                return Container(
                                  width: double.infinity,
                                  margin: const EdgeInsets.only(bottom: 8),
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: color.withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(10),
                                    border: Border.all(
                                      color: color.withOpacity(0.18),
                                    ),
                                  ),
                                  child: Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Icon(
                                        _actionIcon(action),
                                        color: color,
                                        size: 22,
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              title,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                            if (scheduleLabel.isNotEmpty) ...[
                                              const SizedBox(height: 4),
                                              Row(
                                                children: [
                                                  Icon(
                                                    Icons.event_available,
                                                    size: 14,
                                                    color: color,
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Expanded(
                                                    child: Text(
                                                      scheduleLabel,
                                                      maxLines: 1,
                                                      overflow:
                                                          TextOverflow.ellipsis,
                                                      style: TextStyle(
                                                        fontSize: 11,
                                                        color: color,
                                                        fontWeight:
                                                            FontWeight.w800,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                            if (note.isNotEmpty) ...[
                                              const SizedBox(height: 4),
                                              Text(
                                                note,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: kTextMuted,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        _actionStatusLabel(status),
                                        style: TextStyle(
                                          color: color,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              }),
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Row(
                                  children: [
                                    Text(
                                      _actions.length > 2
                                          ? '외 ${_actions.length - 2}건 더 있음'
                                          : '자세한 진행 상태를 확인할 수 있어요',
                                      style: const TextStyle(
                                        color: kTextMuted,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const Spacer(),
                                    const Text(
                                      '요청 내역 보기',
                                      style: TextStyle(
                                        color: kPrimaryDark,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                    const SizedBox(width: 3),
                                    const Icon(
                                      Icons.chevron_right,
                                      color: kPrimaryDark,
                                      size: 18,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],

                  // 복지 서비스 타일
                  const Text('복지 서비스',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.4,
                    children: [
                      _serviceTile(context, Icons.bolt, '에너지바우처', kWarning, tabIndex: 1),
                      _serviceTile(context, Icons.warning_amber, '리콜 확인', kDanger, tabIndex: 2),
                      _serviceTile(context, Icons.chat_bubble_outline, '상담 챗봇', kPrimary),
                      _serviceTile(context, Icons.sos, 'SOS 신고', kDanger, tabIndex: 3),
                    ],
                  ),
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _checkItem(String label, bool isWarning, String status) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(
            isWarning ? Icons.error_outline : Icons.check_circle_outline,
            color: isWarning ? kDanger : kPrimary,
            size: 20,
          ),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(status,
              style: TextStyle(
                  fontSize: 12,
                  color: isWarning ? kDanger : kTextMuted)),
        ],
      ),
    );
  }

  Widget _serviceTile(
      BuildContext context, IconData icon, String label, Color color,
      {int? tabIndex}) {
    return GestureDetector(
      onTap: () {
        if (tabIndex != null) {
          widget.onTabSelected?.call(tabIndex);
          return;
        }
        if (label == '상담 챗봇') {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ChatScreen()),
          );
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: color.withOpacity(0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.2)),
        ),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 26),
            const SizedBox(height: 8),
            Text(label,
                style: TextStyle(
                    color: color, fontSize: 13, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

class _RobotFaceIcon extends StatelessWidget {
  const _RobotFaceIcon();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 42,
      height: 42,
      child: CustomPaint(painter: _RobotFacePainter()),
    );
  }
}

class _RobotFacePainter extends CustomPainter {
  const _RobotFacePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final scaleX = size.width / 48;
    final scaleY = size.height / 48;
    canvas.save();
    canvas.scale(scaleX, scaleY);

    final stroke = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.8
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final fill = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    canvas.drawLine(const Offset(24, 8), const Offset(24, 13), stroke);
    canvas.drawCircle(const Offset(24, 6), 2, stroke);

    final face = RRect.fromRectAndRadius(
      const Rect.fromLTWH(8, 13, 32, 25),
      const Radius.circular(10),
    );
    canvas.drawRRect(face, stroke);

    canvas.drawCircle(const Offset(18, 25), 2.5, fill);
    canvas.drawCircle(const Offset(30, 25), 2.5, fill);

    final smile = Path()
      ..moveTo(17, 32)
      ..cubicTo(19, 34, 21.3, 35, 24, 35)
      ..cubicTo(26.7, 35, 29, 34, 31, 32);
    canvas.drawPath(smile, stroke);

    canvas.drawPath(
      Path()
        ..moveTo(8, 24)
        ..lineTo(4, 24)
        ..lineTo(4, 32)
        ..lineTo(9, 32),
      stroke,
    );
    canvas.drawPath(
      Path()
        ..moveTo(40, 24)
        ..lineTo(44, 24)
        ..lineTo(44, 32)
        ..lineTo(39, 32),
      stroke,
    );
    canvas.drawLine(const Offset(18, 38), const Offset(18, 42), stroke);
    canvas.drawLine(const Offset(30, 38), const Offset(30, 42), stroke);

    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
