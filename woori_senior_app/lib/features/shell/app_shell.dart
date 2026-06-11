import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';
import '../../core/storage/senior_session_storage.dart';
import '../auth/login_screen.dart';
import '../chat/chat_screen.dart';
import '../home/senior_home_screen.dart';
import '../job/job_screen.dart';
import '../location/location_screen.dart';
import '../notifications/notification_screen.dart';
import '../profile/profile_screen.dart';
import '../settings/settings_screen.dart';
import '../weather/weather_screen.dart';

// 하단 탭: 채팅·알림 제거 (헤더로 이동)
const _tabTitles = ['홈', '위치', '기후', '일자리', '내 정보'];

const _tabIcons = [
  Icons.home_outlined,
  Icons.location_on_outlined,
  Icons.wb_sunny_outlined,
  Icons.work_outline,
  Icons.person_outline,
];

const _tabSelectedIcons = [
  Icons.home,
  Icons.location_on,
  Icons.wb_sunny,
  Icons.work,
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
  int _unreadCount = 0;
  int _unreadChatCount = 0;
  bool _hasInfoRequest = false;
  Timer? _notiTimer;
  final _api = const SeniorApi();

  VoidCallback? _currentAction;
  IconData? _currentActionIcon;
  String? _currentActionTooltip;

  @override
  void initState() {
    super.initState();
    _pollUnread();
    _notiTimer = Timer.periodic(const Duration(seconds: 10), (_) => _pollUnread());
  }

  @override
  void dispose() {
    _notiTimer?.cancel();
    super.dispose();
  }

  Future<void> _pollUnread() async {
    try {
      final alerts = await _api.fetchAlerts(widget.seniorId);
      final count = alerts.where((a) => a is Map && a['isRead'] != true).length;
      final hasInfo = alerts.any((a) =>
          a is Map && a['isRead'] != true && a['type'] == 'INFO_UPDATE_REQUEST');
      if (mounted) {
        if (count != _unreadCount || hasInfo != _hasInfoRequest) {
          setState(() {
            _unreadCount = count;
            _hasInfoRequest = hasInfo;
          });
        }
      }
    } catch (_) {}
    try {
      final res = await http.get(Uri.parse(
        '$apiBaseUrl/api/chat/unread?viewerRole=SENIOR&seniorId=${widget.seniorId}',
      )).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = jsonDecode(utf8.decode(res.bodyBytes));
        final chatUnread = (data['count'] as num?)?.toInt() ?? 0;
        if (mounted && chatUnread != _unreadChatCount) setState(() => _unreadChatCount = chatUnread);
      }
    } catch (_) {}
  }

  void _go(int i) => setState(() {
        _index = i;
        if (i == 4) _hasInfoRequest = false;
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

  void _openSettings() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SettingsScreen(seniorId: widget.seniorId),
      ),
    );
  }

  void _openChat() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => ChatScreen(seniorId: widget.seniorId),
      ),
    );
  }

  void _openNotifications() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => NotificationScreen(
          seniorId: widget.seniorId,
          hideAppBar: false,
        ),
      ),
    );
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title:
            const Text('로그아웃', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('로그아웃 하시겠어요?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child:
                const Text('로그아웃', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await SeniorSessionStorage.clear();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const SeniorLoginScreen()),
          (route) => false,
        );
      }
    }
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
          // 채팅
          Stack(
            clipBehavior: Clip.none,
            children: [
              IconButton(
                icon: const Icon(Icons.chat_bubble_outline, color: Color(0xFF86A788)),
                tooltip: '채팅',
                onPressed: () {
                  _openChat();
                  setState(() => _unreadChatCount = 0);
                },
                visualDensity: VisualDensity.compact,
              ),
              if (_unreadChatCount > 0)
                Positioned(
                  right: 4,
                  top: 4,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(
                      color: Color(0xFFD94E4E),
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      _unreadChatCount > 99 ? '99+' : '$_unreadChatCount',
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w900),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          // 알림
          Stack(
            clipBehavior: Clip.none,
            children: [
              IconButton(
                icon: const Icon(Icons.notifications_outlined,
                    color: Color(0xFF86A788)),
                tooltip: '알림',
                onPressed: () {
                  _openNotifications();
                  setState(() => _unreadCount = 0);
                },
                visualDensity: VisualDensity.compact,
              ),
              if (_unreadCount > 0)
                Positioned(
                  right: 4,
                  top: 4,
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: const BoxDecoration(
                      color: Color(0xFFD94E4E),
                      shape: BoxShape.circle,
                    ),
                    constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
                    child: Text(
                      _unreadCount > 99 ? '99+' : '$_unreadCount',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
          // 설정
          IconButton(
            icon: const Icon(Icons.settings_outlined, color: Color(0xFF86A788)),
            tooltip: '설정',
            onPressed: _openSettings,
            visualDensity: VisualDensity.compact,
          ),
          // 로그아웃
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: IconButton(
              icon: const Icon(Icons.logout, color: Color(0xFF86A788)),
              tooltip: '로그아웃',
              onPressed: _logout,
              visualDensity: VisualDensity.compact,
            ),
          ),
        ],
      ),
      body: _buildCurrentPage(),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _go,
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        indicatorColor: const Color(0xFF86A788).withValues(alpha: 0.18),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
        destinations: List.generate(_tabTitles.length, (i) {
          final showDot = i == 4 && _hasInfoRequest;
          return NavigationDestination(
            icon: Badge(
              isLabelVisible: showDot,
              backgroundColor: const Color(0xFFD94E4E),
              child: Icon(_tabIcons[i]),
            ),
            selectedIcon: Badge(
              isLabelVisible: showDot,
              backgroundColor: const Color(0xFFD94E4E),
              child: Icon(_tabSelectedIcons[i], color: const Color(0xFF86A788)),
            ),
            label: _tabTitles[i],
          );
        }),
      ),
    );
  }

  Widget _buildCurrentPage() {
    switch (_index) {
      case 0:
        return SeniorHomeScreen(
          seniorId: widget.seniorId,
          onTabSwitch: _go,
          hideAppBar: true,
        );
      case 1:
        return LocationScreen(
          seniorId: widget.seniorId,
          hideAppBar: true,
          onRegisterAction: _registerAction,
        );
      case 2:
        return WeatherScreen(
          seniorId: widget.seniorId,
          hideAppBar: true,
          onRegisterAction: _registerAction,
        );
      case 3:
        return JobScreen(
          seniorId: widget.seniorId,
          hideAppBar: true,
          onRegisterAction: _registerAction,
        );
      case 4:
        return ProfileScreen(
          seniorId: widget.seniorId,
          hideAppBar: true,
          onRegisterAction: _registerAction,
          onSaved: () => _go(0),
        );
      default:
        return SeniorHomeScreen(
          seniorId: widget.seniorId,
          onTabSwitch: _go,
          hideAppBar: true,
        );
    }
  }
}
