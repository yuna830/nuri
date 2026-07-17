import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:sensors_plus/sensors_plus.dart';
import '../api/care_monitoring_api.dart';
import '../constants.dart';
import 'auth_service.dart';

enum _ImpactStage { idle, impactDetected }

class CareMonitoringService {
  // 아두이노 MPU-6050 로직(충격 감지 → 800ms 내 정지 확인)을 폰 가속도계로 이식.
  static const double _impactThreshold = 20.0; // m/s^2, 순간 충격 (~2g)
  static const double _stillnessLow = 7.0; // m/s^2
  static const double _stillnessHigh = 11.5; // m/s^2
  static const Duration _stillnessWindow = Duration(milliseconds: 800);
  static const Duration _reportCooldown = Duration(minutes: 2);

  StreamSubscription<Position>? _positionSubscription;
  StreamSubscription<AccelerometerEvent>? _accelerometerSubscription;
  _ImpactStage _stage = _ImpactStage.idle;
  DateTime? _impactTime;
  DateTime? _lastFallReport;

  Future<void> start() async {
    final seniorId = await AuthService.getUserId();
    if (seniorId == null || !await _requestLocationPermission()) return;
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 30),
    ).listen((position) => CareMonitoringApi.sendLocation(seniorId, position.latitude, position.longitude).catchError((_) {}));
    _accelerometerSubscription = accelerometerEventStream().listen((event) => _onAccelerometerEvent(event, seniorId));
  }

  void _onAccelerometerEvent(AccelerometerEvent event, int seniorId) {
    final magnitude = sqrt(event.x * event.x + event.y * event.y + event.z * event.z);
    final now = DateTime.now();

    if (_stage == _ImpactStage.idle) {
      if (magnitude > _impactThreshold) {
        _stage = _ImpactStage.impactDetected;
        _impactTime = now;
      }
      return;
    }

    // impactDetected: 충격 이후 정지 상태 확인 대기.
    if (now.difference(_impactTime!) > _stillnessWindow) {
      _stage = _ImpactStage.idle;
      return;
    }

    if (magnitude >= _stillnessLow && magnitude <= _stillnessHigh) {
      _stage = _ImpactStage.idle;
      _reportFall(seniorId);
    }
  }

  void _reportFall(int seniorId) {
    final now = DateTime.now();
    if (_lastFallReport != null && now.difference(_lastFallReport!) < _reportCooldown) return;
    _lastFallReport = now;

    CareMonitoringApi.reportFall(seniorId).catchError((_) {});

    // fall-detection 서버(카메라 앙상블)에도 폰 센서 신호 전달 — 기존 /arduino/status와 동일한 계약.
    _postPhoneStatus('FALL');
    Future.delayed(const Duration(seconds: 5), () => _postPhoneStatus('NORMAL'));
  }

  Future<void> _postPhoneStatus(String status) async {
    try {
      await http
          .post(
            Uri.parse('$fallServerBaseUrl/phone/status'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'status': status}),
          )
          .timeout(const Duration(seconds: 5));
    } catch (_) {}
  }

  Future<bool> _requestLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  void dispose() { _positionSubscription?.cancel(); _accelerometerSubscription?.cancel(); }
}
