import 'package:flutter/material.dart';

import '../chat/chat_screen.dart';
import '../home/senior_home_screen.dart';
import '../job/job_screen.dart';
import '../location/location_screen.dart';
import '../profile/profile_screen.dart';
import '../weather/weather_screen.dart';

const _tabTitles = ['홈', '위치 확인', '기후 알림', '일자리', '채팅', '내 정보'];

const _tabIcons = [
  Icons.home_outlined,
  Icons.location_on_outlined,
  Icons.wb_sunny_outlined,
  Icons.work_outline,
  Icons.chat_bubble_outline,
  Icons.person_outline,
];

const _tabSelectedIcons = [
  Icons.home,
  Icons.location_on,
  Icons.wb_sunny,
  Icons.work,
  Icons.chat_bubble,
  Icons.person,
];

class AppShell extends StatefulWidget {
  const AppShell({super.key, required this.seniorId});
  final int seniorId;

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  // 각 탭 화면에서 콜백으로 액션을 전달받아 AppBar에 표시
  VoidCallback? _currentAction;
  IconData? _currentActionIcon;
  String? _currentActionTooltip;

  void _go(int i) => setState(() {
        _index = i;
        _currentAction = null;
        _currentActionIcon = null;
        _currentActionTooltip = null;
      });

  void _registerAction({
    required VoidCallback action,
    required IconData icon,
    required String tooltip,
  }) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() {
          _currentAction = action;
          _currentActionIcon = icon;
          _currentActionTooltip = tooltip;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFDEC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        titleSpacing: 20,
        title: _index == 0
            ? const Text(
                '우리 woori',
                style: TextStyle(
                  color: Color(0xFF86A788),
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              )
            : Row(
                children: [
                  Icon(_tabSelectedIcons[_index],
                      color: const Color(0xFF86A788), size: 20),
                  const SizedBox(width: 8),
                  Text(
                    _tabTitles[_index],
                    style: const TextStyle(
                      color: Color(0xFF1F2A20),
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
        actions: [
          if (_currentAction != null && _currentActionIcon != null)
            IconButton(
              icon: Icon(_currentActionIcon, color: const Color(0xFF86A788)),
              tooltip: _currentActionTooltip,
              onPressed: _currentAction,
            ),
          const SizedBox(width: 4),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: [
          SeniorHomeScreen(
            seniorId: widget.seniorId,
            onTabSwitch: _go,
            hideAppBar: true,
            onRegisterAction: _registerAction,
          ),
          LocationScreen(
            seniorId: widget.seniorId,
            hideAppBar: true,
            onRegisterAction: _registerAction,
          ),
          WeatherScreen(
            seniorId: widget.seniorId,
            hideAppBar: true,
            onRegisterAction: _registerAction,
          ),
          JobScreen(
            seniorId: widget.seniorId,
            hideAppBar: true,
            onRegisterAction: _registerAction,
          ),
          ChatScreen(seniorId: widget.seniorId),
          ProfileScreen(
            seniorId: widget.seniorId,
            hideAppBar: true,
            onRegisterAction: _registerAction,
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _go,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        indicatorColor: const Color(0xFF86A788).withValues(alpha: 0.18),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: List.generate(_tabTitles.length, (i) {
          return NavigationDestination(
            icon: Icon(_tabIcons[i]),
            selectedIcon: Icon(_tabSelectedIcons[i],
                color: const Color(0xFF86A788)),
            label: _tabTitles[i],
          );
        }),
      ),
    );
  }
}
