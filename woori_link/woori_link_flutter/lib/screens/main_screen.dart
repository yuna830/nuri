import 'package:flutter/material.dart';
import 'home_screen.dart';
import 'energy_voucher_screen.dart';
import 'recall_screen.dart';
import 'sos_screen.dart';
import 'profile_screen.dart';
import '../services/care_monitoring_service.dart';

class MainScreen extends StatefulWidget {
  const MainScreen({super.key});

  @override
  State<MainScreen> createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;
  int _recallInitialTab = 0;
  final _careMonitoring = CareMonitoringService();

  @override
  void initState() {
    super.initState();
    _careMonitoring.start();
  }

  @override
  void dispose() {
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
