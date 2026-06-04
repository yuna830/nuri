import 'package:flutter/material.dart';
import '../../core/api/guardian_api.dart';
import '../../core/models/alert.dart';
import '../../core/storage/guardian_session_storage.dart';

class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  State<NotificationCenterScreen> createState() => _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();

  bool _isLoading = true;
  String? _errorMessage;
  List<AlertModel> _alerts = [];

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final userInfo = await _sessionStorage.getGuardianInfo();
      final guardianIdStr = userInfo['guardianId'];

      if (guardianIdStr == null || guardianIdStr.isEmpty) {
        throw Exception('보호자 세션 정보가 없습니다. 다시 로그인해주세요.');
      }

      final guardianId = int.parse(guardianIdStr);
      final alerts = await _api.fetchGuardianAlerts(guardianId);

      if (mounted) {
        setState(() {
          _alerts = alerts;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString().replaceAll('Exception: ', '');
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _markAsRead(int index) async {
    final alert = _alerts[index];
    if (alert.isRead) return;

    setState(() {
      _alerts[index] = alert.copyWith(isRead: true);
    });

    try {
      await _api.markAlertAsRead(alert.id);
    } catch (_) {
      if (mounted) {
        setState(() {
          _alerts[index] = alert;
        });
      }
    }
  }

  int get _unreadCount => _alerts.where((a) => !a.isRead).length;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('알림 센터'),
        backgroundColor: const Color(0xFF86A788),
        foregroundColor: Colors.white,
        actions: [
          if (!_isLoading && _alerts.isNotEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Text(
                  '미확인 $_unreadCount건',
                  style: const TextStyle(fontSize: 13, color: Colors.white70),
                ),
              ),
            ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF86A788)),
      );
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: Color(0xFFB85252)),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                style: const TextStyle(color: Color(0xFFB85252), fontSize: 15),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadAlerts,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF86A788),
                  foregroundColor: Colors.white,
                ),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
      );
    }

    if (_alerts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.notifications_none, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              '알림이 없습니다.',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _loadAlerts,
              child: const Text('새로 고침'),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadAlerts,
      color: const Color(0xFF86A788),
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(vertical: 8),
        itemCount: _alerts.length,
        itemBuilder: (context, index) {
          return _AlertTile(
            alert: _alerts[index],
            onTap: () => _markAsRead(index),
          );
        },
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  final AlertModel alert;
  final VoidCallback onTap;

  const _AlertTile({required this.alert, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final config = alertConfig(alert.type);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      color: alert.isRead ? Colors.white : config.bgColor,
      elevation: alert.isRead ? 1 : 3,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: alert.isRead
            ? BorderSide.none
            : BorderSide(color: config.iconColor.withValues(alpha: 0.4), width: 1),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                config.icon,
                color: alert.isRead ? Colors.grey : config.iconColor,
                size: 28,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            alert.title,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 15,
                              color: alert.isRead ? Colors.black54 : Colors.black87,
                            ),
                          ),
                        ),
                        if (!alert.isRead)
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: config.iconColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      alert.message,
                      style: TextStyle(
                        fontSize: 13,
                        color: alert.isRead ? Colors.grey : Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _formatTime(alert.createdAt),
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime(DateTime? dt) {
    if (dt == null) return '-';
    return '${dt.year}-${_pad(dt.month)}-${_pad(dt.day)} '
        '${_pad(dt.hour)}:${_pad(dt.minute)}';
  }

  String _pad(int n) => n.toString().padLeft(2, '0');
}

class AlertDisplayConfig {
  final IconData icon;
  final Color iconColor;
  final Color bgColor;

  const AlertDisplayConfig({
    required this.icon,
    required this.iconColor,
    required this.bgColor,
  });
}

AlertDisplayConfig alertConfig(String type) {
  switch (type) {
    case 'SOS':
      return AlertDisplayConfig(
        icon: Icons.warning_amber_rounded,
        iconColor: const Color(0xFFB85252),
        bgColor: const Color(0xFFF5EAEA),
      );
    case 'SOS_CANCEL':
      return AlertDisplayConfig(
        icon: Icons.cancel,
        iconColor: Colors.orange,
        bgColor: Colors.orange.shade50,
      );
    case 'FALL_DETECTED':
      return AlertDisplayConfig(
        icon: Icons.personal_injury,
        iconColor: Colors.deepOrange,
        bgColor: Colors.deepOrange.shade50,
      );
    case 'SAFE_ZONE':
      return AlertDisplayConfig(
        icon: Icons.location_off,
        iconColor: Colors.purple,
        bgColor: Colors.purple.shade50,
      );
    case 'CALL_REQUEST':
      return AlertDisplayConfig(
        icon: Icons.phone_callback,
        iconColor: Colors.green,
        bgColor: Colors.green.shade50,
      );
    case 'MEDICINE':
      return AlertDisplayConfig(
        icon: Icons.medication,
        iconColor: Colors.teal,
        bgColor: Colors.teal.shade50,
      );
    case 'INFO_UPDATE_REQUEST':
    case 'WELFARE_CONSULT_REQUEST':
      return AlertDisplayConfig(
        icon: Icons.info_outline,
        iconColor: Colors.blue,
        bgColor: Colors.blue.shade50,
      );
    case 'FACE_MATCH':
    case 'PERSON_DETECTED':
    case 'FALL_RISK':
      return AlertDisplayConfig(
        icon: Icons.videocam,
        iconColor: Colors.indigo,
        bgColor: Colors.indigo.shade50,
      );
    default:
      return AlertDisplayConfig(
        icon: Icons.notifications,
        iconColor: Colors.grey,
        bgColor: Colors.grey.shade50,
      );
  }
}
