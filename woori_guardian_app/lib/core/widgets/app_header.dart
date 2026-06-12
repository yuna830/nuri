import 'package:flutter/material.dart';

import '../theme/app_colors.dart';

const _green = AppColors.green;

class AppHeader extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final int unreadCount;
  final int chatUnreadCount;
  final VoidCallback? onNotificationTap;
  final VoidCallback? onChatTap;

  const AppHeader({
    super.key,
    required this.title,
    this.unreadCount = 0,
    this.chatUnreadCount = 0,
    this.onNotificationTap,
    this.onChatTap,
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
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: Colors.white,
        ),
        overflow: TextOverflow.ellipsis,
      ),
      actions: [
        IconButton(
          icon: Badge(
            isLabelVisible: chatUnreadCount > 0,
            label: Text(
              chatUnreadCount > 99 ? '99+' : '$chatUnreadCount',
              style: const TextStyle(fontSize: 10),
            ),
            child: const Icon(Icons.chat_bubble_outline),
          ),
          onPressed: onChatTap,
          tooltip: '채팅',
        ),
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