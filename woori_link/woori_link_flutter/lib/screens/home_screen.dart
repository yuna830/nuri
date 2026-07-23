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
  const HomeScreen(
      {super.key, this.onTabSelected, this.onRecallRequestsSelected});

  final ValueChanged<int>? onTabSelected;
  final VoidCallback? onRecallRequestsSelected;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Map<String, dynamic>? _senior;
  Map<String, dynamic>? _risk;
  List<dynamic> _products = [];
  List<dynamic> _recallActions = [];
  List<dynamic> _alerts = [];
  bool _loading = true;
  Map<String, dynamic>? _pendingCheckIn;
  Timer? _refreshTimer;
  final Set<String> _shownTomorrowReminderKeys = {};

  @override
  void initState() {
    super.initState();
    _load();
    _refreshTimer =
        Timer.periodic(const Duration(seconds: 10), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) {
        await _redirectToLogin();
        return;
      }

      final senior = await SeniorApi.getSenior(seniorId);
      if (!mounted) return;
      final seniorName = '${senior['name'] ?? ''}'.trim();
      if (senior.isEmpty || seniorName.isEmpty) {
        await _redirectToLogin();
        return;
      }

      final risk = await _loadOptional<Map<String, dynamic>>(
        'risk',
        () async => await RiskApi.getLatestRisk(seniorId) ?? <String, dynamic>{},
        <String, dynamic>{},
      );
      final results = await Future.wait<List<dynamic>>([
        _loadOptional<List<dynamic>>(
          'actions',
          () => ActionApi.getActionsBySenior(seniorId),
          <dynamic>[],
        ),
        _loadOptional<List<dynamic>>(
          'check-ins',
          () => CareMonitoringApi.getCheckIns(seniorId),
          <dynamic>[],
        ),
        _loadOptional<List<dynamic>>(
          'products',
          () => ProductApi.getProductsBySenior(seniorId),
          <dynamic>[],
        ),
        _loadOptional<List<dynamic>>(
          'alerts',
          () => CareMonitoringApi.getAlerts(seniorId),
          <dynamic>[],
        ),
      ]);

      if (!mounted) return;
      final allActions = results[0];
      final checkIns = results[1];
      final products = results[2];
      final alerts = results[3];
      final recallActions = _dedupeRecallActions(
        allActions
            .where((a) => a is Map && '${a['actionType'] ?? ''}' == 'RECALL')
            .where((a) => '${(a as Map)['status'] ?? ''}' != 'CANCELLED')
            .toList(),
        products,
      );

      setState(() {
        _senior = senior;
        _risk = risk.isNotEmpty ? risk : null;
        _products = products;
        _recallActions = recallActions;
        final pending = checkIns
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .where((item) => item['status'] == 'PENDING')
            .toList();
        _alerts = alerts;
        _pendingCheckIn = pending.isEmpty ? null : pending.first;
        _loading = false;
      });
      _showTomorrowVisitReminders();
    } catch (error) {
      if (!mounted) return;
      if (!silent) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              '홈 정보를 불러오지 못했습니다. ${error.toString().replaceFirst('Exception: ', '')}',
            ),
          ),
        );
      }
    }
  }

  Future<T> _loadOptional<T>(
    String label,
    Future<T> Function() loader,
    T fallback,
  ) async {
    try {
      return await loader();
    } catch (error) {
      debugPrint('Home optional load failed ($label): $error');
      return fallback;
    }
  }

  Future<void> _redirectToLogin() async {
    await AuthService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  List<dynamic> _dedupeRecallActions(
      List<dynamic> actions, List<dynamic> products) {
    final recallByKey = <String, Map<String, dynamic>>{};

    for (final item in actions) {
      if (item is! Map) continue;
      final action = Map<String, dynamic>.from(item);
      final status = _effectiveRecallStatus(action, products);
      final product = _productForRecallAction(action, products);
      final nextActionDate = '${product?['nextActionDate'] ?? ''}'.trim();
      final normalized = {
        ...action,
        'status': status,
        if (nextActionDate.isNotEmpty) '_nextActionDate': nextActionDate,
      };
      final key = _recallActionKey(normalized, products);
      final previous = recallByKey[key];
      if (previous == null || _isNewer(normalized, previous)) {
        recallByKey[key] = normalized;
      }
    }

    final result = recallByKey.values.toList();
    result.sort((a, b) => _actionDate(b).compareTo(_actionDate(a)));
    return result;
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

    final productName =
        _normalizeRecallProductName('${action['productName'] ?? ''}');
    if (productName.isNotEmpty) return productName;

    return '${action['id'] ?? action['createdAt'] ?? ''}';
  }

  bool _isNewer(Map<String, dynamic> left, Map<String, dynamic> right) {
    return _actionDate(left).isAfter(_actionDate(right));
  }

  DateTime _actionDate(Map<String, dynamic> action) {
    return DateTime.tryParse(
            '${action['updatedAt'] ?? action['createdAt'] ?? ''}') ??
        DateTime.fromMillisecondsSinceEpoch(0);
  }

  String _effectiveRecallStatus(
      Map<String, dynamic> action, List<dynamic> products) {
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

  Map<String, dynamic>? _productForRecallAction(
      Map<String, dynamic> action, List<dynamic> products) {
    final actionProductName = '${action['productName'] ?? ''}'.trim();
    final actionNote = '${action['note'] ?? ''}';
    final actionProductId = _extractActionProductId(actionNote);
    final actionModelNumber = _extractActionModelNumber(actionNote);

    for (final item in products) {
      if (item is! Map) continue;
      final product = Map<String, dynamic>.from(item);
      if (_effectiveProductRecallStatus(product) != 'RECALLED') continue;
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
      if (_effectiveProductRecallStatus(product) != 'RECALLED') continue;
      final productName = '${product['productName'] ?? ''}'.trim();
      if (actionProductName.isNotEmpty &&
          _sameRecallProductName(actionProductName, productName)) {
        return product;
      }
    }

    return null;
  }

  bool _hasRecallRequest(Map<String, dynamic> product) {
    for (final item in _recallActions) {
      if (item is! Map) continue;
      if (_recallActionMatchesProduct(
          Map<String, dynamic>.from(item), product)) {
        return true;
      }
    }
    return false;
  }

  bool _recallActionMatchesProduct(
      Map<String, dynamic> action, Map<String, dynamic> product) {
    final productId = '${product['id'] ?? ''}'.trim();
    final productName = '${product['productName'] ?? ''}'.trim();
    final modelNumber = '${product['modelNumber'] ?? ''}'.trim();
    final actionProductName = '${action['productName'] ?? ''}'.trim();
    final actionNote = '${action['note'] ?? ''}';
    final actionProductId = _extractActionProductId(actionNote);
    final actionModelNumber = _extractActionModelNumber(actionNote);

    if (productId.isNotEmpty && actionProductId == productId) return true;
    if (modelNumber.isNotEmpty && actionModelNumber == modelNumber) return true;
    return modelNumber.isEmpty &&
        actionModelNumber.isEmpty &&
        productName.isNotEmpty &&
        _sameRecallProductName(actionProductName, productName);
  }

  int _unrequestedRecalledProductCount() {
    return _products.where((item) {
      if (item is! Map) return false;
      final product = Map<String, dynamic>.from(item);
      return _effectiveProductRecallStatus(product) == 'RECALLED' &&
          !_hasRecallRequest(product);
    }).length;
  }

  int _activeRecallRequestCount() {
    return _recallActions.where((item) {
      if (item is! Map) return false;
      final status = '${item['status'] ?? ''}';
      return status == 'PENDING' || status == 'IN_PROGRESS';
    }).length;
  }

  int _recallStatusTotalCount() {
    return _unrequestedRecalledProductCount() + _activeRecallRequestCount();
  }

  String _extractActionModelNumber(String note) {
    final match = RegExp(r'모델명:\s*([^\r\n]+)').firstMatch(note);
    return match?.group(1)?.trim() ?? '';
  }

  String _extractActionProductId(String note) {
    final match = RegExp(r'제품ID:\s*([0-9]+)').firstMatch(note);
    return match?.group(1)?.trim() ?? '';
  }

  String _effectiveProductRecallStatus(Map<String, dynamic> product) {
    final status = '${product['recallStatus'] ?? ''}'.trim();
    final decisionStatus = '${product['recallDecisionStatus'] ?? ''}'.trim();
    final reason = '${product['recallReason'] ?? ''}'.trim();
    final matchedNotice = product['matchedRecallNotice'];
    final matchedNoticeId = '${product['matchedRecallNoticeId'] ?? ''}'.trim();

    if (decisionStatus == 'NO_MATCH_FOUND' ||
        status == 'SAFE' ||
        _isNoMatchRecallReason(reason)) {
      return 'SAFE';
    }
    if (status == 'RECALLED' ||
        decisionStatus == 'RECALL_CONFIRMED' ||
        decisionStatus == 'REVIEW_REQUIRED' ||
        reason.isNotEmpty ||
        matchedNotice != null ||
        matchedNoticeId.isNotEmpty) {
      return 'RECALLED';
    }
    return status.isEmpty ? 'UNKNOWN' : status;
  }

  bool _isNoMatchRecallReason(String reason) {
    if (reason.isEmpty) return false;
    return reason.contains('일치하는 항목을 찾지 못') ||
        reason.contains('리콜 공고에서 입력한 제품 식별정보와 일치') ||
        reason.contains('등록된 리콜 공고에서 입력한 제품 식별정보와 일치');
  }

  String _normalizeRecallProductName(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('\uBCA0\uD130\uB9AC', '\uBC30\uD130\uB9AC')
        .replaceAll(RegExp(r'[^0-9a-z\uAC00-\uD7A3]+'), '');
  }

  bool _sameRecallProductName(String left, String right) {
    final normalizedLeft = _normalizeRecallProductName(left);
    final normalizedRight = _normalizeRecallProductName(right);
    return normalizedLeft.isNotEmpty && normalizedLeft == normalizedRight;
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
    if (status == 'PENDING') return '요청 접수';
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
    final tomorrow =
        DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    return date.year == tomorrow.year &&
        date.month == tomorrow.month &&
        date.day == tomorrow.day;
  }

  String _actionReminderKey(Map<String, dynamic> action) {
    final id = '${action['id'] ?? ''}'.trim();
    if (id.isNotEmpty) return id;
    return '${action['actionType'] ?? ''}:'
        '${action['productName'] ?? ''}:'
        '${action['dueDate'] ?? action['_nextActionDate'] ?? ''}';
  }

  void _showTomorrowVisitReminders() {
    if (_senior?['recallReminderEnabled'] == false) return;

    final fresh = _recallActions
        .whereType<Map>()
        .map((action) => Map<String, dynamic>.from(action))
        .where((action) {
      final status = '${action['status'] ?? 'PENDING'}';
      return status != 'COMPLETED' &&
          status != 'CANCELLED' &&
          _isTomorrowAction(action) &&
          !_shownTomorrowReminderKeys.contains(_actionReminderKey(action));
    }).toList();
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

  int get _unreadAlertCount => _alerts.where((item) {
        if (item is! Map) return false;
        return '${item['status'] ?? ''}' == 'UNREAD';
      }).length;

  String _alertDate(Map<String, dynamic> alert) {
    final raw = '${alert['createdAt'] ?? ''}';
    final date = DateTime.tryParse(raw);
    if (date == null) return '';
    return DateFormat('yyyy.MM.dd HH:mm').format(date);
  }

  Future<void> _openAlerts() async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      clipBehavior: Clip.antiAlias,
      builder: (context) {
        final alerts = _alerts
            .whereType<Map>()
            .map((item) => Map<String, dynamic>.from(item))
            .toList();
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final unreadCount = alerts
                .where((alert) => '${alert['status'] ?? ''}' == 'UNREAD')
                .length;
            Future<void> refreshAlerts() async {
              final seniorId = await AuthService.getUserId();
              if (seniorId == null) return;
              final nextAlerts = await CareMonitoringApi.getAlerts(seniorId);
              if (!mounted) return;
              setState(() => _alerts = nextAlerts);
              setSheetState(() {
                alerts
                  ..clear()
                  ..addAll(nextAlerts
                      .whereType<Map>()
                      .map((item) => Map<String, dynamic>.from(item)));
              });
            }

            Future<void> markAllRead() async {
              final seniorId = await AuthService.getUserId();
              if (seniorId == null || unreadCount == 0) return;
              await CareMonitoringApi.acknowledgeAllAlerts(seniorId);
              await refreshAlerts();
            }

            Future<void> deleteAlert(Map<String, dynamic> alert) async {
              final id = alert['id'];
              if (id is! int) return;
              await CareMonitoringApi.deleteAlert(id);
              await refreshAlerts();
            }

            Future<void> deleteAllAlerts() async {
              final seniorId = await AuthService.getUserId();
              if (seniorId == null || alerts.isEmpty) return;
              final confirmed = await showDialog<bool>(
                context: context,
                builder: (dialogContext) => AlertDialog(
                  title: const Text('알림 전체 삭제'),
                  content: const Text('알림함의 모든 알림을 삭제할까요?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(dialogContext).pop(false),
                      child: const Text('취소'),
                    ),
                    ElevatedButton(
                      onPressed: () => Navigator.of(dialogContext).pop(true),
                      child: const Text('삭제'),
                    ),
                  ],
                ),
              );
              if (confirmed != true) return;
              await CareMonitoringApi.deleteAllAlerts(seniorId);
              await refreshAlerts();
            }

            return SafeArea(
              child: DraggableScrollableSheet(
                expand: false,
                initialChildSize: 0.68,
                minChildSize: 0.36,
                maxChildSize: 0.9,
                builder: (context, controller) => Container(
                  color: Colors.white,
                  padding: const EdgeInsets.fromLTRB(18, 14, 18, 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const Text('알림함',
                              style: TextStyle(
                                  fontSize: 18, fontWeight: FontWeight.w800)),
                          const Spacer(),
                          TextButton(
                            onPressed: unreadCount == 0 ? null : markAllRead,
                            child: const Text('전체 읽음'),
                          ),
                          IconButton(
                            tooltip: '전체 삭제',
                            icon: const Icon(Icons.delete_sweep_outlined),
                            onPressed: alerts.isEmpty ? null : deleteAllAlerts,
                          ),
                          IconButton(
                            tooltip: '닫기',
                            icon: const Icon(Icons.close),
                            onPressed: () => Navigator.of(context).pop(),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: alerts.isEmpty
                            ? const Center(child: Text('받은 알림이 없습니다.'))
                            : ListView.separated(
                                controller: controller,
                                itemCount: alerts.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 10),
                                itemBuilder: (context, index) {
                                  final alert = alerts[index];
                                  final unread =
                                      '${alert['status'] ?? ''}' == 'UNREAD';
                                  return Container(
                                    padding: const EdgeInsets.all(14),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(
                                          color: unread
                                              ? kPrimary.withOpacity(0.45)
                                              : kBorder),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withOpacity(0.04),
                                          blurRadius: 12,
                                          offset: const Offset(0, 6),
                                        ),
                                      ],
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            Expanded(
                                              child: Text(
                                                  '${alert['title'] ?? '알림'}',
                                                  style: const TextStyle(
                                                      fontSize: 14,
                                                      fontWeight:
                                                          FontWeight.w800)),
                                            ),
                                            if (unread)
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                        horizontal: 8,
                                                        vertical: 3),
                                                decoration: BoxDecoration(
                                                    color: kPrimary,
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                            20)),
                                                child: const Text('새 알림',
                                                    style: TextStyle(
                                                        color: Colors.white,
                                                        fontSize: 10,
                                                        fontWeight:
                                                            FontWeight.w800)),
                                              ),
                                          ],
                                        ),
                                        const SizedBox(height: 8),
                                        Text('${alert['message'] ?? ''}',
                                            style: const TextStyle(
                                                fontSize: 13, height: 1.45)),
                                        const SizedBox(height: 8),
                                        Row(
                                          children: [
                                            Text(_alertDate(alert),
                                                style: const TextStyle(
                                                    color: kTextMuted,
                                                    fontSize: 11)),
                                            const Spacer(),
                                            if (unread)
                                              TextButton(
                                                onPressed: () async {
                                                  final id = alert['id'];
                                                  if (id is int) {
                                                    await CareMonitoringApi
                                                        .acknowledgeAlert(id);
                                                    await refreshAlerts();
                                                  }
                                                },
                                                child: const Text('읽음'),
                                              ),
                                            IconButton(
                                              tooltip: '삭제',
                                              visualDensity:
                                                  VisualDensity.compact,
                                              icon: const Icon(
                                                  Icons.delete_outline,
                                                  color: kTextMuted),
                                              onPressed: () =>
                                                  deleteAlert(alert),
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
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
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    IconButton(
                      tooltip: '알림',
                      icon: const Icon(Icons.notifications_none),
                      onPressed: _openAlerts,
                    ),
                    if (_unreadAlertCount > 0)
                      Positioned(
                        right: 7,
                        top: 7,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 5, vertical: 2),
                          decoration: BoxDecoration(
                              color: kDanger,
                              borderRadius: BorderRadius.circular(10)),
                          child: Text('$_unreadAlertCount',
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800)),
                        ),
                      ),
                  ],
                ),
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
                        style: const TextStyle(
                            color: Colors.white70, fontSize: 13),
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
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700)),
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
                            _risk?['weatherRisk'] == true
                                ? '⚠️ 특보 발효 중'
                                : '이상 없음',
                          ),
                          _checkItem(
                            '리콜 제품 확인',
                            _risk?['recallRisk'] == true,
                            _risk?['recallRisk'] == true
                                ? '⚠️ 리콜 제품 있음'
                                : '이상 없음',
                          ),
                          _checkItem(
                            '에너지바우처',
                            _risk?['voucherUnapplied'] == true,
                            _risk?['voucherUnapplied'] == true
                                ? '정보 확인 필요'
                                : '신청 현황 확인',
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),

                  // 대기 중인 서비스
                  if (_recallStatusTotalCount() > 0) ...[
                    InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: _unrequestedRecalledProductCount() > 0
                          ? () => widget.onTabSelected?.call(2)
                          : widget.onRecallRequestsSelected,
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
                                          '리콜 조치 현황',
                                          style: TextStyle(
                                            fontSize: 17,
                                            fontWeight: FontWeight.w800,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          '미조치 ${_unrequestedRecalledProductCount()}건 · '
                                          '요청/진행 중 ${_activeRecallRequestCount()}건',
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
                                      '${_recallStatusTotalCount()}건',
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
                              ..._recallActions.take(2).map((a) {
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
                                      _recallActions.length > 2
                                          ? '외 ${_recallActions.length - 2}건 더 있음'
                                          : _unrequestedRecalledProductCount() >
                                                  0
                                              ? '리콜 대상 제품에서 조치 요청을 보낼 수 있어요'
                                              : '자세한 진행 상태를 확인할 수 있어요',
                                      style: const TextStyle(
                                        color: kTextMuted,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    const Spacer(),
                                    Text(
                                      _unrequestedRecalledProductCount() > 0
                                          ? '보유 제품 보기'
                                          : '요청 내역 보기',
                                      style: const TextStyle(
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
          Text(label,
              style:
                  const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          const Spacer(),
          Text(status,
              style: TextStyle(
                  fontSize: 12, color: isWarning ? kDanger : kTextMuted)),
        ],
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
