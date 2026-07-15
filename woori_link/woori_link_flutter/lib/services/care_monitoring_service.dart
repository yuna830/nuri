import 'dart:async';
import 'dart:math';
import 'package:geolocator/geolocator.dart';
import 'package:sensors_plus/sensors_plus.dart';
import '../api/care_monitoring_api.dart';
import 'auth_service.dart';

class CareMonitoringService {
  StreamSubscription<Position>? _positionSubscription;
  StreamSubscription<AccelerometerEvent>? _accelerometerSubscription;
  DateTime? _lastFallReport;

  Future<void> start() async {
    final seniorId = await AuthService.getUserId();
    if (seniorId == null || !await _requestLocationPermission()) return;
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 30),
    ).listen((position) => CareMonitoringApi.sendLocation(seniorId, position.latitude, position.longitude).catchError((_) {}));
    _accelerometerSubscription = accelerometerEventStream().listen((event) {
      final magnitude = sqrt(event.x * event.x + event.y * event.y + event.z * event.z);
      if (magnitude > 24 && (_lastFallReport == null || DateTime.now().difference(_lastFallReport!).inMinutes >= 2)) {
        _lastFallReport = DateTime.now();
        CareMonitoringApi.reportFall(seniorId).catchError((_) {});
      }
    });
  }

  Future<bool> _requestLocationPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  void dispose() { _positionSubscription?.cancel(); _accelerometerSubscription?.cancel(); }
}
