import 'dart:async';

import 'package:flutter/material.dart';
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
  const HomeScreen({super.key, this.onTabSelected});

  final ValueChanged<int>? onTabSelected;

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

      final normalized = {...action, 'status': status};
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
    final matchedProductName = '${product?['productName'] ?? ''}'.trim().toLowerCase();
    if (matchedProductName.isNotEmpty) return matchedProductName;

    final productName = '${action['productName'] ?? ''}'.trim().toLowerCase();
    if (productName.isNotEmpty) return productName;

    final note = '${action['note'] ?? ''}';
    final modelMatch = RegExp(r'모델명:\s*([^\s\n]+)').firstMatch(note);
    final modelNumber = modelMatch?.group(1)?.trim().toLowerCase();
    if (modelNumber != null && modelNumber.isNotEmpty) return modelNumber;

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

    for (final item in products) {
      if (item is! Map) continue;
      final product = Map<String, dynamic>.from(item);
      if ('${product['recallStatus'] ?? ''}' != 'RECALLED') continue;
      final modelNumber = '${product['modelNumber'] ?? ''}'.trim();
      if (modelNumber.isNotEmpty && actionNote.contains(modelNumber)) {
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

    final name = _senior?['name'] ?? '어르신';
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
                        '안녕하세요, $name 어르신',
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
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('대기 중인 서비스 ${_actions.length}건',
                                style: const TextStyle(
                                    fontSize: 15, fontWeight: FontWeight.w700)),
                            const SizedBox(height: 12),
                            ..._actions.map((a) {
                              final action = Map<String, dynamic>.from(a as Map);
                              final title = _actionTitle(action);
                              final status =
                                  _actionStatusLabel(action['status'] as String?);
                              final note = '${action['note'] ?? ''}'.trim();
                              return Padding(
                                  padding:
                                      const EdgeInsets.only(bottom: 8),
                                  child: Row(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        margin: const EdgeInsets.only(top: 5),
                                        decoration: const BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: kWarning),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              '$title · $status',
                                              style: const TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            if (note.isNotEmpty) ...[
                                              const SizedBox(height: 3),
                                              Text(
                                                note,
                                                maxLines: 2,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontSize: 11,
                                                  color: kTextMuted,
                                                  height: 1.35,
                                                ),
                                              ),
                                            ],
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                            }),
                          ],
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
