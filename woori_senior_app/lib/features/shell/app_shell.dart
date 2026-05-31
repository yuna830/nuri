import 'package:flutter/material.dart';

import '../home/senior_home_screen.dart';
import '../job/job_screen.dart';
import '../location/location_screen.dart';
import '../profile/profile_screen.dart';
import '../weather/weather_screen.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.seniorId});
  final int seniorId;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  void _go(int i) => setState(() => _index = i);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // 각 탭은 자체 Scaffold를 가지므로 배경 불필요
      backgroundColor: Colors.transparent,
      body: IndexedStack(
        index: _index,
        children: [
          SeniorHomeScreen(
            seniorId: widget.seniorId,
            onTabSwitch: _go,
          ),
          LocationScreen(seniorId: widget.seniorId),
          WeatherScreen(seniorId: widget.seniorId),
          JobScreen(seniorId: widget.seniorId),
          ProfileScreen(seniorId: widget.seniorId),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _go,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        indicatorColor: const Color(0xFF86A788).withValues(alpha: 0.18),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home, color: Color(0xFF86A788)),
            label: '홈',
          ),
          NavigationDestination(
            icon: Icon(Icons.location_on_outlined),
            selectedIcon: Icon(Icons.location_on, color: Color(0xFF86A788)),
            label: '위치',
          ),
          NavigationDestination(
            icon: Icon(Icons.wb_sunny_outlined),
            selectedIcon: Icon(Icons.wb_sunny, color: Color(0xFF86A788)),
            label: '기후',
          ),
          NavigationDestination(
            icon: Icon(Icons.work_outline),
            selectedIcon: Icon(Icons.work, color: Color(0xFF86A788)),
            label: '일자리',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person, color: Color(0xFF86A788)),
            label: '내 정보',
          ),
        ],
      ),
    );
  }
}
