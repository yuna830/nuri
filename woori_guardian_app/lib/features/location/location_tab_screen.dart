import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:kakao_map_sdk/kakao_map_sdk.dart' as kakao;
import '../../core/api/guardian_api.dart';
import '../../core/models/safe_zone.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';

const _disableKakaoMap = bool.fromEnvironment('DISABLE_KAKAO_MAP');

// ── 색상 ─────────────────────────────────────────────────────────────────
const _kGreen = Color(0xFF86A788);
const _kSafe = Color(0xFF4A7A4C);
const _kSafeBg = Color(0xFFEEF5EE);
const _kWarn = Color(0xFFFF9500);
const _kWarnBg = Color(0xFFFFF4E5);
const _kTextMain = Color(0xFF1C1C1E);
const _kTextSub = Color(0xFF6C6C70);
const _kTextHint = Color(0xFFAEAEB2);
const _kDivider = Color(0xFFE5E5EA);

const double _defaultLat = 37.5665;
const double _defaultLng = 126.9780;
const int _kMaxZones = 3;
const Color _kZoneColor = Color(0xFF4A7A4C);

String _radiusLabel(num m) => m >= 1000
    ? '${(m / 1000).toStringAsFixed(0)}km'
    : '${m.toStringAsFixed(0)}m';

// ── 중심 위치 선택 모드 ────────────────────────────────────────────────────────
enum _CenterMode { none, senior, address }

// ── Nominatim 검색 결과 ────────────────────────────────────────────────────────
class _NominatimResult {
  final String displayName;
  final double lat;
  final double lng;
  const _NominatimResult({
    required this.displayName,
    required this.lat,
    required this.lng,
  });
}

Future<List<_NominatimResult>> _searchNominatim(String query) async {
  final url = Uri.parse(
    'https://nominatim.openstreetmap.org/search'
    '?q=${Uri.encodeComponent(query)}&format=json&limit=5&accept-language=ko',
  );
  try {
    final res = await http
        .get(url, headers: {'User-Agent': 'woori_guardian_app'})
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return [];
    final list = jsonDecode(res.body) as List<dynamic>;
    return list
        .map(
          (j) => _NominatimResult(
            displayName: j['display_name'] as String? ?? '',
            lat: double.tryParse(j['lat'] as String? ?? '') ?? 0,
            lng: double.tryParse(j['lon'] as String? ?? '') ?? 0,
          ),
        )
        .where((r) => r.lat != 0 && r.lng != 0)
        .toList();
  } catch (_) {
    return [];
  }
}

// ── 지도에서 위치 선택 화면 ────────────────────────────────────────────────────
class _MapPickScreen extends StatefulWidget {
  final kakao.LatLng initial;
  const _MapPickScreen({required this.initial});

  @override
  State<_MapPickScreen> createState() => _MapPickScreenState();
}

class _MapPickScreenState extends State<_MapPickScreen> {
  late kakao.LatLng _picked;
  kakao.KakaoMapController? _controller;
  kakao.Poi? _pickedPoi;

  @override
  void initState() {
    super.initState();
    _picked = widget.initial;
  }

  Future<void> _renderPickedPoi() async {
    final controller = _controller;
    if (controller == null) return;
    if (_pickedPoi != null) {
      await _pickedPoi!.remove();
      _pickedPoi = null;
    }
    _pickedPoi = await controller.labelLayer.addPoi(
      _picked,
      style: kakao.PoiStyle(),
    );
  }

  Future<void> _setPicked(kakao.LatLng position) async {
    setState(() => _picked = position);
    await _renderPickedPoi();
  }

  @override
  Widget build(BuildContext context) {
    if (_disableKakaoMap) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('위치 선택'),
          backgroundColor: _kGreen,
          foregroundColor: Colors.white,
        ),
        body: const _KakaoMapDisabledView(),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('위치 선택'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, _picked),
            child: const Text(
              '확인',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
      body: Stack(
        children: [
          kakao.KakaoMap(
            option: kakao.KakaoMapOption(position: _picked, zoomLevel: 15),
            onMapReady: (controller) {
              _controller = controller;
              _renderPickedPoi();
            },
            onMapClick: (_, position) => _setPicked(position),
          ),
          Positioned(
            bottom: 16,
            left: 16,
            right: 16,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(color: Colors.black12, blurRadius: 6),
                ],
              ),
              child: Text(
                '지도를 탭하여 위치를 선택하세요\n'
                '${_picked.latitude.toStringAsFixed(5)}, '
                '${_picked.longitude.toStringAsFixed(5)}',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  color: _kTextSub,
                  height: 1.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── 메인 화면 ─────────────────────────────────────────────────────────────────

class LocationTabScreen extends StatefulWidget {
  final int? initialSeniorId;
  const LocationTabScreen({super.key, this.initialSeniorId});

  @override
  State<LocationTabScreen> createState() => _LocationTabScreenState();
}

class _LocationTabScreenState extends State<LocationTabScreen> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();
  final _sheetController = DraggableScrollableController();
  kakao.KakaoMapController? _mapController;
  kakao.Poi? _seniorPoi;
  final List<kakao.Polygon> _zonePolygons = [];

  List<Senior> _seniors = [];
  bool _seniorsLoading = true;
  Senior? _selectedSenior;

  bool _locationLoading = false;
  String? _locationError;
  String _address = '-';
  String _time = '-';
  double? _latitude;
  double? _longitude;

  List<SafeZone> _zones = [];
  bool _zonesLoading = false;
  String? _zonesError;

  List<Map<String, dynamic>> _routeHistory = [];
  bool _routeHistoryLoading = false;
  String? _routeHistoryError;
  DateTime _routeHistoryDate = DateTime.now();

  // ── 생명주기 ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _loadSeniors();
  }

  @override
  void didUpdateWidget(LocationTabScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialSeniorId != oldWidget.initialSeniorId &&
        widget.initialSeniorId != null &&
        _seniors.isNotEmpty) {
      _selectSeniorById(widget.initialSeniorId!);
    }
  }

  @override
  void dispose() {
    _sheetController.dispose();
    super.dispose();
  }

  // ── 데이터 로드 ───────────────────────────────────────────────────────────

  Future<void> _loadSeniors() async {
    try {
      final userInfo = await _sessionStorage.getGuardianInfo();
      final guardianIdStr = userInfo['guardianId'];
      if (guardianIdStr == null || guardianIdStr.isEmpty) return;

      final seniors = await _api.fetchGuardianSeniors(int.parse(guardianIdStr));
      if (!mounted) return;

      setState(() {
        _seniors = seniors;
        _seniorsLoading = false;
      });
      if (seniors.isEmpty) return;

      final targetId = widget.initialSeniorId;
      if (targetId != null && seniors.any((s) => s.id == targetId)) {
        _selectSeniorById(targetId);
      } else {
        _selectSenior(seniors.first);
      }
    } catch (_) {
      if (mounted) setState(() => _seniorsLoading = false);
    }
  }

  void _selectSeniorById(int id) {
    final match = _seniors.where((s) => s.id == id);
    _selectSenior(match.isNotEmpty ? match.first : _seniors.first);
  }

  Future<void> _selectSenior(Senior senior) async {
    setState(() {
      _selectedSenior = senior;
      _locationLoading = true;
      _locationError = null;
      _address = '-';
      _time = '-';
      _latitude = null;
      _longitude = null;
      _zones = [];
      _zonesError = null;
      _routeHistory = [];
      _routeHistoryError = null;
      _routeHistoryDate = DateTime.now();
    });

    await Future.wait([
      _fetchLocation(senior),
      _fetchZones(senior.id),
      _fetchRouteHistory(senior.id, _routeHistoryDate),
    ]);
  }

  Future<void> _fetchLocation(Senior senior) async {
    try {
      final data = await _api.fetchLatestLocation(senior.id);
      if (!mounted) return;

      final rawTime = data['receivedAt']?.toString() ?? '-';
      final timeStr = rawTime.length > 16
          ? rawTime.substring(0, 16).replaceAll('T', ' ')
          : rawTime.replaceAll('T', ' ');

      final lat = (data['latitude'] as num?)?.toDouble();
      final lng = (data['longitude'] as num?)?.toDouble();

      setState(() {
        _address = data['address'] ?? data['roadAddress'] ?? '주소 정보 없음';
        _time = timeStr;
        _latitude = lat;
        _longitude = lng;
        _locationLoading = false;
      });

      if (lat != null && lng != null) {
        await _moveMap(lat, lng);
      }
      await _syncMapOverlays();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _locationError = e.toString().replaceAll('Exception: ', '');
        _locationLoading = false;
      });
    }
  }

  Future<void> _fetchZones(int seniorId) async {
    setState(() {
      _zonesLoading = true;
      _zonesError = null;
    });
    try {
      final zones = await _api.fetchSafeZones(seniorId);
      if (!mounted) return;
      setState(() {
        _zones = zones;
        _zonesLoading = false;
      });
      await _syncMapOverlays();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _zonesError = e.toString().replaceAll('Exception: ', '');
        _zonesLoading = false;
      });
    }
  }

  Future<void> _fetchRouteHistory(int seniorId, DateTime date) async {
    setState(() {
      _routeHistoryLoading = true;
      _routeHistoryError = null;
    });
    try {
      final history = await _api.fetchLocationHistoryByDate(seniorId, date);
      if (!mounted) return;
      setState(() {
        _routeHistory = history;
        _routeHistoryDate = date;
        _routeHistoryLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _routeHistoryError = e.toString().replaceAll('Exception: ', '');
        _routeHistoryLoading = false;
      });
    }
  }

  Future<void> _pickRouteHistoryDate() async {
    final senior = _selectedSenior;
    if (senior == null) return;

    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _routeHistoryDate,
      firstDate: DateTime(now.year - 2, 1, 1),
      lastDate: now,
      helpText: '',
      cancelText: '취소',
      confirmText: '적용',
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(
              context,
            ).colorScheme.copyWith(primary: _kGreen, onPrimary: Colors.white),
          ),
          child: Center(child: Transform.scale(scale: 0.74, child: child!)),
        );
      },
    );
    if (picked == null) return;

    await _fetchRouteHistory(senior.id, picked);
  }

  Future<void> _moveMap(double lat, double lng) async {
    final controller = _mapController;
    if (controller == null) return;
    await controller.moveCamera(
      kakao.CameraUpdate.newCenterPosition(
        kakao.LatLng(lat, lng),
        zoomLevel: 15,
      ),
    );
  }

  Future<void> _clearMapOverlays() async {
    if (_seniorPoi != null) {
      try {
        await _seniorPoi!.remove();
      } on PlatformException catch (e) {
        debugPrint('[KAKAO] senior poi remove ignored: ${e.message ?? e.code}');
      } catch (e) {
        debugPrint('[KAKAO] senior poi remove ignored: $e');
      }
      _seniorPoi = null;
    }

    final polygons = List<kakao.Polygon>.from(_zonePolygons);
    _zonePolygons.clear();

    for (final polygon in polygons) {
      try {
        await polygon.remove();
      } on PlatformException catch (e) {
        debugPrint('[KAKAO] polygon remove ignored: ${e.message ?? e.code}');
      } catch (e) {
        debugPrint('[KAKAO] polygon remove ignored: $e');
      }
    }
  }

  List<kakao.LatLng> _buildCirclePoints(
    double centerLat,
    double centerLng,
    double radiusMeters, {
    int segments = 72,
  }) {
    const earthRadius = 6378137.0;
    final latRad = centerLat * math.pi / 180.0;
    final points = <kakao.LatLng>[];

    for (int i = 0; i <= segments; i++) {
      final angle = 2 * math.pi * i / segments;
      final latOffset = (radiusMeters * math.cos(angle)) / earthRadius;
      final lngOffset =
          (radiusMeters * math.sin(angle)) / (earthRadius * math.cos(latRad));

      final lat = centerLat + latOffset * 180.0 / math.pi;
      final lng = centerLng + lngOffset * 180.0 / math.pi;

      points.add(kakao.LatLng(lat, lng));
    }

    return points;
  }

  Future<void> _syncMapOverlays() async {
    final controller = _mapController;
    if (controller == null || !mounted) return;

    await _clearMapOverlays();

    if (_latitude != null && _longitude != null) {
      _seniorPoi = await controller.labelLayer.addPoi(
        kakao.LatLng(_latitude!, _longitude!),
        style: kakao.PoiStyle(),
      );
    }

    for (final zone in _zones) {
      final points = _buildCirclePoints(
        zone.centerLatitude,
        zone.centerLongitude,
        zone.radiusMeters.toDouble(),
      );

      final polygon = await controller.shapeLayer.addPolygonShape(
        kakao.MapPoint(points),
        kakao.PolygonStyle(
          _kZoneColor.withValues(alpha: 0.15),
          strokeWidth: 2,
          strokeColor: _kZoneColor,
        ),
      );

      _zonePolygons.add(polygon);
    }
  }

  Future<void> _refresh() async {
    if (_selectedSenior != null) await _selectSenior(_selectedSenior!);
  }

  // ── 안전 구역 CRUD ────────────────────────────────────────────────────────

  void _onAddZone() {
    if (_selectedSenior == null) return;
    if (_zones.length >= _kMaxZones) return;
    _showZoneEditor(null);
  }

  void _onEditZone(SafeZone zone) => _showZoneEditor(zone);

  Future<void> _onDeleteZone(SafeZone zone) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        titlePadding: const EdgeInsets.fromLTRB(24, 24, 24, 8),
        contentPadding: const EdgeInsets.fromLTRB(24, 0, 24, 16),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
        title: const Text(
          '구역 삭제',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w700,
            color: _kTextMain,
          ),
        ),
        content: Text(
          '"${zone.name}" 구역을 삭제할까요?',
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 14, color: _kTextSub),
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text(
              '취소',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: _kSafe,
              ),
            ),
          ),
          const SizedBox(width: 8),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              '삭제',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: const Color(0xFFB85252),
              ),
            ),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    try {
      await _api.deleteSafeZone(_selectedSenior!.id, zone.id);
      if (!mounted) return;
      setState(() => _zones.removeWhere((z) => z.id == zone.id));
      await _syncMapOverlays();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  // ── 안전 구역 편집 BottomSheet ─────────────────────────────────────────────

  void _showZoneEditor(SafeZone? existing) {
    final outerContext = context;
    final isNew = existing == null;
    final nameCtrl = TextEditingController(text: existing?.name ?? '');
    final searchCtrl = TextEditingController();

    final defaultLat = _latitude ?? _defaultLat;
    final defaultLng = _longitude ?? _defaultLng;

    double centerLat = existing?.centerLatitude ?? defaultLat;
    double centerLng = existing?.centerLongitude ?? defaultLng;
    String centerAddr = existing?.address ?? '';
    double radius = existing?.radiusMeters.toDouble() ?? 300.0;

    _CenterMode centerMode = _CenterMode.none;
    bool saving = false;
    bool searchLoading = false;
    List<_NominatimResult> searchResults = [];
    Timer? searchDebounce;

    showModalBottomSheet(
      context: outerContext,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setLocal) {
            // ── 중심 위치 선택 칩 ────────────────────────────────────────────
            Widget centerPickRow() => Row(
              children: [
                _CenterChip(
                  icon: Icons.map_outlined,
                  label: '지도에서 선택',
                  selected: false,
                  onTap: () async {
                    final picked = await Navigator.push<kakao.LatLng>(
                      outerContext,
                      MaterialPageRoute(
                        builder: (_) => _MapPickScreen(
                          initial: kakao.LatLng(centerLat, centerLng),
                        ),
                      ),
                    );
                    if (picked != null) {
                      setLocal(() {
                        centerLat = picked.latitude;
                        centerLng = picked.longitude;
                        centerMode = _CenterMode.none;
                      });
                    }
                  },
                ),
                const SizedBox(width: 8),
                _CenterChip(
                  icon: Icons.person_pin_circle_outlined,
                  label: '현재 어르신 위치',
                  selected: centerMode == _CenterMode.senior,
                  onTap: () {
                    if (_latitude == null || _longitude == null) {
                      ScaffoldMessenger.of(outerContext).showSnackBar(
                        const SnackBar(content: Text('어르신의 현재 위치 정보가 없습니다.')),
                      );
                      return;
                    }
                    setLocal(() {
                      centerLat = _latitude!;
                      centerLng = _longitude!;
                      centerAddr = _address != '-' ? _address : centerAddr;
                      centerMode = _CenterMode.senior;
                    });
                  },
                ),
                const SizedBox(width: 8),
                _CenterChip(
                  icon: Icons.search,
                  label: '주소 검색',
                  selected: centerMode == _CenterMode.address,
                  onTap: () => setLocal(() {
                    centerMode = centerMode == _CenterMode.address
                        ? _CenterMode.none
                        : _CenterMode.address;
                    if (centerMode != _CenterMode.address) {
                      searchResults = [];
                      searchCtrl.clear();
                    }
                  }),
                ),
              ],
            );

            // ── 주소 검색 UI ─────────────────────────────────────────────────
            Widget addressSearchSection() => Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 8),
                TextField(
                  controller: searchCtrl,
                  decoration: InputDecoration(
                    hintText: '주소를 입력하세요',
                    hintStyle: const TextStyle(color: _kTextHint, fontSize: 13),
                    prefixIcon: const Icon(
                      Icons.search,
                      size: 18,
                      color: _kTextHint,
                    ),
                    suffixIcon: searchLoading
                        ? const Padding(
                            padding: EdgeInsets.all(12),
                            child: SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: _kGreen,
                              ),
                            ),
                          )
                        : null,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: _kDivider),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: _kGreen),
                    ),
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                  ),
                  onChanged: (v) {
                    searchDebounce?.cancel();
                    if (v.trim().length < 2) {
                      setLocal(() => searchResults = []);
                      return;
                    }
                    searchDebounce = Timer(
                      const Duration(milliseconds: 500),
                      () async {
                        setLocal(() => searchLoading = true);
                        final results = await _searchNominatim(v.trim());
                        if (ctx.mounted) {
                          setLocal(() {
                            searchResults = results;
                            searchLoading = false;
                          });
                        }
                      },
                    );
                  },
                ),
                if (searchResults.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: _kDivider),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        for (var i = 0; i < searchResults.length; i++) ...[
                          if (i > 0) const Divider(height: 1, color: _kDivider),
                          InkWell(
                            onTap: () => setLocal(() {
                              centerLat = searchResults[i].lat;
                              centerLng = searchResults[i].lng;
                              centerAddr = searchResults[i].displayName;
                              centerMode = _CenterMode.none;
                              searchResults = [];
                              searchCtrl.clear();
                            }),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              child: Text(
                                searchResults[i].displayName,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: _kTextMain,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            );

            // ── 현재 중심 좌표 표시 ─────────────────────────────────────────
            Widget centerDisplay() => Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: _kSafeBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kGreen.withValues(alpha: 0.3)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.location_on_outlined,
                    size: 14,
                    color: _kSafe,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      centerAddr.isNotEmpty
                          ? '$centerAddr\n'
                                '(${centerLat.toStringAsFixed(5)}, '
                                '${centerLng.toStringAsFixed(5)})'
                          : '${centerLat.toStringAsFixed(5)}, '
                                '${centerLng.toStringAsFixed(5)}',
                      style: const TextStyle(
                        fontSize: 11,
                        color: _kSafe,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            );

            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: SafeArea(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // 핸들
                      Center(
                        child: Container(
                          width: 36,
                          height: 4,
                          decoration: BoxDecoration(
                            color: _kDivider,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        isNew ? '안전 구역 추가' : '안전 구역 수정',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                          color: _kTextMain,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // 구역 이름
                      _inputField(nameCtrl, '구역 이름 (예: 집, 병원)'),
                      const SizedBox(height: 16),

                      // 중심 위치 섹션
                      const Text(
                        '중심 위치',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: _kTextSub,
                        ),
                      ),
                      const SizedBox(height: 8),
                      centerPickRow(),
                      const SizedBox(height: 8),
                      centerDisplay(),
                      if (centerMode == _CenterMode.address)
                        addressSearchSection(),
                      const SizedBox(height: 16),

                      // 반경
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            '반경',
                            style: TextStyle(fontSize: 13, color: _kTextSub),
                          ),
                          Text(
                            _radiusLabel(radius),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: _kSafe,
                            ),
                          ),
                        ],
                      ),
                      SliderTheme(
                        data: SliderThemeData(
                          activeTrackColor: _kGreen,
                          inactiveTrackColor: _kDivider,
                          thumbColor: _kGreen,
                          overlayColor: _kGreen.withValues(alpha: 0.12),
                          trackHeight: 4,
                        ),
                        child: Slider(
                          min: 100,
                          max: 1000,
                          divisions: 18,
                          value: radius,
                          onChanged: (v) => setLocal(() => radius = v),
                        ),
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: const [
                          Text(
                            '100m',
                            style: TextStyle(fontSize: 11, color: _kTextHint),
                          ),
                          Text(
                            '1km',
                            style: TextStyle(fontSize: 11, color: _kTextHint),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),

                      // 저장 버튼
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _kGreen,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: saving
                              ? null
                              : () async {
                                  final name = nameCtrl.text.trim();
                                  if (name.isEmpty) return;
                                  setLocal(() => saving = true);

                                  try {
                                    final draft = SafeZone(
                                      id: existing?.id ?? 0,
                                      name: name,
                                      address: centerAddr,
                                      centerLatitude: centerLat,
                                      centerLongitude: centerLng,
                                      radiusMeters: radius.toInt(),
                                    );
                                    if (isNew) {
                                      final created = await _api.createSafeZone(
                                        _selectedSenior!.id,
                                        draft,
                                      );
                                      if (mounted) {
                                        setState(() => _zones.add(created));
                                        await _syncMapOverlays();
                                      }
                                    } else {
                                      final updated = await _api.updateSafeZone(
                                        _selectedSenior!.id,
                                        existing!.id,
                                        draft,
                                      );
                                      if (mounted) {
                                        setState(() {
                                          final idx = _zones.indexWhere(
                                            (z) => z.id == existing.id,
                                          );
                                          if (idx >= 0) _zones[idx] = updated;
                                        });
                                        await _syncMapOverlays();
                                      }
                                    }
                                    if (ctx.mounted) Navigator.pop(ctx);
                                  } catch (e) {
                                    setLocal(() => saving = false);
                                    if (ctx.mounted) {
                                      ScaffoldMessenger.of(ctx).showSnackBar(
                                        SnackBar(
                                          content: Text(
                                            e.toString().replaceAll(
                                              'Exception: ',
                                              '',
                                            ),
                                          ),
                                        ),
                                      );
                                    }
                                  }
                                },
                          child: saving
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Text(isNew ? '추가' : '저장'),
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
    searchDebounce?.cancel();
  }

  static Widget _inputField(TextEditingController ctrl, String label) =>
      TextField(
        controller: ctrl,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: _kTextSub),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _kDivider),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: _kGreen),
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 12,
          ),
        ),
      );

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) => _buildMapWithSheet();

  Widget _buildFloatingChips() {
    if (_seniorsLoading) {
      return Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.10),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: const Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2, color: _kGreen),
          ),
        ),
      );
    }
    if (_seniors.isEmpty) return const SizedBox.shrink();

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (int i = 0; i < _seniors.length; i++) ...[
            if (i > 0) const SizedBox(width: 6),
            _FloatingChip(
              label: _seniors[i].name,
              selected: _selectedSenior?.id == _seniors[i].id,
              onTap: () => _selectSenior(_seniors[i]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMapWithSheet() {
    if (_disableKakaoMap) {
      return const _KakaoMapDisabledView();
    }

    final centerLat = _latitude ?? _defaultLat;
    final centerLng = _longitude ?? _defaultLng;
    final hasLocation = _latitude != null && _longitude != null;

    return Stack(
      children: [
        Positioned.fill(
          child: kakao.KakaoMap(
            option: kakao.KakaoMapOption(
              position: kakao.LatLng(centerLat, centerLng),
              zoomLevel: 15,
            ),
            onMapReady: (controller) async {
              // debugPrint('[KAKAO] map ready');
              _mapController = controller;
              if (hasLocation) {
                await _moveMap(centerLat, centerLng);
              }
              await _syncMapOverlays();
            },
          ),
        ),

        // ── 사용자 선택 floating chip ──────────────────────────────
        Positioned(top: 10, left: 10, right: 56, child: _buildFloatingChips()),

        if (hasLocation)
          const Center(
            child: Padding(
              padding: EdgeInsets.only(bottom: 36),
              child: Icon(
                Icons.location_pin,
                size: 52,
                color: Color(0xFF4A90E2),
              ),
            ),
          ),
          
        if (_locationLoading)
          const Positioned.fill(
            child: ColoredBox(
              color: Color(0xCCEEF5EE),
              child: Center(child: CircularProgressIndicator(color: _kGreen)),
            ),
          ),

        if (!_locationLoading && _selectedSenior != null)
          Positioned(
            top: 10,
            right: 10,
            child: GestureDetector(
              onTap: _refresh,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.12),
                      blurRadius: 6,
                    ),
                  ],
                ),
                child: const Icon(Icons.refresh, size: 18, color: _kTextSub),
              ),
            ),
          ),

        DraggableScrollableSheet(
          controller: _sheetController,
          initialChildSize: 0.30,
          minChildSize: 0.12,
          maxChildSize: 0.80,
          snap: true,
          snapSizes: const [0.12, 0.30, 0.80],
          builder: (context, scrollController) {
            return _SheetContent(
              scrollController: scrollController,
              senior: _selectedSenior,
              locationLoading: _locationLoading,
              locationError: _locationError,
              address: _address,
              time: _time,
              latitude: _latitude,
              longitude: _longitude,
              zones: _zones,
              zonesLoading: _zonesLoading,
              zonesError: _zonesError,
              routeHistory: _routeHistory,
              routeHistoryLoading: _routeHistoryLoading,
              routeHistoryError: _routeHistoryError,
              routeHistoryDate: _routeHistoryDate,
              onPickRouteHistoryDate: _pickRouteHistoryDate,
              onAddZone: _onAddZone,
              onEditZone: _onEditZone,
              onDeleteZone: _onDeleteZone,
            );
          },
        ),
      ],
    );
  }
}

// ── 지도 위 사용자 선택 chip ───────────────────────────────────────────────────

class _FloatingChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _FloatingChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? _kGreen : Colors.white.withValues(alpha: 0.95),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: selected ? _kGreen : const Color(0xFFD0D8D0),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: selected ? 0.12 : 0.08),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
            color: selected ? Colors.white : _kTextMain,
          ),
        ),
      ),
    );
  }
}

// ── 중심 위치 선택 칩 ──────────────────────────────────────────────────────────

class _CenterChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _CenterChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 6),
          decoration: BoxDecoration(
            color: selected ? _kSafeBg : Colors.white,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected ? _kGreen : _kDivider,
              width: 1.2,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18, color: selected ? _kSafe : _kTextSub),
              const SizedBox(height: 4),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                  color: selected ? _kSafe : _kTextSub,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── BottomSheet 내용 ──────────────────────────────────────────────────────────

class _SheetContent extends StatelessWidget {
  final ScrollController scrollController;
  final Senior? senior;
  final bool locationLoading;
  final String? locationError;
  final String address;
  final String time;
  final double? latitude;
  final double? longitude;
  final List<SafeZone> zones;
  final bool zonesLoading;
  final String? zonesError;
  final List<Map<String, dynamic>> routeHistory;
  final bool routeHistoryLoading;
  final String? routeHistoryError;
  final DateTime routeHistoryDate;
  final VoidCallback onPickRouteHistoryDate;
  final VoidCallback onAddZone;
  final void Function(SafeZone) onEditZone;
  final void Function(SafeZone) onDeleteZone;

  const _SheetContent({
    required this.scrollController,
    required this.senior,
    required this.locationLoading,
    required this.locationError,
    required this.address,
    required this.time,
    required this.latitude,
    required this.longitude,
    required this.zones,
    required this.zonesLoading,
    required this.zonesError,
    required this.routeHistory,
    required this.routeHistoryLoading,
    required this.routeHistoryError,
    required this.routeHistoryDate,
    required this.onPickRouteHistoryDate,
    required this.onAddZone,
    required this.onEditZone,
    required this.onDeleteZone,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 10,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: CustomScrollView(
        controller: scrollController,
        slivers: [
          SliverToBoxAdapter(child: _handle()),
          SliverToBoxAdapter(child: _body(context)),
        ],
      ),
    );
  }

  Widget _handle() => Center(
    child: Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 6),
      child: Container(
        width: 36,
        height: 4,
        decoration: BoxDecoration(
          color: _kDivider,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    ),
  );

  Widget _body(BuildContext context) {
    if (senior == null) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(
          child: Text(
            '어르신을 선택해주세요.',
            style: TextStyle(color: _kTextHint, fontSize: 14),
          ),
        ),
      );
    }
    if (locationLoading) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator(color: _kGreen)),
      );
    }

    final isSafe = senior!.status == '안전';
    final latLng = (latitude != null && longitude != null)
        ? '${latitude!.toStringAsFixed(6)}, ${longitude!.toStringAsFixed(6)}'
        : '좌표 정보 없음';
    final atMax = zones.length >= _kMaxZones;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 이름 + 배지
          Row(
            children: [
              Expanded(
                child: Text(
                  senior!.name,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: _kTextMain,
                  ),
                ),
              ),
              _StatusBadge(status: senior!.status),
            ],
          ),

          if (locationError != null) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                const Icon(
                  Icons.error_outline,
                  size: 15,
                  color: const Color(0xFFB85252),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    locationError!,
                    style: const TextStyle(
                      color: const Color(0xFFB85252),
                      fontSize: 13,
                    ),
                  ),
                ),
              ],
            ),
          ] else ...[
            const SizedBox(height: 14),
            _InfoRow(
              icon: Icons.location_on_outlined,
              label: '주소',
              value: address,
            ),
            const SizedBox(height: 8),
            _InfoRow(
              icon: Icons.access_time_outlined,
              label: '마지막 확인',
              value: time,
            ),
            const SizedBox(height: 8),
            _InfoRow(
              icon: Icons.my_location_outlined,
              label: '좌표',
              value: latLng,
            ),
            const SizedBox(height: 8),
            _InfoRow(
              icon: isSafe ? Icons.shield : Icons.shield_outlined,
              label: '안전 상태',
              value: isSafe ? '안전 구역 내' : '안전 구역 이탈',
              valueColor: isSafe ? _kSafe : _kWarn,
            ),
          ],

          const SizedBox(height: 16),
          const Divider(color: _kDivider, height: 1),
          const SizedBox(height: 14),

          // 안전 구역 헤더
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '안전 구역 (${zones.length}/$_kMaxZones)',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: _kTextMain,
                ),
              ),
              if (!atMax && !zonesLoading)
                GestureDetector(
                  onTap: onAddZone,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: _kSafeBg,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: _kGreen),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, size: 14, color: _kSafe),
                        SizedBox(width: 4),
                        Text(
                          '구역 추가',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: _kSafe,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),

          const SizedBox(height: 10),

          if (zonesLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(
                child: CircularProgressIndicator(
                  color: _kGreen,
                  strokeWidth: 2,
                ),
              ),
            )
          else if (zonesError != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(
                zonesError!,
                style: const TextStyle(
                  fontSize: 12,
                  color: const Color(0xFFB85252),
                ),
              ),
            )
          else if (zones.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text(
                '설정된 안전 구역이 없습니다.',
                style: TextStyle(fontSize: 13, color: _kTextHint),
              ),
            )
          else
            for (var i = 0; i < zones.length; i++) ...[
              _ZoneCard(
                zone: zones[i],
                onEdit: () => onEditZone(zones[i]),
                onDelete: () => onDeleteZone(zones[i]),
              ),
              if (i < zones.length - 1) const SizedBox(height: 8),
            ],

          const SizedBox(height: 16),
          const Divider(color: _kDivider, height: 1),
          const SizedBox(height: 14),
          _buildRouteHistorySection(),
        ],
      ),
    );
  }

  Widget _buildRouteHistorySection() {
    final rows = routeHistory.reversed.toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                '이동 경로',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: _kTextMain,
                ),
              ),
            ),
            GestureDetector(
              onTap: onPickRouteHistoryDate,
              behavior: HitTestBehavior.opaque,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF7F8F3),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _dateLabel(routeHistoryDate),
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: _kTextSub,
                      ),
                    ),
                    const SizedBox(width: 5),
                    const Icon(
                      Icons.calendar_today_outlined,
                      size: 14,
                      color: _kTextSub,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        if (routeHistoryLoading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Center(
              child: CircularProgressIndicator(color: _kGreen, strokeWidth: 2),
            ),
          )
        else if (routeHistoryError != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              routeHistoryError!,
              style: const TextStyle(fontSize: 12, color: Color(0xFFB85252)),
            ),
          )
        else if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              '선택한 날짜의 이동 경로가 없습니다.',
              style: TextStyle(fontSize: 13, color: _kTextHint),
            ),
          )
        else
          for (var i = 0; i < rows.length; i++) ...[
            _RouteHistoryCard(
              meridiem: _routeMeridiem(rows[i]),
              time: _routeTime(rows[i]),
              address: _routeAddress(rows[i]),
            ),
            if (i < rows.length - 1) const SizedBox(height: 8),
          ],
      ],
    );
  }

  String _dateLabel(DateTime date) {
    return '${date.year}-${_twoDigits(date.month)}-${_twoDigits(date.day)}';
  }

  String _routeMeridiem(Map<String, dynamic> item) {
    final parsed = _parseRouteDateTime(item);
    if (parsed == null) return '';
    return parsed.hour < 12 ? '오전' : '오후';
  }

  String _routeTime(Map<String, dynamic> item) {
    final parsed = _parseRouteDateTime(item);
    if (parsed == null) return '--:--';
    return '${_twoDigits(parsed.hour)}:${_twoDigits(parsed.minute)}';
  }

  DateTime? _parseRouteDateTime(Map<String, dynamic> item) {
    final raw = item['receivedAt']?.toString();
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw)?.toLocal();
  }

  String _routeAddress(Map<String, dynamic> item) {
    final address = item['address'] ?? item['roadAddress'];
    final text = address?.toString().trim() ?? '';
    return text.isEmpty ? '주소 정보 없음' : text;
  }

  String _twoDigits(int value) => value.toString().padLeft(2, '0');
}

// ── 안전 구역 카드 ─────────────────────────────────────────────────────────────

class _RouteHistoryCard extends StatelessWidget {
  final String meridiem;
  final String time;
  final String address;

  const _RouteHistoryCard({
    required this.meridiem,
    required this.time,
    required this.address,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8F3),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          SizedBox(
            width: 48,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  meridiem,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: _kSafe,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  time,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: _kSafe,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              address,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: _kTextMain,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ZoneCard extends StatelessWidget {
  final SafeZone zone;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _ZoneCard({
    required this.zone,
    required this.onEdit,
    required this.onDelete,
  });

  @override
  Widget build(BuildContext context) {
    final hasAddr = zone.address.isNotEmpty;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F8F3),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  zone.name,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: _kTextMain,
                  ),
                ),
                const SizedBox(height: 2),
                if (hasAddr)
                  Text(
                    zone.address,
                    style: const TextStyle(fontSize: 11, color: _kTextSub),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                Text(
                  '반경 ${_radiusLabel(zone.radiusMeters)}  '
                  '(${zone.centerLatitude.toStringAsFixed(4)}, '
                  '${zone.centerLongitude.toStringAsFixed(4)})',
                  style: const TextStyle(fontSize: 11, color: _kTextHint),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          GestureDetector(
            onTap: onEdit,
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 2, vertical: 6),
              child: Text(
                '수정',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: _kTextSub,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onDelete,
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.symmetric(horizontal: 2, vertical: 6),
              child: Text(
                '삭제',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFFB85252),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── 공유 위젯 ─────────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final isSafe = status == '안전';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: isSafe ? _kSafeBg : _kWarnBg,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: isSafe ? _kSafe : _kWarn,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 5),
          Text(
            status,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isSafe ? _kSafe : _kWarn,
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
  final String value;
  final Color? valueColor;

  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 1),
          child: Icon(icon, size: 14, color: _kTextHint),
        ),
        const SizedBox(width: 6),
        SizedBox(
          width: 72,
          child: Text(
            label,
            style: const TextStyle(fontSize: 12, color: _kTextSub, height: 1.4),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13,
              color: valueColor ?? _kTextMain,
              height: 1.4,
            ),
          ),
        ),
      ],
    );
  }
}

class _KakaoMapDisabledView extends StatelessWidget {
  const _KakaoMapDisabledView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          '에뮬레이터에서는 카카오맵을 비활성화했습니다.\n실제 기기에서 지도를 확인해주세요.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Color(0xFF6C6C70),
            fontSize: 14,
            height: 1.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
