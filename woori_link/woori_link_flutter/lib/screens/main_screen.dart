import 'package:flutter/material.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'home_screen.dart';
import 'energy_voucher_screen.dart';
import 'recall_screen.dart';
import 'sos_screen.dart';
import 'profile_screen.dart';
import '../services/care_monitoring_service.dart';
import '../services/fcm_service.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;
  int _recallInitialTab = 0;
  final _careMonitoring = CareMonitoringService();
  late final FcmService _fcmService;

  @override
  void initState() {
    super.initState();
    _careMonitoring.start();
    _fcmService = FcmService(
      onForegroundMessage: _showRecallNotification,
      onNotificationOpened: _openRecallNotification,
    );
    _fcmService.initialize();
  }

  void _showRecallNotification(RemoteMessage message) {
    if (!mounted) return;
    final text = message.notification?.body ??
        message.data['message']?.toString() ??
        '새 제품 안전 안내가 도착했습니다.';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        action: SnackBarAction(
          label: '확인',
          onPressed: () => _openRecallNotification(message),
        ),
      ),
    );
  }

  void _openRecallNotification(RemoteMessage message) {
    if (!mounted || message.data['type'] != 'PRODUCT_RECALL') return;
    setState(() {
      _recallInitialTab = 0;
      _currentIndex = 2;
    });
  }

  @override
  void dispose() {
    _fcmService.dispose();
    _careMonitoring.dispose();
    super.dispose();
  }

  List<Widget> get _screens => [
        HomeScreen(
          onTabSelected: (index) => setState(() {
            if (index == 2) _recallInitialTab = 0;
            _currentIndex = index;
          }),
          onRecallRequestsSelected: () => setState(() {
            _recallInitialTab = 1;
            _currentIndex = 2;
          }),
        ),
        const EnergyVoucherScreen(),
        RecallScreen(
          key: ValueKey('recall-$_recallInitialTab'),
          initialTab: _recallInitialTab,
        ),
        const SosScreen(),
        const ProfileScreen(),
      ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: '홈'),
          BottomNavigationBarItem(icon: Icon(Icons.bolt_outlined), activeIcon: Icon(Icons.bolt), label: '에너지'),
          BottomNavigationBarItem(icon: Icon(Icons.warning_amber_outlined), activeIcon: Icon(Icons.warning_amber), label: '리콜'),
          BottomNavigationBarItem(icon: Icon(Icons.sos_outlined), activeIcon: Icon(Icons.sos), label: 'SOS'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: '내 정보'),
        ],
      ),
    );
  }
}
