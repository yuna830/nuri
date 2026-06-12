import 'dart:convert';

import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';

/// 앱을 닫아도 위치가 계속 전송되도록 하는 포그라운드 서비스.
/// 상단에 "위치 보호 중" 알림이 떠 있는 동안 3분마다 GPS를 읽어 서버로 보낸다.
class BackgroundLocationService {
  static const _intervalMs = 3 * 60 * 1000; // 3분

  /// 로그인 후(AppShell 진입 시) 호출. 권한을 확인하고 서비스를 시작한다.
  static Future<void> start({required int seniorId}) async {
    // 위치 권한
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission != LocationPermission.always &&
        permission != LocationPermission.whileInUse) {
      return;
    }

    // 알림 권한 (Android 13+, 포그라운드 서비스 알림 표시용)
    final notificationPermission =
        await FlutterForegroundTask.checkNotificationPermission();
    if (notificationPermission != NotificationPermission.granted) {
      await FlutterForegroundTask.requestNotificationPermission();
    }

    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'woori_location_protect',
        channelName: '위치 보호',
        channelDescription: '보호자에게 위치를 공유하기 위해 실행됩니다.',
        onlyAlertOnce: true,
      ),
      iosNotificationOptions: const IOSNotificationOptions(),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(_intervalMs),
        autoRunOnBoot: true,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );

    // 백그라운드 isolate에서는 dotenv가 로드되지 않으므로 값을 미리 저장해 둔다.
    await FlutterForegroundTask.saveData(key: 'bgSeniorId', value: '$seniorId');
    await FlutterForegroundTask.saveData(key: 'bgApiBaseUrl', value: apiBaseUrl);

    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.restartService();
    } else {
      await FlutterForegroundTask.startService(
        serviceId: 1001,
        notificationTitle: '우리 — 위치 보호 중',
        notificationText: '보호자에게 위치를 공유하고 있습니다.',
        callback: backgroundLocationCallback,
      );
    }
  }

  /// 로그아웃 시 호출.
  static Future<void> stop() async {
    if (await FlutterForegroundTask.isRunningService) {
      await FlutterForegroundTask.stopService();
    }
  }
}

@pragma('vm:entry-point')
void backgroundLocationCallback() {
  FlutterForegroundTask.setTaskHandler(_BackgroundLocationTaskHandler());
}

class _BackgroundLocationTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    // 시작 즉시 한 번 전송
    await _sendLocation();
  }

  @override
  void onRepeatEvent(DateTime timestamp) {
    _sendLocation();
  }

  @override
  Future<void> onDestroy(DateTime timestamp) async {}

  Future<void> _sendLocation() async {
    try {
      final seniorIdText =
          await FlutterForegroundTask.getData<String>(key: 'bgSeniorId');
      final baseUrl =
          await FlutterForegroundTask.getData<String>(key: 'bgApiBaseUrl');

      if (seniorIdText == null || baseUrl == null) return;

      final seniorId = int.tryParse(seniorIdText);
      if (seniorId == null) return;

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 20),
        ),
      );

      await http
          .post(
            Uri.parse('$baseUrl/api/locations'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'seniorId': seniorId,
              'latitude': position.latitude,
              'longitude': position.longitude,
              'accuracy': position.accuracy,
            }),
          )
          .timeout(const Duration(seconds: 10));
    } catch (_) {
      // 위치/네트워크 실패는 다음 주기에 다시 시도
    }
  }
}
