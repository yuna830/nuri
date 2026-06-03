import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../core/api/guardian_api.dart';

const double _kSafeRadiusM = 300.0;
const double _defaultLat   = 37.5665;
const double _defaultLng   = 126.9780;

class SeniorLocationScreen extends StatefulWidget {
  final int    seniorId;
  final String name;
  final String status;

  const SeniorLocationScreen({
    super.key,
    required this.seniorId,
    required this.name,
    required this.status,
  });

  @override
  State<SeniorLocationScreen> createState() => _SeniorLocationScreenState();
}

class _SeniorLocationScreenState extends State<SeniorLocationScreen> {
  final _api           = GuardianApi();
  final _mapController = MapController();

  bool    _isLoading    = true;
  String? _errorMessage;

  String  _address  = '-';
  String  _time     = '-';
  double? _latitude;
  double? _longitude;

  @override
  void initState() {
    super.initState();
    _loadLocation();
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  Future<void> _loadLocation() async {
    setState(() { _isLoading = true; _errorMessage = null; });

    try {
      final data = await _api.fetchLatestLocation(widget.seniorId);
      if (!mounted) return;

      final receivedAt = data['receivedAt']?.toString() ?? '-';
      final timeStr = receivedAt.length > 16
          ? receivedAt.substring(0, 16).replaceAll('T', ' ')
          : receivedAt.replaceAll('T', ' ');

      final lat = (data['latitude']  as num?)?.toDouble();
      final lng = (data['longitude'] as num?)?.toDouble();

      setState(() {
        _address   = data['address'] ?? data['roadAddress'] ?? '주소 정보 없음';
        _time      = timeStr;
        _latitude  = lat;
        _longitude = lng;
        _isLoading = false;
      });

      if (lat != null && lng != null) {
        _mapController.move(LatLng(lat, lng), 15.0);
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
        _isLoading    = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final centerLat  = _latitude  ?? _defaultLat;
    final centerLng  = _longitude ?? _defaultLng;
    final hasLocation = _latitude != null && _longitude != null;
    final isSafe     = widget.status == '안전';
    final safeColor  = isSafe ? const Color(0xFF4A7A4C) : const Color(0xFFFF9500);

    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.name} 위치'),
        backgroundColor: const Color(0xFF86A788),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadLocation,
          ),
        ],
      ),
      body: Column(
        children: [
          // 지도 영역
          Expanded(
            flex: 3,
            child: Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: LatLng(centerLat, centerLng),
                    initialZoom: 15.0,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.woori.woori_guardian_app',
                    ),
                    if (hasLocation) ...[
                      CircleLayer(
                        circles: [
                          CircleMarker(
                            point: LatLng(centerLat, centerLng),
                            radius: _kSafeRadiusM,
                            useRadiusInMeter: true,
                            color: safeColor.withValues(alpha: 0.15),
                            borderColor: safeColor,
                            borderStrokeWidth: 1.5,
                          ),
                        ],
                      ),
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: LatLng(centerLat, centerLng),
                            width: 40,
                            height: 40,
                            child: Icon(
                              Icons.location_on,
                              color: safeColor,
                              size: 40,
                              shadows: const [
                                Shadow(color: Colors.black26, blurRadius: 4),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
                if (_isLoading)
                  Container(
                    color: Colors.grey.shade300.withValues(alpha: 0.8),
                    child: const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          CircularProgressIndicator(color: Color(0xFF86A788)),
                          SizedBox(height: 12),
                          Text('위치 정보 불러오는 중...',
                              style: TextStyle(color: Colors.black54)),
                        ],
                      ),
                    ),
                  ),
                if (!_isLoading && !hasLocation && _errorMessage == null)
                  Container(
                    color: Colors.white.withValues(alpha: 0.75),
                    child: const Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.location_off, size: 40, color: Colors.grey),
                          SizedBox(height: 8),
                          Text('위치 정보가 없습니다',
                              style: TextStyle(color: Colors.black54, fontSize: 15)),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // 정보 패널
          Expanded(
            flex: 2,
            child: Container(
              padding: const EdgeInsets.all(24.0),
              width: double.infinity,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                boxShadow: [
                  BoxShadow(color: Colors.black12, blurRadius: 10,
                      offset: Offset(0, -2)),
                ],
              ),
              child: _isLoading
                  ? const Center(
                      child: CircularProgressIndicator(color: Color(0xFF86A788)))
                  : _errorMessage != null
                      ? _buildError()
                      : _buildInfo(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(_errorMessage!,
              style: const TextStyle(color: Color(0xFFB85252), fontSize: 15),
              textAlign: TextAlign.center),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _loadLocation,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF86A788),
              foregroundColor: Colors.white,
            ),
            child: const Text('다시 시도'),
          ),
        ],
      ),
    );
  }

  Widget _buildInfo() {
    final isSafe     = widget.status == '안전';
    final latLngText = (_latitude != null && _longitude != null)
        ? '$_latitude, $_longitude'
        : '좌표 정보 없음';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(widget.name,
                style: const TextStyle(
                    fontSize: 24, fontWeight: FontWeight.bold)),
            Chip(
              label: Text(widget.status),
              backgroundColor:
                  isSafe ? Colors.green[100] : Colors.orange[100],
              labelStyle: TextStyle(
                color: isSafe ? Colors.green[800] : Colors.orange[800],
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const Text('마지막 위치',
            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.grey)),
        const SizedBox(height: 4),
        Text(_address, style: const TextStyle(fontSize: 16)),
        const SizedBox(height: 12),
        Text('시간: $_time', style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 4),
        Text('좌표: $latLngText',
            style: const TextStyle(color: Colors.grey, fontSize: 12)),
      ],
    );
  }
}
