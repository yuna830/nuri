import 'dart:async';
import 'dart:convert';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../api/http_client.dart';
import '../constants.dart';

class FcmService {
  FcmService({this.onForegroundMessage, this.onNotificationOpened});

  final void Function(RemoteMessage)? onForegroundMessage;
  final void Function(RemoteMessage)? onNotificationOpened;

  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _messageSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;

  Future<void> initialize() async {
    try {
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null) await _registerTokenSafely(token);

      _tokenSubscription = FirebaseMessaging.instance.onTokenRefresh.listen(
        (token) => _registerTokenSafely(token),
      );
      _messageSubscription = FirebaseMessaging.onMessage.listen(
        (message) => onForegroundMessage?.call(message),
      );
      _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen(
        (message) => onNotificationOpened?.call(message),
      );

      final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        Future.microtask(() => onNotificationOpened?.call(initialMessage));
      }
    } catch (error) {
      debugPrint('FCM initialization failed: $error');
    }
  }

  Future<void> _registerTokenSafely(String token) async {
    try {
      final headers = await authHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/push-tokens'),
        headers: headers,
        body: jsonEncode({'token': token}),
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception('status ${response.statusCode}');
      }
    } catch (error) {
      debugPrint('FCM token registration failed: $error');
    }
  }

  void dispose() {
    _tokenSubscription?.cancel();
    _messageSubscription?.cancel();
    _openedSubscription?.cancel();
  }
}
