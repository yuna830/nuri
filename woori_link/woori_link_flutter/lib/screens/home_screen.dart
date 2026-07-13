import 'package:flutter/material.dart';
import '../api/senior_api.dart';
import '../api/risk_api.dart';
import '../api/action_api.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) return;
      final results = await Future.wait([
        SeniorApi.getSenior(seniorId),
        RiskApi.getLatestRisk(seniorId).then((r) => r ?? {}),
        ActionApi.getActionsBySenior(seniorId),
      ]);
      setState(() {
        _senior = results[0] as Map<String, dynamic>;
        final r = results[1] as Map<String, dynamic>;
        _risk = r.isNotEmpty ? r : null;
        _actions = (results[2] as List<dynamic>)
            .where((a) => a['status'] == 'PENDING' || a['status'] == 'IN_PROGRESS')
            .toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
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
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              expandedHeight: 200,
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
                  padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
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
                            ..._actions.map((a) => Padding(
                                  padding:
                                      const EdgeInsets.only(bottom: 8),
                                  child: Row(
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: const BoxDecoration(
                                            shape: BoxShape.circle,
                                            color: kWarning),
                                      ),
                                      const SizedBox(width: 10),
                                      Expanded(
                                        child: Text(
                                          a['description'] ??
                                              a['actionType'] ??
                                              '',
                                          style: const TextStyle(fontSize: 13),
                                        ),
                                      ),
                                    ],
                                  ),
                                )),
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
