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
  static const Duration _requiredStillness = Duration(milliseconds: 300);
  static const Duration _reportCooldown = Duration(minutes: 2);

  StreamSubscription<Position>? _positionSubscription;
  StreamSubscription<AccelerometerEvent>? _accelerometerSubscription;
  _ImpactStage _stage = _ImpactStage.idle;
  DateTime? _impactTime;
  DateTime? _stillnessStartedAt;
  DateTime? _lastFallReport;
  Timer? _normalStatusTimer;
  bool _disposed = false;

  Future<void> start() async {
    final seniorId = await AuthService.getUserId();
    if (seniorId == null) return;
    _accelerometerSubscription = accelerometerEventStream().listen((event) => _onAccelerometerEvent(event, seniorId));
    if (await _requestLocationPermission()) {
      _positionSubscription = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 30),
      ).listen((position) => CareMonitoringApi.sendLocation(seniorId, position.latitude, position.longitude).catchError((_) {}));
    }
  }

  void _onAccelerometerEvent(AccelerometerEvent event, int seniorId) {
    final magnitude = sqrt(event.x * event.x + event.y * event.y + event.z * event.z);
    final now = DateTime.now();

    if (_stage == _ImpactStage.idle) {
      if (magnitude > _impactThreshold) {
        _stage = _ImpactStage.impactDetected;
        _impactTime = now;
        _stillnessStartedAt = null;
      }
      return;
    }

    // impactDetected: 충격 이후 정지 상태 확인 대기.
    if (now.difference(_impactTime!) > _stillnessWindow) {
      _resetImpactState();
      return;
    }

    if (magnitude >= _stillnessLow && magnitude <= _stillnessHigh) {
      _stillnessStartedAt ??= now;
      if (now.difference(_stillnessStartedAt!) >= _requiredStillness) {
        _resetImpactState();
        _reportFall(seniorId);
      }
    } else {
      _stillnessStartedAt = null;
    }
  }

  void _resetImpactState() {
    _stage = _ImpactStage.idle;
    _impactTime = null;
    _stillnessStartedAt = null;
  }

  void _reportFall(int seniorId) {
    final now = DateTime.now();
    if (_lastFallReport != null && now.difference(_lastFallReport!) < _reportCooldown) return;
    _lastFallReport = now;

    // Python combines phone, camera, and Arduino signals and reports one final
    // event to woori_link_spring.
    _postPhoneStatus('FALL', seniorId);
    _normalStatusTimer?.cancel();
    _normalStatusTimer = Timer(const Duration(seconds: 5), () {
      if (!_disposed) _postPhoneStatus('NORMAL', seniorId);
    });
  }

  Future<void> _postPhoneStatus(String status, int seniorId) async {
    try {
      await http
          .post(
            Uri.parse('$fallServerBaseUrl/phone/status'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'status': status,
              'seniorId': seniorId,
              'deviceId': fallDeviceId,
              'occurredAt': DateTime.now().toUtc().toIso8601String(),
            }),
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

  void dispose() {
    _disposed = true;
    _normalStatusTimer?.cancel();
    _positionSubscription?.cancel();
    _accelerometerSubscription?.cancel();
  }
}
