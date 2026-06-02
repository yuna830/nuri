import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import '../../core/api/senior_api.dart';

// ─────────────────────────────────────────────
//  helpers (top-level)
// ─────────────────────────────────────────────

double _metersApart(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371000.0;
  final phi1 = lat1 * pi / 180;
  final phi2 = lat2 * pi / 180;
  final dPhi = (lat2 - lat1) * pi / 180;
  final dLambda = (lon2 - lon1) * pi / 180;
  final a = sin(dPhi / 2) * sin(dPhi / 2) +
      cos(phi1) * cos(phi2) * sin(dLambda / 2) * sin(dLambda / 2);
  return 2 * r * atan2(sqrt(a), sqrt(1 - a));
}

String _todayStr() {
  final now = DateTime.now();
  return '${now.year.toString().padLeft(4, '0')}-'
      '${now.month.toString().padLeft(2, '0')}-'
      '${now.day.toString().padLeft(2, '0')}';
}

String _nowHm() {
  final now = DateTime.now();
  return '${now.hour.toString().padLeft(2, '0')}:'
      '${now.minute.toString().padLeft(2, '0')}';
}

const double _defaultLat = 37.4979;
const double _defaultLon = 127.0276;
const int _defaultRadius = 200;

// ─────────────────────────────────────────────
//  LocationScreen
// ─────────────────────────────────────────────

typedef ActionRegistrar = void Function({
  required VoidCallback action,
  required IconData icon,
  required String tooltip,
});

class LocationScreen extends StatefulWidget {
  const LocationScreen({
    super.key,
    required this.seniorId,
    this.hideAppBar = false,
    this.onRegisterAction,
  });

  final int seniorId;
  final bool hideAppBar;
  final ActionRegistrar? onRegisterAction;

  @override
  State<LocationScreen> createState() => _LocationScreenState();
}

class _LocationScreenState extends State<LocationScreen>
    with WidgetsBindingObserver {
  final _api = const SeniorApi();
  final _mapController = MapController();

  double? _lat;
  double? _lon;
  String _address = '위치 정보 없음';
  String _lastUpdate = '--:--';
  bool _loading = true;
  String? _error;

  List<Map<String, dynamic>> _safeZones = [];

  String _selectedDate = _todayStr();
  List<Map<String, dynamic>> _history = [];
  bool _historyLoading = false;

  double? _lastSavedLat;
  double? _lastSavedLon;
  DateTime? _lastSavedAt;
  String? _serverReceivedAt; // 서버 마지막 수신 시각

  Timer? _locationTimer;
  Timer? _safeZoneTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // 권한 요청이 다른 권한 요청과 겹치지 않도록 첫 프레임 이후 실행
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _loadSafeZones();
      _loadServerLocation(); // 서버 저장 위치 먼저 표시
      _getLocation();
      _loadHistory(_selectedDate);
    });
    _locationTimer =
        Timer.periodic(const Duration(seconds: 30), (_) => _getLocationSilent());
    _safeZoneTimer =
        Timer.periodic(const Duration(seconds: 10), (_) => _loadSafeZones());
    widget.onRegisterAction?.call(
      action: _getLocation,
      icon: Icons.refresh,
      tooltip: '새로고침',
    );
  }

  @override
  void dispose() {
    _locationTimer?.cancel();
    _safeZoneTimer?.cancel();
    _mapController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _getLocation();
      _loadSafeZones();
    }
  }

  // ── 안전반경 로드 ──────────────────────────────
  Future<void> _loadSafeZones() async {
    try {
      final data = await _api.fetchSafeZones(widget.seniorId);
      if (!mounted) return;
      setState(() {
        _safeZones = data.whereType<Map<String, dynamic>>().toList();
      });
    } catch (_) {}
  }

  // ── 타이머 전용 silent 갱신 (로딩 스피너 없이) ──
  // ── 서버 최신 위치 불러오기 ─────────────────────
  Future<void> _loadServerLocation() async {
    try {
      final data = await _api.fetchLatestLocation(widget.seniorId);
      if (data == null || !mounted) return;
      final lat = (data['latitude'] as num?)?.toDouble();
      final lon = (data['longitude'] as num?)?.toDouble();
      final address = data['address'] as String? ?? '';
      final receivedAt = data['receivedAt'] as String?;
      if (lat == null || lon == null) return;
      if (!mounted) return;
      setState(() {
        _lat ??= lat;
        _lon ??= lon;
        if (_address == '위치 정보 없음') _address = address;
        _serverReceivedAt = receivedAt;
        _loading = false;
      });
      try {
        _mapController.move(LatLng(lat, lon), 15);
      } catch (_) {}
    } catch (_) {}
  }

  Future<void> _getLocationSilent() async {
    if (!mounted) return;
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      if (!mounted) return;
      final address = await _reverseGeocode(pos.latitude, pos.longitude);
      await _maybeAutoSave(pos.latitude, pos.longitude, address,
          accuracy: pos.accuracy);
      if (!mounted) return;
      setState(() {
        _lat = pos.latitude;
        _lon = pos.longitude;
        _address = address;
        _lastUpdate = _nowHm();
        _error = null;
      });
      _mapController.move(LatLng(pos.latitude, pos.longitude), 15);
    } catch (_) {}
  }

  // ── GPS 위치 취득 (최초 로드용, 로딩 스피너 표시) ──
  Future<void> _getLocation() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = '위치 서비스가 꺼져 있어요. 설정에서 켜주세요.';
        });
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          if (!mounted) return;
          setState(() {
            _loading = false;
            _error = '위치 권한을 허용해주세요.';
          });
          return;
        }
      }
      if (permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = '위치 권한이 거부되었습니다. 설정 > 앱 > 권한에서 허용해주세요.';
        });
        return;
      }

      final position = await Geolocator.getCurrentPosition()
          .timeout(const Duration(seconds: 15));

      if (!mounted) return;

      final lat = position.latitude;
      final lon = position.longitude;
      final address = await _reverseGeocode(lat, lon);

      if (!mounted) return;
      setState(() {
        _lat = lat;
        _lon = lon;
        _address = address;
        _lastUpdate = _nowHm();
        _loading = false;
      });

      // 지도 이동
      try {
        _mapController.move(LatLng(lat, lon), 15);
      } catch (_) {}

      // 50m 이상 이동 시 서버 저장 (accuracy 포함)
      await _maybeAutoSave(lat, lon, address, accuracy: position.accuracy);

      // 오늘 선택된 경우 이력 갱신
      if (_selectedDate == _todayStr()) {
        await _loadHistory(_selectedDate);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = '위치를 불러오지 못했어요. 다시 시도해주세요.';
      });
    }
  }

  // ── Nominatim 역지오코딩 ───────────────────────
  Future<String> _reverseGeocode(double lat, double lon) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse'
        '?format=json&lat=$lat&lon=$lon&accept-language=ko',
      );
      final response = await http
          .get(uri, headers: {'User-Agent': 'WooriSeniorApp/1.0'})
          .timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data =
            jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
        final addr = data['address'] as Map<String, dynamic>?;
        if (addr != null) {
          final parts = <String>[];
          for (final key in [
            'province',
            'city',
            'town',
            'county',
            'district',
            'quarter',
            'neighbourhood',
            'road',
          ]) {
            final v = addr[key];
            if (v != null && '$v'.isNotEmpty) parts.add('$v');
          }
          if (parts.isNotEmpty) return parts.join(' ');
        }
      }
    } catch (_) {}
    return '${lat.toStringAsFixed(5)}, ${lon.toStringAsFixed(5)}';
  }

  // ── 위치 자동 저장 (최초, 50m 이동, 또는 5분 생존 신호) ──────
  Future<void> _maybeAutoSave(double lat, double lon, String address,
      {double? accuracy}) async {
    final prevLat = _lastSavedLat;
    final prevLon = _lastSavedLon;
    final isFirst = prevLat == null || prevLon == null;
    final moved = isFirst
        ? double.infinity
        : _metersApart(prevLat, prevLon, lat, lon);

    final now = DateTime.now();
    final shouldHeartbeat = _lastSavedAt == null ||
        now.difference(_lastSavedAt!) >= const Duration(minutes: 5);

    // 최초 위치는 거리 무관하게 저장하고, 정지 상태도 5분마다 최신 시각을 갱신
    if (!isFirst && moved < 50 && !shouldHeartbeat) return;

    try {
      await _api.saveLocation(
        seniorId: widget.seniorId,
        lat: lat,
        lon: lon,
        address: address,
        accuracy: accuracy,
      );
      _lastSavedLat = lat;
      _lastSavedLon = lon;
      _lastSavedAt = now;
    } catch (_) {}
  }

  // ── 이동 이력 로드 ─────────────────────────────
  Future<void> _loadHistory(String date) async {
    if (!mounted) return;
    setState(() => _historyLoading = true);
    try {
      final items = await _api.fetchLocationHistory(widget.seniorId, date);
      if (!mounted) return;
      final parsed = items
          .whereType<Map<String, dynamic>>()
          .map((item) {
            final raw = item['receivedAt'];
            final timeStr = raw == null ? '' : '$raw';
            return {
              'time': timeStr.length >= 16 ? timeStr.substring(11, 16) : '--:--',
              'place': item['address'] ?? '현재 위치',
            };
          })
          .toList()
          .reversed
          .cast<Map<String, dynamic>>()
          .toList();
      setState(() {
        _history = parsed;
        _historyLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _history = [];
        _historyLoading = false;
      });
    }
  }

  // ── computed: 안전반경 거리 목록 ───────────────
  List<({Map<String, dynamic> zone, int distance})> get _zoneDistances {
    if (_lat == null || _lon == null) return [];
    final list = _safeZones.map((zone) {
      final zLat =
          (zone['centerLatitude'] as num?)?.toDouble() ?? _defaultLat;
      final zLon =
          (zone['centerLongitude'] as num?)?.toDouble() ?? _defaultLon;
      final dist = _metersApart(_lat!, _lon!, zLat, zLon).round();
      return (zone: zone, distance: dist);
    }).toList();
    list.sort((a, b) => a.distance.compareTo(b.distance));
    return list;
  }

  bool get _isInRange {
    if (_lat == null || _lon == null) return true;
    if (_safeZones.isEmpty) return true;
    return _zoneDistances.any((e) {
      final radius =
          (e.zone['radiusMeters'] as num?)?.toInt() ?? _defaultRadius;
      return e.distance <= radius;
    });
  }

  // ── 날짜 선택 ──────────────────────────────────
  Future<void> _pickDate() async {
    final now = DateTime.now();
    final parsed = DateTime.tryParse(_selectedDate) ?? now;
    final picked = await showDatePicker(
      context: context,
      initialDate: parsed,
      firstDate: DateTime(now.year - 1),
      lastDate: now,
    );
    if (picked == null || !mounted) return;
    final str =
        '${picked.year.toString().padLeft(4, '0')}-'
        '${picked.month.toString().padLeft(2, '0')}-'
        '${picked.day.toString().padLeft(2, '0')}';
    setState(() => _selectedDate = str);
    await _loadHistory(str);
  }

  // ─────────────────────────────────────────────
  //  build
  // ─────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final inRange = _isInRange;
    final zd = _zoneDistances;
    final nearest = zd.isNotEmpty ? zd.first : null;
    final nearestRadius =
        nearest != null
            ? (nearest.zone['radiusMeters'] as num?)?.toInt() ?? _defaultRadius
            : _defaultRadius;
    final nearestName =
        nearest != null
            ? '${nearest.zone['name'] ?? '안전 장소'}'
            : '자택';

    return Scaffold(
      backgroundColor: const Color(0xFFFFFDEC),
      appBar: widget.hideAppBar
          ? null
          : AppBar(
              backgroundColor: Colors.white,
              surfaceTintColor: Colors.white,
              elevation: 0,
              title: const Text(
                '위치 확인',
                style: TextStyle(
                    color: Color(0xFF1F2A20), fontWeight: FontWeight.w900),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.refresh, color: Color(0xFF86A788)),
                  tooltip: '새로고침',
                  onPressed: _loading ? null : _getLocation,
                ),
              ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            // ── 상태 카드 ─────────────────────────
            _LocationStatusCard(
              loading: _loading,
              error: _error,
              address: _address,
              lastUpdate: _lastUpdate,
              isInRange: inRange,
            ),
            const SizedBox(height: 12),

            // ── 지도 ──────────────────────────────
            _LocationMapCard(
              lat: _lat,
              lon: _lon,
              loading: _loading,
              error: _error,
              safeZones: _safeZones,
              mapController: _mapController,
              onRecenter: _lat != null
                  ? () => _mapController.move(LatLng(_lat!, _lon!), 15)
                  : null,
            ),
            const SizedBox(height: 12),

            // ── GPS 상세 정보 ─────────────────────
            _LocationInfoCard(
              lat: _lat,
              lon: _lon,
              address: _address,
              lastUpdate: _lastUpdate,
              isInRange: inRange,
              loading: _loading,
              onRefresh: _loading ? null : _getLocation,
            ),
            const SizedBox(height: 12),

            // ── 안전반경 거리 ─────────────────────
            if (nearest != null) ...[
              _DistanceCard(
                nearestName: nearestName,
                distance: nearest.distance,
                radius: nearestRadius,
                isInRange: inRange,
              ),
              const SizedBox(height: 12),
            ],

            // ── 모든 안전반경 목록 ─────────────────
            if (zd.length > 1) ...[
              _SafeZoneListCard(zones: zd),
              const SizedBox(height: 12),
            ],

            // ── 이동 이력 ─────────────────────────
            _HistoryCard(
              selectedDate: _selectedDate,
              history: _history,
              loading: _historyLoading,
              onPickDate: _pickDate,
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  위치 상태 카드 (상단 배지)
// ─────────────────────────────────────────────
class _LocationStatusCard extends StatelessWidget {
  const _LocationStatusCard({
    required this.loading,
    required this.error,
    required this.address,
    required this.lastUpdate,
    required this.isInRange,
  });

  final bool loading;
  final String? error;
  final String address;
  final String lastUpdate;
  final bool isInRange;

  @override
  Widget build(BuildContext context) {
    final safeColor =
        isInRange ? const Color(0xFF86A788) : const Color(0xFFD94E4E);
    final safeBg =
        isInRange ? const Color(0xFFEEF6EF) : const Color(0xFFFDF0F0);
    final hasError = !loading && error != null;

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
      child: Row(
        children: [
          // 상태 도트
          Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: safeColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
              ),
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: safeColor,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.location_on, size: 14, color: Colors.white),
              ),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '마지막 업데이트 $lastUpdate',
                  style: const TextStyle(
                    color: Color(0xFF6D766A),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  loading
                      ? '위치 불러오는 중...'
                      : hasError
                          ? '위치를 불러올 수 없습니다'
                          : address,
                  style: const TextStyle(
                    color: Color(0xFF1F2A20),
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: safeBg,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              isInRange ? '안전 반경 내' : '반경 이탈',
              style: TextStyle(
                color: safeColor,
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  지도 카드
// ─────────────────────────────────────────────
class _LocationMapCard extends StatelessWidget {
  const _LocationMapCard({
    required this.lat,
    required this.lon,
    required this.loading,
    required this.error,
    required this.safeZones,
    required this.mapController,
    this.onRecenter,
  });

  final double? lat;
  final double? lon;
  final bool loading;
  final String? error;
  final List<Map<String, dynamic>> safeZones;
  final MapController mapController;
  final VoidCallback? onRecenter;

  @override
  Widget build(BuildContext context) {
    final mapLat = lat ?? _defaultLat;
    final mapLon = lon ?? _defaultLon;

    return Container(
      height: 280,
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
      clipBehavior: Clip.hardEdge,
      child: Stack(
        children: [
          if (loading)
            const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 12),
                  Text(
                    '위치 불러오는 중...',
                    style: TextStyle(color: Color(0xFF6D766A), fontSize: 14),
                  ),
                ],
              ),
            )
          else if (error != null)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('⚠️', style: TextStyle(fontSize: 36)),
                    const SizedBox(height: 8),
                    Text(
                      error!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFD94E4E),
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            FlutterMap(
              mapController: mapController,
              options: MapOptions(
                initialCenter: LatLng(mapLat, mapLon),
                initialZoom: 15,
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.woori.senior_app',
                ),
                // 안전반경 원형 표시
                CircleLayer(
                  circles: safeZones
                      .map((zone) => CircleMarker(
                            point: LatLng(
                              (zone['centerLatitude'] as num?)?.toDouble() ??
                                  _defaultLat,
                              (zone['centerLongitude'] as num?)?.toDouble() ??
                                  _defaultLon,
                            ),
                            radius:
                                (zone['radiusMeters'] as num?)?.toDouble() ??
                                    _defaultRadius.toDouble(),
                            useRadiusInMeter: true,
                            color: const Color(0x1F86A788),
                            borderColor: const Color(0xFF86A788),
                            borderStrokeWidth: 2,
                          ))
                      .toList(),
                ),
                // 안전반경 중심 마커
                MarkerLayer(
                  markers: safeZones.map((zone) {
                    final zLat =
                        (zone['centerLatitude'] as num?)?.toDouble() ??
                            _defaultLat;
                    final zLon =
                        (zone['centerLongitude'] as num?)?.toDouble() ??
                            _defaultLon;
                    return Marker(
                      point: LatLng(zLat, zLon),
                      width: 32,
                      height: 32,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Color(0xFF86A788),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.home,
                          color: Colors.white,
                          size: 18,
                        ),
                      ),
                    );
                  }).toList(),
                ),
                // 현재 위치 마커
                if (lat != null && lon != null)
                  MarkerLayer(
                    markers: [
                      Marker(
                        point: LatLng(lat!, lon!),
                        width: 44,
                        height: 44,
                        child: Container(
                          decoration: const BoxDecoration(
                            color: Color(0xFFD94E4E),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.person,
                            color: Colors.white,
                            size: 22,
                          ),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          // 내 위치로 버튼
          if (!loading && error == null && onRecenter != null)
            Positioned(
              right: 10,
              bottom: 10,
              child: Material(
                color: Colors.white,
                elevation: 3,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: onRecenter,
                  child: const Padding(
                    padding: EdgeInsets.all(8),
                    child: Icon(
                      Icons.my_location,
                      color: Color(0xFF86A788),
                      size: 22,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  GPS 상세 정보 카드
// ─────────────────────────────────────────────
class _LocationInfoCard extends StatelessWidget {
  const _LocationInfoCard({
    required this.lat,
    required this.lon,
    required this.address,
    required this.lastUpdate,
    required this.isInRange,
    required this.loading,
    this.onRefresh,
  });

  final double? lat;
  final double? lon;
  final String address;
  final String lastUpdate;
  final bool isInRange;
  final bool loading;
  final VoidCallback? onRefresh;

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
          Row(
            children: [
              const Text(
                '위치 정보',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1F2A20),
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: onRefresh,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F5E8),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.refresh,
                        size: 14,
                        color: onRefresh == null
                            ? const Color(0xFFBBBBBB)
                            : const Color(0xFF86A788),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '새로고침',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: onRefresh == null
                              ? const Color(0xFFBBBBBB)
                              : const Color(0xFF86A788),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _InfoRow(
            icon: Icons.access_time,
            label: '마지막 갱신',
            value: lastUpdate,
          ),
          _InfoRow(
            icon: Icons.location_on,
            label: '현재 주소',
            value: loading ? '불러오는 중...' : address,
          ),
          if (lat != null && lon != null) ...[
            _InfoRow(
              icon: Icons.gps_fixed,
              label: '위도',
              value: lat!.toStringAsFixed(6),
            ),
            _InfoRow(
              icon: Icons.gps_fixed,
              label: '경도',
              value: lon!.toStringAsFixed(6),
            ),
          ],
          _InfoRow(
            icon: Icons.shield_outlined,
            label: '안전 상태',
            value: isInRange ? '반경 내 안전' : '반경 이탈',
            valueColor:
                isInRange ? const Color(0xFF86A788) : const Color(0xFFD94E4E),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor = const Color(0xFF1F2A20),
  });

  final IconData icon;
  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Icon(icon, size: 14, color: const Color(0xFF86A788)),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF6D766A),
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
          ),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                color: valueColor,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  안전반경 거리 카드 (가장 가까운 것)
// ─────────────────────────────────────────────
class _DistanceCard extends StatelessWidget {
  const _DistanceCard({
    required this.nearestName,
    required this.distance,
    required this.radius,
    required this.isInRange,
  });

  final String nearestName;
  final int distance;
  final int radius;
  final bool isInRange;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: isInRange ? const Color(0xFFEEF6EF) : const Color(0xFFFDF0F0),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isInRange
              ? const Color(0xFFB8D4BA)
              : const Color(0xFFF5C6C6),
        ),
      ),
      child: Row(
        children: [
          Flexible(
            child: Text(
              '🏠 $nearestName까지',
              style: TextStyle(
                fontSize: 14,
                color: isInRange
                    ? const Color(0xFF7A9A7C)
                    : const Color(0xFFD94E4E),
                fontWeight: FontWeight.w700,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${distance}m',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: isInRange
                  ? const Color(0xFF5F7D61)
                  : const Color(0xFFD94E4E),
            ),
          ),
          const SizedBox(width: 4),
          Flexible(
            child: Text(
              isInRange ? '(${radius}m 내)' : '(${radius}m 초과)',
              style: const TextStyle(
                fontSize: 12,
                color: Color(0xFF6D766A),
                fontWeight: FontWeight.w600,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  전체 안전반경 목록 카드
// ─────────────────────────────────────────────
class _SafeZoneListCard extends StatelessWidget {
  const _SafeZoneListCard({required this.zones});

  final List<({Map<String, dynamic> zone, int distance})> zones;

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
            '안전 장소 목록',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: Color(0xFF1F2A20),
            ),
          ),
          const SizedBox(height: 12),
          ...zones.map((e) {
            final radius =
                (e.zone['radiusMeters'] as num?)?.toInt() ?? _defaultRadius;
            final inRange = e.distance <= radius;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: inRange
                          ? const Color(0xFF86A788)
                          : const Color(0xFFD94E4E),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '${e.zone['name'] ?? '안전 장소'}',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1F2A20),
                      ),
                    ),
                  ),
                  Text(
                    '${e.distance}m',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      color: inRange
                          ? const Color(0xFF86A788)
                          : const Color(0xFFD94E4E),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '/ ${radius}m',
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6D766A),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────
//  이동 이력 카드
// ─────────────────────────────────────────────
class _HistoryCard extends StatelessWidget {
  const _HistoryCard({
    required this.selectedDate,
    required this.history,
    required this.loading,
    required this.onPickDate,
  });

  final String selectedDate;
  final List<Map<String, dynamic>> history;
  final bool loading;
  final VoidCallback onPickDate;

  @override
  Widget build(BuildContext context) {
    final isToday = selectedDate == _todayStr();

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
          Row(
            children: [
              const Text(
                '이동 이력',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF1F2A20),
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: onPickDate,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF7F5E8),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFD4E8D6)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.calendar_month_outlined,
                        size: 14,
                        color: Color(0xFF6D766A),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        selectedDate,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1F2A20),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          if (loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(),
              ),
            )
          else if (history.isEmpty)
            Text(
              isToday ? '오늘 이동 이력이 없습니다.' : '해당 날짜 이동 이력이 없습니다.',
              style: const TextStyle(
                color: Color(0xFF6D766A),
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            )
          else
            ...history.map(
              (item) => _HistoryRow(
                time: item['time'] as String? ?? '--:--',
                place: item['place'] as String? ?? '현재 위치',
              ),
            ),
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.time, required this.place});

  final String time;
  final String place;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          SizedBox(
            width: 50,
            child: Text(
              time,
              style: const TextStyle(
                color: Color(0xFF48624B),
                fontSize: 13,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: Color(0xFF86A788),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              place,
              style: const TextStyle(
                color: Color(0xFF1F2A20),
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
