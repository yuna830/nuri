import 'package:flutter/material.dart';

import '../../core/api/guardian_api.dart';
import '../../core/models/alert.dart';
import '../../core/storage/guardian_session_storage.dart';

class NotificationCenterScreen extends StatefulWidget {
  const NotificationCenterScreen({super.key});

  @override
  State<NotificationCenterScreen> createState() =>
      _NotificationCenterScreenState();
}

class _NotificationCenterScreenState extends State<NotificationCenterScreen> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();

  bool _isLoading = true;
  String? _errorMessage;
  List<AlertModel> _alerts = [];
  _AlertFilter _selectedFilter = _AlertFilter.all;
  final Set<int> _selectedAlertIds = {};
  final Set<int> _confirmedWhileUnreadTab = {};

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _selectedAlertIds.clear();
      _confirmedWhileUnreadTab.clear();
    });

    try {
      final userInfo = await _sessionStorage.getGuardianInfo();
      final guardianIdStr = userInfo['guardianId'];

      if (guardianIdStr == null || guardianIdStr.isEmpty) {
        throw Exception('보호자 세션 정보가 없습니다. 다시 로그인해 주세요.');
      }

      final guardianId = int.parse(guardianIdStr);
      final alerts = await _api.fetchGuardianAlerts(guardianId);

      if (!mounted) return;
      setState(() {
        _alerts = alerts;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
        _isLoading = false;
      });
    }
  }

  Future<void> _confirmAlert(AlertModel selectedAlert) async {
    if (selectedAlert.isRead) return;

    final index = _alerts.indexWhere((alert) => alert.id == selectedAlert.id);
    if (index == -1) return;

    final originalAlert = _alerts[index];

    setState(() {
      _alerts[index] = originalAlert.copyWith(isRead: true);
      if (_selectedFilter == _AlertFilter.unread) {
        _confirmedWhileUnreadTab.add(originalAlert.id);
      }
    });

    try {
      await _api.markAlertAsRead(originalAlert.id);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _alerts[index] = originalAlert;
        _confirmedWhileUnreadTab.remove(originalAlert.id);
      });
    }
  }

  Future<void> _deleteAllVisibleAlerts() async {
    final targets = _filteredAlerts;
    if (targets.isEmpty) return;

    final confirmed = await _confirmDelete(
      title: '전체 삭제',
      message: '현재 탭의 알림 ${targets.length}건을 모두 삭제할까요?',
    );
    if (confirmed != true) return;

    final ids = targets.map((alert) => alert.id).toList();

    try {
      await _api.deleteAlerts(ids);
      if (!mounted) return;
      setState(() {
        _alerts.removeWhere((alert) => ids.contains(alert.id));
        _selectedAlertIds.removeAll(ids);
        _confirmedWhileUnreadTab.removeAll(ids);
      });
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _deleteSelectedAlerts() async {
    if (_selectedAlertIds.isEmpty) {
      _showError('삭제할 알림을 선택해 주세요.');
      return;
    }

    final confirmed = await _confirmDelete(
      title: '선택 삭제',
      message: '선택한 알림 ${_selectedAlertIds.length}건을 삭제할까요?',
    );
    if (confirmed != true) return;

    final ids = _selectedAlertIds.toList();

    try {
      await _api.deleteAlerts(ids);
      if (!mounted) return;
      setState(() {
        _alerts.removeWhere((alert) => ids.contains(alert.id));
        _selectedAlertIds.clear();
        _confirmedWhileUnreadTab.removeAll(ids);
      });
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<bool?> _confirmDelete({
    required String title,
    required String message,
  }) {
    return showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('취소'),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text(
                '삭제',
                style: TextStyle(color: Color(0xFFB85252)),
              ),
            ),
          ],
        );
      },
    );
  }

  void _toggleSelection(AlertModel alert) {
    if (!alert.isRead) return;

    setState(() {
      if (_selectedAlertIds.contains(alert.id)) {
        _selectedAlertIds.remove(alert.id);
      } else {
        _selectedAlertIds.add(alert.id);
      }
    });
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFFB85252),
      ),
    );
  }

  int get _unreadCount => _alerts.where((alert) => !alert.isRead).length;

  List<AlertModel> get _filteredAlerts {
    return _alerts.where((alert) {
      switch (_selectedFilter) {
        case _AlertFilter.all:
          return true;
        case _AlertFilter.unread:
          return !alert.isRead || _confirmedWhileUnreadTab.contains(alert.id);
        case _AlertFilter.urgent:
          return alert.type == 'SOS' ||
              alert.type == 'SOS_CANCEL' ||
              alert.type == 'CALL_REQUEST' ||
              alert.type == 'CHECK_IN_REQUEST' ||
              alert.type == 'SAFE_ZONE_EXIT' ||
              alert.type == 'FALL_DETECTED' ||
              alert.type == 'FALL_RISK';
        case _AlertFilter.info:
          return alert.type == 'WELFARE_CONSULT_REQUEST' ||
              alert.type == 'FACE_MATCH' ||
              alert.type == 'PERSON_DETECTED' ||
              alert.type == 'INFO_UPDATE_REQUEST' ||
              alert.type == 'PROFILE_UPDATE_REQUEST' ||
              alert.type == 'PROFILE_UPDATE' ||
              alert.type == 'CONSENT_REQUEST' ||
              alert.type == 'CONSENT_CONFIRMED' ||
              alert.type == 'MEDICINE' ||
              alert.type == 'CHECK_IN_OK' ||
              alert.type == 'CHECK_IN_MESSAGE';
      }
    }).toList();
  }

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
                  '전체 ${_alerts.length}건',
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
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 48,
                color: Color(0xFFB85252),
              ),
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
            TextButton(onPressed: _loadAlerts, child: const Text('새로 고침')),
          ],
        ),
      );
    }

    final filteredAlerts = _filteredAlerts;

    return Column(
      children: [
        _NotificationActionHeader(
          selectedFilter: _selectedFilter,
          selectedCount: _selectedAlertIds.length,
          visibleCount: filteredAlerts.length,
          onFilterChanged: (filter) {
            setState(() {
              _selectedFilter = filter;
              _selectedAlertIds.clear();
              if (filter != _AlertFilter.unread) {
                _confirmedWhileUnreadTab.clear();
              }
            });
          },
          onDeleteAll: filteredAlerts.isEmpty ? null : _deleteAllVisibleAlerts,
          onDeleteSelected: _selectedAlertIds.isEmpty
              ? null
              : _deleteSelectedAlerts,
        ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadAlerts,
            color: const Color(0xFF86A788),
            child: filteredAlerts.isEmpty
                ? ListView(
                    children: [
                      const SizedBox(height: 120),
                      const Icon(
                        Icons.notifications_none,
                        size: 56,
                        color: Colors.grey,
                      ),
                      const SizedBox(height: 14),
                      Center(
                        child: Text(
                          '${_selectedFilter.label} 알림이 없습니다.',
                          style: const TextStyle(
                            fontSize: 15,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                    ],
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: filteredAlerts.length,
                    itemBuilder: (context, index) {
                      final alert = filteredAlerts[index];

                      return _AlertTile(
                        alert: alert,
                        isSelected: _selectedAlertIds.contains(alert.id),
                        onConfirm: () => _confirmAlert(alert),
                        onSelectionChanged: () => _toggleSelection(alert),
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

enum _AlertFilter {
  all('전체'),
  unread('미확인'),
  urgent('긴급'),
  info('정보');

  const _AlertFilter(this.label);

  final String label;
}

class _NotificationActionHeader extends StatelessWidget {
  const _NotificationActionHeader({
    required this.selectedFilter,
    required this.selectedCount,
    required this.visibleCount,
    required this.onFilterChanged,
    required this.onDeleteAll,
    required this.onDeleteSelected,
  });

  final _AlertFilter selectedFilter;
  final int selectedCount;
  final int visibleCount;
  final ValueChanged<_AlertFilter> onFilterChanged;
  final VoidCallback? onDeleteAll;
  final VoidCallback? onDeleteSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      padding: const EdgeInsets.only(left: 8, right: 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Color(0xFFE5E5EA), width: 0.6),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: _AlertFilter.values.map((filter) {
                final selected = selectedFilter == filter;

                return InkWell(
                  onTap: () => onFilterChanged(filter),
                  borderRadius: BorderRadius.circular(6),
                  child: SizedBox(
                    width: 48,
                    height: 46,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Center(
                            child: Text(
                              filter.label,
                              maxLines: 1,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: selected
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                                color: selected
                                    ? const Color(0xFF86A788)
                                    : const Color(0xFF6C6C70),
                              ),
                            ),
                          ),
                        ),
                        Container(
                          width: 28,
                          height: 3,
                          decoration: BoxDecoration(
                            color: selected
                                ? const Color(0xFF86A788)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          Text(
            selectedCount > 0 ? '$selectedCount개 선택' : '',
            style: const TextStyle(
              fontSize: 11,
              color: Color(0xFF8E8E93),
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 4),
          TextButton(
            onPressed: onDeleteAll,
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF6C6C70),
              disabledForegroundColor: const Color(
                0xFF6C6C70,
              ).withValues(alpha: 0.35),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              minimumSize: const Size(0, 30),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text(
              '전체 삭제',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
            ),
          ),
          TextButton(
            onPressed: onDeleteSelected,
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFFB85252),
              disabledForegroundColor: const Color(
                0xFFB85252,
              ).withValues(alpha: 0.35),
              padding: const EdgeInsets.symmetric(horizontal: 4),
              minimumSize: const Size(0, 30),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text(
              '선택 삭제',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  final AlertModel alert;
  final bool isSelected;
  final VoidCallback onConfirm;
  final VoidCallback onSelectionChanged;

  const _AlertTile({
    required this.alert,
    required this.isSelected,
    required this.onConfirm,
    required this.onSelectionChanged,
  });

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
            : BorderSide(
                color: config.iconColor.withValues(alpha: 0.4),
                width: 1,
              ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          alert.title,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                            color: alert.isRead
                                ? Colors.black54
                                : Colors.black87,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (alert.isRead)
                        SizedBox(
                          width: 28,
                          height: 28,
                          child: Checkbox(
                            value: isSelected,
                            onChanged: (_) => onSelectionChanged(),
                            activeColor: const Color(0xFF86A788),
                            visualDensity: VisualDensity.compact,
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          ),
                        )
                      else
                        TextButton(
                          onPressed: onConfirm,
                          style: TextButton.styleFrom(
                            foregroundColor: config.iconColor,
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            minimumSize: const Size(0, 28),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            '확인',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
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
      return const AlertDisplayConfig(
        icon: Icons.warning_amber_rounded,
        iconColor: Color(0xFFB85252),
        bgColor: Color(0xFFF5EAEA),
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
    case 'FALL_RISK':
      return AlertDisplayConfig(
        icon: Icons.videocam,
        iconColor: Colors.deepOrange,
        bgColor: Colors.deepOrange.shade50,
      );
    case 'SAFE_ZONE':
    case 'SAFE_ZONE_EXIT':
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
    case 'CHECK_IN_REQUEST':
      return AlertDisplayConfig(
        icon: Icons.health_and_safety_outlined,
        iconColor: Colors.redAccent,
        bgColor: Colors.redAccent.shade100.withValues(alpha: 0.18),
      );
    case 'CHECK_IN_OK':
    case 'CHECK_IN_MESSAGE':
      return AlertDisplayConfig(
        icon: Icons.task_alt,
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
    case 'PROFILE_UPDATE_REQUEST':
    case 'PROFILE_UPDATE':
    case 'CONSENT_REQUEST':
    case 'CONSENT_CONFIRMED':
      return AlertDisplayConfig(
        icon: Icons.info_outline,
        iconColor: Colors.blue,
        bgColor: Colors.blue.shade50,
      );
    case 'WELFARE_CONSULT_REQUEST':
      return AlertDisplayConfig(
        icon: Icons.support_agent,
        iconColor: Colors.blue,
        bgColor: Colors.blue.shade50,
      );
    case 'FACE_MATCH':
    case 'PERSON_DETECTED':
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
