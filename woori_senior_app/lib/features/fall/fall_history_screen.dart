import 'dart:async';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';

// ─── helpers ────────────────────────────────────────────────────────────────

String _fmt(dynamic raw) {
  if (raw == null || raw.toString().isEmpty) return '';
  final s = raw.toString();
  try {
    final dt = DateTime.parse(s).toLocal();
    final m = dt.month.toString().padLeft(2, '0');
    final d = dt.day.toString().padLeft(2, '0');
    final h = dt.hour.toString().padLeft(2, '0');
    final min = dt.minute.toString().padLeft(2, '0');
    return '$m/$d $h:$min';
  } catch (_) {
    return s.length > 16 ? s.substring(0, 16) : s;
  }
}

String _location(Map<String, dynamic> alert) {
  final msg = alert['message']?.toString() ?? '';
  final match = RegExp(r'현재 위치:\s*(.+?)(?:\.|$)').firstMatch(msg);
  return match?.group(1)?.trim() ?? '위치 확인 필요';
}

// ─── screen ──────────────────────────────────────────────────────────────────

class FallHistoryScreen extends StatefulWidget {
  const FallHistoryScreen({super.key, required this.seniorId});
  final int seniorId;

  @override
  State<FallHistoryScreen> createState() => _FallHistoryScreenState();
}

class _FallHistoryScreenState extends State<FallHistoryScreen> {
  final _api = const SeniorApi();

  List<Map<String, dynamic>> _logs = [];
  bool _loading = true;
  String? _error;

  // 실시간 감지 서버 상태
  bool _serverOnline = false;
  bool _fallDetected = false;
  int _fallScore = 0;
  static const String _fallServerUrl = fallServerBaseUrl;

  Timer? _refreshTimer;
  Timer? _serverTimer;
  bool _loadInProgress = false;

  int _page = 1;
  static const int _pageSize = 5;

  @override
  void initState() {
    super.initState();
    _load();
    _checkFallServer();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
    _serverTimer = Timer.periodic(const Duration(seconds: 2), (_) => _checkFallServer());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _serverTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (_loadInProgress) return;
    _loadInProgress = true;
    try {
      final alerts = await _api.fetchFallAlerts(widget.seniorId);
      if (!mounted) return;
      final List<Map<String, dynamic>> logs = alerts
          .whereType<Map<String, dynamic>>()
          .toList();
      logs.sort((a, b) {
        final ta = DateTime.tryParse('${a['createdAt'] ?? ''}') ?? DateTime(0);
        final tb = DateTime.tryParse('${b['createdAt'] ?? ''}') ?? DateTime(0);
        return tb.compareTo(ta);
      });
      setState(() {
        _logs = logs;
        _loading = false;
        _error = null;
      });
    } catch (_) {
      if (mounted && _loading) {
        setState(() {
          _error = '낙상 이력을 불러오지 못했습니다.';
          _loading = false;
        });
      }
    } finally {
      _loadInProgress = false;
    }
  }

  Future<void> _checkFallServer() async {
    try {
      final res = await http
          .get(Uri.parse('$_fallServerUrl/status'))
          .timeout(const Duration(seconds: 2));
      if (!mounted) return;
      if (res.statusCode == 200) {
        final body = res.body;
        final scoreMatch = RegExp(r'"score"\s*:\s*(\d+)').firstMatch(body);
        final detectedMatch = RegExp(r'"fall_detected"\s*:\s*(true|false)').firstMatch(body);
        if (!mounted) return;
        setState(() {
          _serverOnline = true;
          _fallScore = int.tryParse(scoreMatch?.group(1) ?? '0') ?? 0;
          _fallDetected = detectedMatch?.group(1) == 'true';
        });
        return;
      }
    } catch (_) {}
    if (!mounted) return;
    setState(() {
      _serverOnline = false;
      _fallDetected = false;
      _fallScore = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final totalPages = (_logs.length / _pageSize).ceil().clamp(1, 9999);
    final visible = _logs.skip((_page - 1) * _pageSize).take(_pageSize).toList();
    final unread = _logs.where((l) => l['isRead'] != true).length;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: const Text(
          '낙상 이력',
          style: TextStyle(color: Color(0xFF1F2A20), fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Color(0xFF86A788)),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF86A788)))
          : RefreshIndicator(
              color: const Color(0xFF86A788),
              onRefresh: _load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _LiveCard(
                            serverOnline: _serverOnline,
                            fallDetected: _fallDetected,
                            score: _fallScore,
                            videoUrl: '$_fallServerUrl/video',
                          ),
                          const SizedBox(height: 12),
                          _SummaryRow(
                            fallCount: _logs.length,
                            unread: unread,
                          ),
                          const SizedBox(height: 12),
                          if (_error != null)
                            _ErrorBanner(message: _error!),
                        ],
                      ),
                    ),
                  ),
                  if (_logs.isEmpty)
                    const SliverFillRemaining(
                      child: Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text('📭', style: TextStyle(fontSize: 40)),
                            SizedBox(height: 12),
                            Text('오늘 낙상 기록이 없습니다',
                                style: TextStyle(
                                    color: Color(0xFF6D766A),
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    )
                  else ...[
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      sliver: SliverToBoxAdapter(
                        child: Row(children: [
                          const Text(
                            '오늘 감지 이력',
                            style: TextStyle(
                                color: Color(0xFF1F2A20),
                                fontSize: 16,
                                fontWeight: FontWeight.w900),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD94E4E).withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              '${_logs.length}건',
                              style: const TextStyle(
                                  color: Color(0xFFD94E4E),
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800),
                            ),
                          ),
                          const SizedBox(height: 12),
                        ]),
                      ),
                    ),
                    const SliverToBoxAdapter(child: SizedBox(height: 8)),
                    SliverPadding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, i) => _FallLogCard(log: visible[i]),
                          childCount: visible.length,
                        ),
                      ),
                    ),
                    if (_logs.length > _pageSize)
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: _Pagination(
                            page: _page,
                            totalPages: totalPages,
                            onPrev: _page > 1
                                ? () => setState(() => _page--)
                                : null,
                            onNext: _page < totalPages
                                ? () => setState(() => _page++)
                                : null,
                          ),
                        ),
                      ),
                  ],
                ],
              ),
            ),
    );
  }
}

// ─── 실시간 감지 카드 ─────────────────────────────────────────────────────────

class _LiveCard extends StatelessWidget {
  const _LiveCard({
    required this.serverOnline,
    required this.fallDetected,
    required this.score,
    required this.videoUrl,
  });

  final bool serverOnline;
  final bool fallDetected;
  final int score;
  final String videoUrl;

  @override
  Widget build(BuildContext context) {
    final isDanger = fallDetected;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDanger ? const Color(0xFFD94E4E) : const Color(0xFFE5E7EB),
          width: isDanger ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: (isDanger ? const Color(0xFFD94E4E) : Colors.black)
                .withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isDanger
                ? const Color(0xFFD94E4E).withValues(alpha: 0.08)
                : const Color(0xFFF0F7F0),
            borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
          ),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('실시간 낙상 감지',
                    style: TextStyle(
                        color: Color(0xFF6D766A),
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  isDanger
                      ? '낙상 감지됨'
                      : serverOnline
                          ? '정상 감지 중'
                          : '감지 서버 연결 대기',
                  style: TextStyle(
                    color: isDanger
                        ? const Color(0xFFD94E4E)
                        : serverOnline
                            ? const Color(0xFF2D7A3A)
                            : const Color(0xFF6D766A),
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isDanger
                    ? const Color(0xFFD94E4E)
                    : serverOnline
                        ? const Color(0xFF86A788)
                        : const Color(0xFFD1D5DB),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isDanger ? '위험' : serverOnline ? '정상' : '대기',
                style: const TextStyle(
                    color: Colors.white, fontSize: 13, fontWeight: FontWeight.w900),
              ),
            ),
          ]),
        ),
        // 영상 영역
        Container(
          height: 180,
          margin: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A1A),
            borderRadius: BorderRadius.circular(10),
          ),
          child: serverOnline
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: Image.network(
                    videoUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => const _VideoPlaceholder(),
                  ),
                )
              : const _VideoPlaceholder(),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          child: Row(children: [
            const Text('감지 점수  ',
                style: TextStyle(color: Color(0xFF6D766A), fontSize: 13)),
            Text('$score점',
                style: const TextStyle(
                    color: Color(0xFF1F2A20),
                    fontSize: 14,
                    fontWeight: FontWeight.w900)),
            const Spacer(),
            Text(
              isDanger ? '보호자 확인을 기다리는 중' : '감지 대기 중',
              style: const TextStyle(color: Color(0xFF6D766A), fontSize: 12),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _VideoPlaceholder extends StatelessWidget {
  const _VideoPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('📷', style: TextStyle(fontSize: 36)),
        SizedBox(height: 8),
        Text(
          'FastAPI 서버를 실행하면\n영상이 표시됩니다',
          textAlign: TextAlign.center,
          style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
        ),
        SizedBox(height: 4),
        Text(
          'py -m uvicorn main:app --host 0.0.0.0 --port 8010',
          style: TextStyle(color: Color(0xFF6B7280), fontSize: 10, fontFamily: 'monospace'),
        ),
      ],
    );
  }
}

// ─── 요약 행 ──────────────────────────────────────────────────────────────────

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.fallCount, required this.unread});
  final int fallCount;
  final int unread;

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      Expanded(child: _StatCard(label: '오늘 낙상', value: '$fallCount', unit: '건', color: const Color(0xFFD94E4E))),
      const SizedBox(width: 10),
      Expanded(
        child: _StatCard(
          label: '처리 상태',
          value: unread > 0 ? '대기' : '완료',
          unit: '',
          color: unread > 0 ? const Color(0xFFF0B429) : const Color(0xFF86A788),
        ),
      ),
    ]);
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.unit,
    required this.color,
  });
  final String label;
  final String value;
  final String unit;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(color: Color(0xFF6D766A), fontSize: 12, fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        Row(crossAxisAlignment: CrossAxisAlignment.baseline, textBaseline: TextBaseline.alphabetic, children: [
          Text(value,
              style: TextStyle(
                  color: color,
                  fontSize: 24,
                  fontWeight: FontWeight.w900)),
          if (unit.isNotEmpty) ...[
            const SizedBox(width: 3),
            Text(unit,
                style: const TextStyle(color: Color(0xFF6D766A), fontSize: 13)),
          ],
        ]),
      ]),
    );
  }
}

// ─── 낙상 로그 카드 ───────────────────────────────────────────────────────────

class _FallLogCard extends StatefulWidget {
  const _FallLogCard({required this.log});
  final Map<String, dynamic> log;

  @override
  State<_FallLogCard> createState() => _FallLogCardState();
}

class _FallLogCardState extends State<_FallLogCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final log = widget.log;
    final isRead = log['isRead'] == true;
    final type = '${log['type'] ?? ''}';
    final isRisk = type == 'FALL_RISK';
    final status = isRead ? '보호자 확인 완료' : '보호자 확인 대기';
    final detail = log['message']?.toString() ?? '낙상 감지 알림이 전송되었습니다.';

    return GestureDetector(
      onTap: () => setState(() => _expanded = !_expanded),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Container(
              width: 5,
              decoration: BoxDecoration(
                color: isRisk ? const Color(0xFFF0B429) : const Color(0xFFD94E4E),
                borderRadius: const BorderRadius.horizontal(left: Radius.circular(11)),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    const Text('📍 ', style: TextStyle(fontSize: 14)),
                    Expanded(
                      child: Text(
                        _location(log),
                        style: const TextStyle(
                            color: Color(0xFF1F2A20),
                            fontSize: 14,
                            fontWeight: FontWeight.w800),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: (isRisk
                                ? const Color(0xFFF0B429)
                                : const Color(0xFFD94E4E))
                            .withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        isRisk ? '⚠️ 위험' : '🚨 낙상',
                        style: TextStyle(
                          color: isRisk
                              ? const Color(0xFFB45309)
                              : const Color(0xFFD94E4E),
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 6),
                  Row(children: [
                    const Text('🕒 ', style: TextStyle(fontSize: 12)),
                    Text(
                      _fmt(log['createdAt']),
                      style: const TextStyle(
                          color: Color(0xFF6D766A), fontSize: 12),
                    ),
                    const Spacer(),
                    Text(
                      status,
                      style: TextStyle(
                        color: isRead
                            ? const Color(0xFF86A788)
                            : const Color(0xFFF0B429),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ]),
                  if (_expanded) ...[
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF7F5E8),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '📝 $detail',
                        style: const TextStyle(
                            color: Color(0xFF1F2A20),
                            fontSize: 13,
                            height: 1.4),
                      ),
                    ),
                  ],
                  const SizedBox(height: 4),
                  Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    Text(
                      _expanded ? '접기 ▲' : '자세히 ▼',
                      style: const TextStyle(
                          color: Color(0xFF86A788),
                          fontSize: 12,
                          fontWeight: FontWeight.w700),
                    ),
                  ]),
                ]),
              ),
            ),
          ]),
        ),
      ),
    );
  }
}

// ─── 페이지네이션 ─────────────────────────────────────────────────────────────

class _Pagination extends StatelessWidget {
  const _Pagination({
    required this.page,
    required this.totalPages,
    required this.onPrev,
    required this.onNext,
  });
  final int page;
  final int totalPages;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisAlignment: MainAxisAlignment.center, children: [
      IconButton(
        icon: const Icon(Icons.chevron_left),
        onPressed: onPrev,
        color: const Color(0xFF86A788),
      ),
      Text(
        '$page / $totalPages',
        style: const TextStyle(
            color: Color(0xFF1F2A20), fontWeight: FontWeight.w800),
      ),
      IconButton(
        icon: const Icon(Icons.chevron_right),
        onPressed: onNext,
        color: const Color(0xFF86A788),
      ),
    ]);
  }
}

// ─── 에러 배너 ────────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFD94E4E).withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(children: [
        const Icon(Icons.error_outline, color: Color(0xFFD94E4E), size: 18),
        const SizedBox(width: 8),
        Text(message,
            style: const TextStyle(color: Color(0xFFD94E4E), fontSize: 13)),
      ]),
    );
  }
}
