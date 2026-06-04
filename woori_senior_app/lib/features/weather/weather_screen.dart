import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../core/api/senior_api.dart';

// ─────────────────────────────────────────────
//  상수 / 타입
// ─────────────────────────────────────────────

const _defaultLat = 37.5665;
const _defaultLon = 126.9780;

class _Level {
  const _Level({
    required this.key,
    required this.label,
    required this.icon,
    required this.desc,
    required this.color,
  });
  final String key;
  final String label;
  final String icon;
  final String desc;
  final Color color;
}

const _levels = <String, _Level>{
  'safe': _Level(key: 'safe', label: '안전', icon: '✅', desc: '외출 가능', color: Color(0xFF86A788)),
  'normal': _Level(key: 'normal', label: '보통', icon: 'ℹ️', desc: '확인 필요', color: Color(0xFF4F9CC9)),
  'caution': _Level(key: 'caution', label: '주의', icon: '⚠️', desc: '주의 필요', color: Color(0xFFF0A500)),
  'warning': _Level(key: 'warning', label: '경고', icon: '🚨', desc: '외출 자제', color: Color(0xFFE05252)),
  'danger': _Level(key: 'danger', label: '위험', icon: '⛔', desc: '외출 금지', color: Color(0xFF7A1A1A)),
};


const _actions = [
  ('🧥', '외출 전 옷차림과 보행 보조도구를 다시 확인하세요.'),
  ('📞', '위험 단계에서는 보호자에게 이동 사실을 먼저 알려주세요.'),
  ('🏠', '폭염·폭우·폭설 특보가 있으면 실내 활동을 우선하세요.'),
  ('💧', '기온 변화가 큰 날은 수분 섭취와 휴식을 자주 챙기세요.'),
];

// ─────────────────────────────────────────────
//  KMA 격자 변환 (Lambert Conformal Conic)
// ─────────────────────────────────────────────

Map<String, int> _latLonToGrid(double lat, double lon) {
  const re = 6371.00877;
  const grid = 5.0;
  const slat1Deg = 30.0;
  const slat2Deg = 60.0;
  const olonDeg = 126.0;
  const olatDeg = 38.0;
  const xo = 43.0;
  const yo = 136.0;
  const degrad = pi / 180.0;

  const r = re / grid;
  const s1 = slat1Deg * degrad;
  const s2 = slat2Deg * degrad;
  const ol = olonDeg * degrad;
  const ola = olatDeg * degrad;

  var sn = tan(pi * 0.25 + s2 * 0.5) / tan(pi * 0.25 + s1 * 0.5);
  sn = log(cos(s1) / cos(s2)) / log(sn);
  var sf = pow(tan(pi * 0.25 + s1 * 0.5), sn).toDouble() * cos(s1) / sn;
  final ro = r * sf / pow(tan(pi * 0.25 + ola * 0.5), sn).toDouble();

  final ra2 = r * sf / pow(tan(pi * 0.25 + lat * degrad * 0.5), sn).toDouble();
  var theta = lon * degrad - ol;
  if (theta > pi) theta -= 2.0 * pi;
  if (theta < -pi) theta += 2.0 * pi;
  theta *= sn;

  return {
    'nx': (ra2 * sin(theta) + xo + 0.5).floor(),
    'ny': (ro - ra2 * cos(theta) + yo + 0.5).floor(),
  };
}

// ─────────────────────────────────────────────
//  기후 인사이트 계산
// ─────────────────────────────────────────────

class _ClimateInsight {
  const _ClimateInsight({
    required this.region,
    required this.title,
    required this.type,
    required this.tag,
    required this.status,
    required this.scores,
    required this.tips,
  });

  final String region;
  final String title;
  final String type;
  final String tag;
  final String status;
  final List<({String key, int value, Color color})> scores;
  final List<String> tips;
}

_ClimateInsight _buildInsight(Map<String, dynamic> weather, String region) {
  double numOf(dynamic v) => double.tryParse('$v') ?? 0;

  // 백엔드 응답 필드명 유연하게 처리
  final temp = numOf(weather['temp'] ?? weather['TMP'] ?? '20');
  final rainProb = numOf(weather['rainProb'] ?? weather['POP'] ?? weather['pop'] ?? '0');
  final wind = numOf(weather['wind'] ?? weather['WSD'] ?? weather['wsd'] ?? '0');
  final humid = numOf(weather['humid'] ?? weather['REH'] ?? weather['reh'] ?? '50');

  double tempScore;
  if (temp >= 33) {
    tempScore = 92;
  } else if (temp >= 30) {
    tempScore = 78;
  } else if (temp <= -5) {
    tempScore = 76;
  } else if (temp <= 0) {
    tempScore = 58;
  } else {
    tempScore = 22;
  }

  final scores = [
    (key: '기온', value: tempScore.clamp(0, 100).round(), color: const Color(0xFFE05252)),
    (key: '강수', value: rainProb.clamp(0, 100).round(), color: const Color(0xFF4C9ED9)),
    (key: '바람', value: (wind * 12).clamp(0, 100).round(), color: const Color(0xFFF0B429)),
    (key: '건조', value: (100 - humid).clamp(0, 100).round(), color: const Color(0xFF8B6FD6)),
  ];

  final dominant = scores.reduce((a, b) => a.value > b.value ? a : b);

  final typeMap = <String, ({String title, String type, String tag})>{
    '기온': temp <= 0
        ? (title: '한파 주의', type: '한파', tag: '한파')
        : (title: '더위 대비', type: '더위', tag: '더위'),
    '강수': (title: '강수 대비', type: '강수', tag: '비'),
    '바람': (title: '강풍 대비', type: '바람', tag: '바람'),
    '건조': (title: '건조 주의', type: '건조', tag: '건조'),
  };

  final selected = dominant.value >= 35
      ? typeMap[dominant.key]!
      : (title: '기후 안정', type: '안정', tag: '좋음');

  final tipsMap = <String, List<String>>{
    '더위': ['낮 시간 수분 섭취', '자외선 노출 줄이기', '실내 온도 점검'],
    '한파': ['외출 전 보온 확인', '빙판길 천천히 이동', '혈압 변화 주의'],
    '강수': ['우산과 미끄럼 방지 신발', '하천 주변 이동 피하기', '젖은 옷 바로 갈아입기'],
    '바람': ['간판 주변 피하기', '창문 잠금 확인', '외출 시 보행 보조 주의'],
    '건조': ['수분 섭취 늘리기', '실내 습도 유지', '호흡기 자극 주의'],
    '안정': ['가벼운 산책 가능', '수분 섭취 유지', '날씨 변화만 확인'],
  };

  final status = dominant.value >= 70
      ? '위험'
      : dominant.value >= 35
          ? '주의'
          : '좋음';

  return _ClimateInsight(
    region: region,
    title: selected.title,
    type: selected.type,
    tag: selected.tag,
    status: status,
    scores: scores,
    tips: tipsMap[selected.type] ?? ['날씨 변화를 확인하세요.'],
  );
}

// ─────────────────────────────────────────────
//  알림 정규화
// ─────────────────────────────────────────────

Map<String, dynamic> _normalizeAlert(dynamic raw) {
  if (raw is! Map<String, dynamic>) return {};
  final issuedAt = raw['issuedAt'] ?? raw['createdAt'];
  final time = issuedAt != null
      ? '$issuedAt'.replaceFirst('T', ' ').length >= 16
          ? '$issuedAt'.replaceFirst('T', ' ').substring(0, 16)
          : '$issuedAt'.replaceFirst('T', ' ')
      : '';
  return {
    'id': raw['eventId'] ?? raw['id'] ?? UniqueKey().toString(),
    'type': raw['type'] ?? '기후',
    'level': raw['level'] ?? 'safe',
    'message': raw['message'] ?? '',
    'time': time,
    'region': raw['region'] ?? '대한민국',
    'sortTime': issuedAt != null
        ? DateTime.tryParse('$issuedAt')?.millisecondsSinceEpoch ?? 0
        : 0,
  };
}

String _pad(int v) => v.toString().padLeft(2, '0');

String _nowHm() {
  final n = DateTime.now();
  return '${_pad(n.hour)}:${_pad(n.minute)}';
}

// ─────────────────────────────────────────────
//  WeatherScreen
// ─────────────────────────────────────────────

typedef ActionRegistrar = void Function({
  required VoidCallback action,
  required IconData icon,
  required String tooltip,
});

class WeatherScreen extends StatefulWidget {
  const WeatherScreen({
    super.key,
    required this.seniorId,
    this.hideAppBar = false,
    this.onRegisterAction,
  });
  final int seniorId;
  final bool hideAppBar;
  final ActionRegistrar? onRegisterAction;

  @override
  State<WeatherScreen> createState() => _WeatherScreenState();
}

class _WeatherScreenState extends State<WeatherScreen>
    with WidgetsBindingObserver {
  final _api = const SeniorApi();

  List<Map<String, dynamic>> _alerts = [];
  _ClimateInsight? _insight;
  bool _loading = true;
  bool _fetching = false;
  String _lastFetched = '--:--';
  String? _error;

  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadAll();
    _refreshTimer =
        Timer.periodic(const Duration(minutes: 1), (_) => _loadAll());
    widget.onRegisterAction?.call(
      action: _loadAll,
      icon: Icons.refresh,
      tooltip: '새로고침',
    );
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _loadAll();
  }

  // ── GPS 위치 취득 (실패 시 기본값) ───────────
  Future<({double lat, double lon})> _getPos() async {
    try {
      final svc = await Geolocator.isLocationServiceEnabled();
      if (!svc) return (lat: _defaultLat, lon: _defaultLon);
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        return (lat: _defaultLat, lon: _defaultLon);
      }
      final pos = await Geolocator.getCurrentPosition()
          .timeout(const Duration(seconds: 10));
      return (lat: pos.latitude, lon: pos.longitude);
    } catch (_) {
      return (lat: _defaultLat, lon: _defaultLon);
    }
  }

  // ── 전체 로드 ──────────────────────────────
  Future<void> _loadAll() async {
    if (!mounted) return;
    setState(() {
      _fetching = true;
      _error = null;
    });

    try {
      // GPS + 날씨 + DB 알림 병렬 로드
      final pos = await _getPos();
      final grid = _latLonToGrid(pos.lat, pos.lon);

      final results = await Future.wait([
        _api.fetchClimateAlerts(widget.seniorId).catchError((_) => <dynamic>[]),
        _api
            .fetchWeather(grid['nx']!, grid['ny']!)
            .catchError((_) => <String, dynamic>{}),
      ]);

      if (!mounted) return;

      final rawAlerts = results[0] as List<dynamic>;
      final weatherData = results[1] as Map<String, dynamic>;

      // 알림 정규화 & 정렬
      final normalized = rawAlerts
          .map(_normalizeAlert)
          .where((a) => a.isNotEmpty)
          .toList();
      normalized.sort(
          (a, b) => ((b['sortTime'] as int?) ?? 0).compareTo((a['sortTime'] as int?) ?? 0));

      // safe 알림이 없으면 기본 안전 알림 추가
      if (normalized.isEmpty) {
        final now = DateTime.now();
        normalized.add({
          'id': 'safe-${now.millisecondsSinceEpoch}',
          'type': '오늘 날씨',
          'level': 'safe',
          'message': '현재 발령된 기상특보가 없습니다. 오늘 하루 기후 상태는 비교적 안전합니다.',
          'time': '${now.year}-${_pad(now.month)}-${_pad(now.day)} ${_pad(now.hour)}:00',
          'region': '대한민국',
          'sortTime': now.millisecondsSinceEpoch,
        });
      }

      // 기후 인사이트 계산
      final region = await _regionFromPos(pos.lat, pos.lon);
      final insight = weatherData.isNotEmpty
          ? _buildInsight(weatherData, region)
          : null;

      setState(() {
        _alerts = normalized;
        _insight = insight;
        _loading = false;
        _fetching = false;
        _lastFetched = _nowHm();
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _fetching = false;
        _error = '데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
      });
    }
  }

  Future<String> _regionFromPos(double lat, double lon) async {
    // 기본 주소 표시: 좌표 수준의 지역명은 GPS 위치에서 간략히 반환
    // (역지오코딩은 위치 화면에서 이미 처리하므로 여기서는 기본값)
    return '현재 위치';
  }

  // ── computed ──────────────────────────────
  Map<String, dynamic>? get _topAlert =>
      _alerts.isNotEmpty ? _alerts.first : null;

  _Level get _currentLevel {
    final alert = _topAlert;
    if (alert == null) return _levels['safe']!;
    return _levels[alert['level'] as String? ?? 'safe'] ?? _levels['safe']!;
  }

  bool get _hasWarning {
    final lvl = _topAlert?['level'];
    return lvl == 'warning' || lvl == 'danger';
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
                '기후 알림',
                style: TextStyle(
                    color: Color(0xFF1F2A20), fontWeight: FontWeight.w900),
              ),
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: 4),
                  child: _fetching
                      ? const Padding(
                          padding: EdgeInsets.all(12),
                          child: SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : IconButton(
                          icon: const Icon(Icons.refresh,
                              color: Color(0xFF86A788)),
                          onPressed: _loadAll,
                          tooltip: '새로고침',
                        ),
                ),
              ],
      ),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? _ErrorView(message: _error!, onRetry: _loadAll)
                : _Body(
                    alerts: _alerts,
                    insight: _insight,
                    currentLevel: _currentLevel,
                    topAlert: _topAlert,
                    hasWarning: _hasWarning,
                    lastFetched: _lastFetched,
                  ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  _Body
// ─────────────────────────────────────────────
class _Body extends StatelessWidget {
  const _Body({
    required this.alerts,
    required this.insight,
    required this.currentLevel,
    required this.topAlert,
    required this.hasWarning,
    required this.lastFetched,
  });

  final List<Map<String, dynamic>> alerts;
  final _ClimateInsight? insight;
  final _Level currentLevel;
  final Map<String, dynamic>? topAlert;
  final bool hasWarning;
  final String lastFetched;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
      children: [
        // ── 현재 위험 단계 배너 ────────────────
        if (topAlert != null) ...[
          _LevelBanner(
            level: currentLevel,
            alert: topAlert!,
          ),
          const SizedBox(height: 12),
        ],

        // ── 기후 인사이트 ──────────────────────
        if (insight != null) ...[
          _InsightCard(insight: insight!),
          const SizedBox(height: 12),
        ] else ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.06),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Row(children: [
              Text('🌤️', style: TextStyle(fontSize: 32)),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('오늘의 날씨',
                        style: TextStyle(
                            color: Color(0xFF1F2A20),
                            fontSize: 15,
                            fontWeight: FontWeight.w900)),
                    SizedBox(height: 4),
                    Text('날씨 정보를 불러오는 중입니다.\n위치 권한을 허용하면 상세 정보가 표시됩니다.',
                        style: TextStyle(
                            color: Color(0xFF6D766A),
                            fontSize: 12,
                            height: 1.4)),
                  ],
                ),
              ),
            ]),
          ),
          const SizedBox(height: 12),
        ],

        // ── 알림 목록 ──────────────────────────
        _AlertListCard(
          alerts: alerts,
          lastFetched: lastFetched,
        ),
        const SizedBox(height: 12),

        // ── 위험 시 행동 요령 ──────────────────
        if (hasWarning) ...[
          const _ActionTipsCard(),
          const SizedBox(height: 12),
        ],

        // ── 단계 안내 ──────────────────────────
        const _LevelGuideCard(),
        const SizedBox(height: 12),

        // ── 데이터 출처 ────────────────────────
        const _SourceNote(),
      ],
    );
  }
}

// ─────────────────────────────────────────────
//  Level Banner
// ─────────────────────────────────────────────
class _LevelBanner extends StatelessWidget {
  const _LevelBanner({required this.level, required this.alert});
  final _Level level;
  final Map<String, dynamic> alert;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [level.color, level.color.withValues(alpha: 0.85)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      '현재 기후 위험 단계',
                      style: TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${level.icon} ${level.label}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${level.desc} · ${alert['type'] ?? '기후'} 기준',
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                level.icon,
                style: const TextStyle(fontSize: 52),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '📍 ${alert['region'] ?? '대한민국'} · ${alert['time'] ?? ''} 기준',
            style: const TextStyle(
              color: Colors.white60,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  Climate Insight Card
// ─────────────────────────────────────────────
class _InsightCard extends StatelessWidget {
  const _InsightCard({required this.insight});
  final _ClimateInsight insight;

  @override
  Widget build(BuildContext context) {
    final total = insight.scores.fold(0, (sum, s) => sum + s.value);
    final safeTotal = total < 1 ? 1 : total;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 헤더
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          insight.region,
                          style: const TextStyle(
                            fontSize: 12,
                            color: Color(0xFF6D766A),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(width: 6),
                        const Text(
                          '단기예보 기반',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF9DA89A),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      insight.title,
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1F2A20),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFF6FAF4),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFDDE9D8)),
                ),
                child: Text(
                  insight.tag,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF48624B),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // 도넛 차트 (근사 구현 - 가로형 세그먼트 바)
          Row(
            children: [
              SizedBox(
                width: 80,
                height: 80,
                child: CustomPaint(
                  painter: _DonutPainter(
                    scores: insight.scores
                        .map((s) => (
                              value: s.value.toDouble() / safeTotal,
                              color: s.color,
                            ))
                        .toList(),
                  ),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          insight.type,
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF1F2A20),
                          ),
                        ),
                        Text(
                          insight.status,
                          style: const TextStyle(
                            fontSize: 10,
                            color: Color(0xFF6D766A),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  children: insight.scores
                      .map((s) => _ScoreBar(
                            label: s.key,
                            value: s.value,
                            color: s.color,
                          ))
                      .toList(),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // 팁
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF7F5E8),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: insight.tips
                  .map((tip) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text('• ',
                                style: TextStyle(
                                    color: Color(0xFF86A788),
                                    fontWeight: FontWeight.w900)),
                            Expanded(
                              child: Text(
                                tip,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: Color(0xFF1F2A20),
                                  fontWeight: FontWeight.w700,
                                  height: 1.4,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ))
                  .toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class _ScoreBar extends StatelessWidget {
  const _ScoreBar({
    required this.label,
    required this.value,
    required this.color,
  });
  final String label;
  final int value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          SizedBox(
            width: 32,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF6D766A),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: value / 100.0,
                backgroundColor: const Color(0xFFEEEEEE),
                valueColor: AlwaysStoppedAnimation<Color>(color),
                minHeight: 10,
              ),
            ),
          ),
          const SizedBox(width: 6),
          SizedBox(
            width: 30,
            child: Text(
              '$value%',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w900,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// 도넛 차트 커스텀 페인터
class _DonutPainter extends CustomPainter {
  const _DonutPainter({required this.scores});
  final List<({double value, Color color})> scores;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    const strokeWidth = 14.0;
    final rect = Rect.fromCircle(center: center, radius: radius - strokeWidth / 2);

    double startAngle = -pi / 2;
    for (final s in scores) {
      final sweepAngle = 2 * pi * s.value;
      final paint = Paint()
        ..color = s.color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.butt;
      canvas.drawArc(rect, startAngle, sweepAngle - 0.05, false, paint);
      startAngle += sweepAngle;
    }
  }

  @override
  bool shouldRepaint(_DonutPainter old) => old.scores != scores;
}

// ─────────────────────────────────────────────
//  Alert List Card — 최신 1건만 카드로 표시
// ─────────────────────────────────────────────
class _AlertListCard extends StatelessWidget {
  const _AlertListCard({
    required this.alerts,
    required this.lastFetched,
  });
  final List<Map<String, dynamic>> alerts;
  final String lastFetched;

  @override
  Widget build(BuildContext context) {
    if (alerts.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE8F5E9)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: const Color(0xFF86A788).withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Center(
                child: Text('🌤️', style: TextStyle(fontSize: 26))),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
              Row(children: [
                const Text('기후 알림',
                    style: TextStyle(
                        color: Color(0xFF1F2A20),
                        fontSize: 15,
                        fontWeight: FontWeight.w900)),
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF86A788).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Text('안전',
                      style: TextStyle(
                          color: Color(0xFF86A788),
                          fontSize: 11,
                          fontWeight: FontWeight.w800)),
                ),
              ]),
              const SizedBox(height: 4),
              const Text(
                '현재 발령된 기상특보가 없습니다.\n오늘 하루 기후 상태는 비교적 안전합니다.',
                style: TextStyle(
                    color: Color(0xFF6D766A), fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 6),
              Text('갱신 $lastFetched',
                  style: const TextStyle(
                      color: Color(0xFFBDBDBD), fontSize: 11)),
            ]),
          ),
        ]),
      );
    }

    // 최신 알림 1건만
    final latest = alerts.first;
    final levelKey = latest['level'] as String? ?? 'safe';
    final level = _levels[levelKey] ?? _levels['safe']!;
    final message = latest['message']?.toString() ??
        latest['description']?.toString() ??
        '기후 알림이 있습니다.';
    final type = latest['type']?.toString() ?? '기후 알림';
    final region = latest['region']?.toString() ?? '';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: level.color.withValues(alpha: 0.3), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: level.color.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // 헤더
        Container(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          decoration: BoxDecoration(
            color: level.color.withValues(alpha: 0.08),
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(15)),
          ),
          child: Row(children: [
            Text(level.icon, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text('기후 알림',
                    style: const TextStyle(
                        color: Color(0xFF6D766A),
                        fontSize: 11,
                        fontWeight: FontWeight.w700)),
                Text(type,
                    style: TextStyle(
                        color: level.color,
                        fontSize: 15,
                        fontWeight: FontWeight.w900)),
              ]),
            ),
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: level.color,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(level.label,
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w900)),
            ),
          ]),
        ),
        // 본문
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
            Text(message,
                style: const TextStyle(
                    color: Color(0xFF1F2A20),
                    fontSize: 14,
                    height: 1.5)),
            const SizedBox(height: 10),
            Row(children: [
              if (region.isNotEmpty) ...[
                const Icon(Icons.location_on_outlined,
                    size: 13, color: Color(0xFF6D766A)),
                const SizedBox(width: 3),
                Text(region,
                    style: const TextStyle(
                        color: Color(0xFF6D766A), fontSize: 12)),
                const SizedBox(width: 12),
              ],
              const Icon(Icons.access_time,
                  size: 13, color: Color(0xFFBDBDBD)),
              const SizedBox(width: 3),
              Text('갱신 $lastFetched',
                  style: const TextStyle(
                      color: Color(0xFFBDBDBD), fontSize: 12)),
              if (alerts.length > 1) ...[
                const Spacer(),
                Text('외 ${alerts.length - 1}건',
                    style: const TextStyle(
                        color: Color(0xFF86A788),
                        fontSize: 12,
                        fontWeight: FontWeight.w700)),
              ],
            ]),
          ]),
        ),
      ]),
    );
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({required this.alert});
  final Map<String, dynamic> alert;

  @override
  Widget build(BuildContext context) {
    final levelKey = alert['level'] as String? ?? 'safe';
    final level = _levels[levelKey] ?? _levels['safe']!;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FBF9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFEEF2EE)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 레벨 색 바
          Container(
            width: 5,
            height: 90,
            decoration: BoxDecoration(
              color: level.color,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                bottomLeft: Radius.circular(12),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        '${level.icon} ${alert['type'] ?? '기후'}',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1F2A20),
                        ),
                      ),
                      const Spacer(),
                      if ((alert['region'] ?? '').toString().isNotEmpty)
                        Text(
                          '📍 ${alert['region']}',
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFF6D766A),
                          ),
                        ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: level.color,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          level.label,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${alert['message'] ?? ''}',
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF1F2A20),
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '⏱ ${alert['time'] ?? ''}',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF9DA89A),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  Action Tips Card
// ─────────────────────────────────────────────
class _ActionTipsCard extends StatelessWidget {
  const _ActionTipsCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF0F0),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF5C6C6)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '⚠️ 위험 시 행동 요령',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w900,
              color: Color(0xFFD94E4E),
            ),
          ),
          const SizedBox(height: 12),
          ..._actions.map(
            (a) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(a.$1, style: const TextStyle(fontSize: 20)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      a.$2,
                      style: const TextStyle(
                        fontSize: 13,
                        color: Color(0xFF1F2A20),
                        height: 1.4,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  Level Guide Card
// ─────────────────────────────────────────────
class _LevelGuideCard extends StatelessWidget {
  const _LevelGuideCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '알림 단계 안내',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1F2A20),
            ),
          ),
          const SizedBox(height: 12),
          ..._levels.values.map(
            (level) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: level.color,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${level.icon} ${level.label}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    level.desc,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Color(0xFF6D766A),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  Source Note
// ─────────────────────────────────────────────
class _SourceNote extends StatelessWidget {
  const _SourceNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF6FAF4),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFDDE9D8)),
      ),
      child: const Text(
        '📡 기후 위험 알림은 기상청 공공 API 및 서비스 데이터를 기반으로 합니다. '
        '특보가 없는 상태 기록은 매 정각 기준으로 하루 동안 누적됩니다.',
        style: TextStyle(
          fontSize: 12,
          color: Color(0xFF6D766A),
          height: 1.5,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  Error View
// ─────────────────────────────────────────────
class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('⚠️', style: TextStyle(fontSize: 48)),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1F2A20),
              ),
            ),
            const SizedBox(height: 16),
            FilledButton(
              style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF86A788)),
              onPressed: onRetry,
              child: const Text('다시 불러오기'),
            ),
          ],
        ),
      ),
    );
  }
}
