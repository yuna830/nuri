import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

import '../config/app_config.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp();
  }
}

class FcmService {
  FcmService._();

  static final _messaging = FirebaseMessaging.instance;
  static final _local = FlutterLocalNotificationsPlugin();
  static bool _initialized = false;

  static Future<void> init({required String role, required int userId}) async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp();
      }
    } catch (e) {
      debugPrint('[FCM] Firebase initialization skipped: $e');
      return;
    }

    if (!_initialized) {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    }

    await _messaging.requestPermission(alert: true, badge: true, sound: true);

    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidInit);
    await _local.initialize(initSettings);

    const channel = AndroidNotificationChannel(
      'woori_alerts',
      '우리 알림',
      description: '긴급 상황 및 동의 요청 알림',
      importance: Importance.high,
    );

    await _local
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);

    final token = await _messaging.getToken();
    if (token != null) {
      await registerToken(role: role, userId: userId, token: token);
    }

    _messaging.onTokenRefresh.listen((newToken) {
      registerToken(role: role, userId: userId, token: newToken);
    });

    if (!_initialized) {
      FirebaseMessaging.onMessage.listen((message) {
        final notification = message.notification;
        final type = message.data['type'] ?? '';

        final title =
            notification?.title ??
            (type == 'SAFE_ZONE_EXIT' ? '안전 반경 이탈' : '우리 알림');

        final body =
            notification?.body ??
            (type == 'SAFE_ZONE_EXIT' ? '보호 대상자가 안전 반경을 벗어났습니다.' : '');

        _local.show(
          message.messageId.hashCode,
          title,
          body,
          const NotificationDetails(
            android: AndroidNotificationDetails(
              'woori_alerts',
              '우리 알림',
              channelDescription: '긴급 상황 및 동의 요청 알림',
              importance: Importance.high,
              priority: Priority.high,
            ),
          ),
        );
      });
      _initialized = true;
    }
  }

  static Future<void> registerToken({
    required String role,
    required int userId,
    required String token,
  }) async {
    try {
      await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/push-tokens'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'role': role, 'userId': userId, 'token': token}),
      );
    } catch (e) {
      debugPrint('[FCM] Token registration failed: $e');
    }
  }
}
