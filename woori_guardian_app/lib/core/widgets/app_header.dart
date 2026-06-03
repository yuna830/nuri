import 'package:flutter/material.dart';

const _green = Color(0xFF86A788);

class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final int unreadCount;
  final VoidCallback? onNotificationTap;

  const AppHeader({
    super.key,
    required this.title,
    this.unreadCount = 0,
    this.onNotificationTap,
  });

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: _green,
      foregroundColor: Colors.white,
      elevation: 0,
      title: Text(
        title,
        style: const TextStyle(
            fontSize: 18, fontWeight: FontWeight.w600, color: Colors.white),
        overflow: TextOverflow.ellipsis,
      ),
      actions: [
        IconButton(
          icon: Badge(
            isLabelVisible: unreadCount > 0,
            label: Text(
              unreadCount > 99 ? '99+' : '$unreadCount',
              style: const TextStyle(fontSize: 10),
            ),
            child: const Icon(Icons.notifications_outlined),
          ),
          onPressed: onNotificationTap,
          tooltip: '알림 센터',
        ),
      ],
    );
  }
}
