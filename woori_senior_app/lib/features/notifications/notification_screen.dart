import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';
import '../settings/settings_screen.dart';

typedef ActionRegistrar = void Function({
  required VoidCallback action,
  required IconData icon,
  required String tooltip,
});

class NotificationScreen extends StatefulWidget {
  const NotificationScreen({
    super.key,
    required this.seniorId,
    this.hideAppBar = false,
    this.onRegisterAction,
    this.typeFilter,
  });

  final int seniorId;
  final bool hideAppBar;
  final ActionRegistrar? onRegisterAction;
  /// null 이면 전체 알림, 값이 있으면 해당 type 만 표시 (예: 'MEDICINE')
  final String? typeFilter;

  @override
  State<NotificationScreen> createState() => _NotificationScreenState();
}

class _NotificationScreenState extends State<NotificationScreen>
    with WidgetsBindingObserver {
  final _api = const SeniorApi();

  List<Map<String, dynamic>> _alerts = [];
  bool _loading = true;
  bool _refreshing = false;
  String? _error;
  Timer? _timer;
  int _tabIndex = 0; // 0=전체, 1=읽지않음, 2=읽음

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadAlerts();
    _timer = Timer.periodic(
        const Duration(seconds: 10), (_) => _loadAlerts(silent: true));
    widget.onRegisterAction?.call(
      action: _loadAlerts,
      icon: Icons.refresh,
      tooltip: '새로고침',
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadAlerts(silent: true);
    }
  }

  Future<void> _loadAlerts({bool silent = false}) async {
    if (_refreshing) return;
    if (!silent) {
      setState(() {
        _refreshing = true;
        _error = null;
      });
    }

    try {
      final data = await _api.fetchAlerts(widget.seniorId);
      var alerts = data
          .whereType<Map<String, dynamic>>()
          .map((alert) => Map<String, dynamic>.from(alert))
          .toList()
        ..sort((a, b) => _createdAt(b).compareTo(_createdAt(a)));

      if (widget.typeFilter != null) {
        alerts = alerts.where((a) => a['type'] == widget.typeFilter).toList();
      }

      if (!mounted) return;
      setState(() {
        _alerts = alerts;
        _loading = false;
        _refreshing = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _refreshing = false;
        _error = '알림을 불러오지 못했습니다.';
      });
    }
  }

  Future<void> _markRead(Map<String, dynamic> alert) async {
    final id = _alertId(alert);
    if (id == null || _isRead(alert)) return;

    setState(() => alert['isRead'] = true);
    try {
      await _api.readAlert(id);
    } catch (_) {
      if (!mounted) return;
      setState(() => alert['isRead'] = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('읽음 처리하지 못했습니다.')),
      );
    }
  }

  Future<void> _markAllRead() async {
    final unread = _alerts.where((alert) => !_isRead(alert)).toList();
    if (unread.isEmpty) return;

    for (final alert in unread) {
      final id = _alertId(alert);
      if (id != null) {
        alert['isRead'] = true;
        await _api.readAlert(id).catchError((_) {});
      }
    }

    if (!mounted) return;
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('모든 알림을 확인했습니다.')),
    );
  }

  Future<void> _replyToCheckIn(Map<String, dynamic> alert) async {
    final controller = TextEditingController();
    final reply = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text(
          '안부 답장',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _message(alert),
              style: const TextStyle(color: Color(0xFF344034), height: 1.4),
            ),
            const SizedBox(height: 14),
            TextField(
              controller: controller,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: '답장 내용',
                hintText: '예: 잘 지내고 있어요.',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('전송'),
          ),
        ],
      ),
    );
    controller.dispose();

    if (reply == null || reply.isEmpty) return;

    try {
      await _api.sendCheckInReply(
        seniorId: widget.seniorId,
        reply: reply,
        originalMessage: _message(alert),
      );
      await _markRead(alert);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('보호자에게 답장을 보냈습니다.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('답장 전송에 실패했습니다.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.hideAppBar) return _buildBody();

    return Scaffold(
      backgroundColor: const Color(0xFFFFFDEC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: Text(
            widget.typeFilter == 'MEDICINE' ? '복약 알림' : '알림',
            style: const TextStyle(fontWeight: FontWeight.w900)),
        actions: [
          IconButton(
            onPressed: _loadAlerts,
            icon: const Icon(Icons.refresh),
            tooltip: '새로고침',
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _EmptyState(
            icon: Icons.error_outline,
            title: _error!,
            message: '잠시 후 다시 시도해주세요.',
          ),
        ],
      );
    }

    if (_alerts.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _EmptyState(
            icon: Icons.notifications_none,
            title: '알림이 없습니다.',
            message: widget.typeFilter == 'MEDICINE'
                ? '복약 알림이 없어요.'
                : '보호자, 복지사, 기후, 낙상 알림이 이곳에 표시됩니다.',
          ),
        ],
      );
    }

    final unreadCount = _alerts.where((alert) => !_isRead(alert)).length;
    final readCount = _alerts.length - unreadCount;

    final filtered = _tabIndex == 1
        ? _alerts.where((a) => !_isRead(a)).toList()
        : _tabIndex == 2
            ? _alerts.where((a) => _isRead(a)).toList()
            : _alerts;

    return Column(
      children: [
        // ── 탭 ──────────────────────────────────────
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
          child: Row(
            children: [
              _SegTab(label: '전체', count: _alerts.length, selected: _tabIndex == 0, onTap: () => setState(() => _tabIndex = 0)),
              _SegTab(label: '읽지 않음', count: unreadCount, selected: _tabIndex == 1, onTap: () => setState(() => _tabIndex = 1)),
              _SegTab(label: '읽음', count: readCount, selected: _tabIndex == 2, onTap: () => setState(() => _tabIndex = 2)),
              const Spacer(),
              if (unreadCount > 0)
                TextButton(
                  onPressed: _markAllRead,
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF86A788),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    minimumSize: Size.zero,
                    textStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  child: const Text('모두 읽기'),
                ),
            ],
          ),
        ),
        const Divider(height: 1, color: Color(0xFFEEEEEE)),
        // ── 목록 ─────────────────────────────────────
        Expanded(
          child: filtered.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.notifications_none, size: 48, color: Colors.grey.shade400),
                      const SizedBox(height: 12),
                      Text(
                        _tabIndex == 1 ? '읽지 않은 알림이 없어요.' : _tabIndex == 2 ? '읽은 알림이 없어요.' : '알림이 없어요.',
                        style: TextStyle(color: Colors.grey.shade500, fontSize: 15),
                      ),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: filtered.length,
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _NotificationCard(
                      alert: filtered[i],
                      onRead: () => _markRead(filtered[i]),
                      onReply: filtered[i]['type'] == 'CHECK_IN_MESSAGE'
                          ? () => _replyToCheckIn(filtered[i])
                          : null,
                      onAction: filtered[i]['type'] == 'CONSENT_REQUEST'
                          ? () {
                              _markRead(filtered[i]);
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => SettingsScreen(seniorId: widget.seniorId),
                                ),
                              );
                            }
                          : null,
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}

class _SegTab extends StatelessWidget {
  const _SegTab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.only(right: 20),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.fromLTRB(0, 14, 0, 10),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: selected ? const Color(0xFF86A788) : Colors.transparent,
                width: 2.5,
              ),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  color: selected ? const Color(0xFF1F2A20) : const Color(0xFFAAAAAA),
                ),
              ),
              if (count > 0) ...[
                const SizedBox(width: 5),
                Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: selected ? const Color(0xFF86A788) : const Color(0xFFCCCCCC),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.total,
    required this.unread,
    required this.refreshing,
    required this.onMarkAllRead,
  });

  final int total;
  final int unread;
  final bool refreshing;
  final VoidCallback? onMarkAllRead;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE8E3C8)),
      ),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: const Color(0xFF86A788).withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(Icons.notifications_active,
                color: Color(0xFF86A788), size: 28),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '알림함',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 4),
                Text(
                  '전체 $total건 · 확인 필요 $unread건',
                  style: const TextStyle(color: Color(0xFF6D7568)),
                ),
              ],
            ),
          ),
          if (refreshing)
            const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            TextButton(
              onPressed: onMarkAllRead,
              child: const Text('전체 확인'),
            ),
        ],
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.alert,
    required this.onRead,
    this.onReply,
    this.onAction,
  });

  final Map<String, dynamic> alert;
  final VoidCallback onRead;
  final VoidCallback? onReply;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    final type = '${alert['type'] ?? ''}';
    final meta = _metaForType(type);
    final read = _isRead(alert);
    final imageUrl = _imageUrl(alert);

    return Opacity(
      opacity: read ? 0.55 : 1.0,
      child: InkWell(
        onTap: onRead,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          decoration: BoxDecoration(
            color: read
                ? const Color(0xFFF5F5F5)
                : meta.color.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: read
                  ? const Color(0xFFE0E0E0)
                  : meta.color.withValues(alpha: 0.35),
              width: read ? 1 : 1.5,
            ),
          ),
          child: IntrinsicHeight(
            child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 왼쪽 컬러 라인 (읽지 않은 경우만)
              if (!read)
                Container(
                  width: 5,
                  decoration: BoxDecoration(
                    color: meta.color,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(17),
                      bottomLeft: Radius.circular(17),
                    ),
                  ),
                ),
              Expanded(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(read ? 16 : 12, 16, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: meta.color.withValues(alpha: 0.13),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(meta.icon, color: meta.color, size: 24),
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
                                        _title(alert, meta.label),
                                        style: const TextStyle(
                                          fontSize: 17,
                                          fontWeight: FontWeight.w900,
                                        ),
                                      ),
                                    ),
                                    if (!read)
                                      Container(
                                        width: 9,
                                        height: 9,
                                        decoration: const BoxDecoration(
                                          color: Color(0xFFD94E4E),
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 5),
                                Text(
                                  meta.label,
                                  style: TextStyle(
                                    color: meta.color,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _message(alert),
                        style: const TextStyle(
                          color: Color(0xFF344034),
                          height: 1.45,
                          fontSize: 14.5,
                        ),
                      ),
                      if (imageUrl.isNotEmpty) ...[
                        const SizedBox(height: 12),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(
                            imageUrl,
                            height: 150,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              height: 84,
                              alignment: Alignment.center,
                              color: const Color(0xFFF4F0D8),
                              child: const Text('사진을 불러오지 못했습니다.'),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Icon(Icons.schedule,
                              size: 15, color: Colors.grey.shade600),
                          const SizedBox(width: 5),
                          Text(
                            _time(alert),
                            style: TextStyle(
                                color: Colors.grey.shade700, fontSize: 12),
                          ),
                          const Spacer(),
                          if (onAction != null && !read)
                            FilledButton(
                              onPressed: onAction,
                              child: const Text('설정하기'),
                            )
                          else if (onReply != null && !read)
                            FilledButton(
                              onPressed: onReply,
                              child: const Text('답장'),
                            )
                          else if (read)
                            const Text(
                              '확인됨',
                              style: TextStyle(
                                color: Color(0xFF86A788),
                                fontWeight: FontWeight.w800,
                              ),
                            )
                          else
                            FilledButton.tonal(
                              onPressed: onRead,
                              child: const Text('확인'),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          ),
        ),
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 48),
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE8E3C8)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 48, color: const Color(0xFF86A788)),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF6D7568), height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _AlertMeta {
  const _AlertMeta(this.label, this.icon, this.color);

  final String label;
  final IconData icon;
  final Color color;
}

_AlertMeta _metaForType(String type) {
  switch (type) {
    case 'SOS':
      return const _AlertMeta('긴급', Icons.sos, Color(0xFFD94E4E));
    case 'FALL_DETECTED':
    case 'FALL_RISK':
      return const _AlertMeta(
          '낙상', Icons.personal_injury_outlined, Color(0xFFD94E4E));
    case 'MEDICINE':
      return const _AlertMeta(
          '복약', Icons.medication_outlined, Color(0xFF5E7CE2));
    case 'CALL_REQUEST':
      return const _AlertMeta('전화 요청', Icons.call_outlined, Color(0xFF4F9CC9));
    case 'CHECK_IN_MESSAGE':
    case 'CHECK_IN_REPLY':
      return const _AlertMeta('안부', Icons.forum_outlined, Color(0xFF86A788));
    case 'INFO_UPDATE_REQUEST':
      return const _AlertMeta(
          '정보 요청', Icons.assignment_outlined, Color(0xFFB07A2A));
    case 'CLIMATE':
    case 'HEATWAVE':
    case 'COLDWAVE':
      return const _AlertMeta('기후', Icons.wb_sunny_outlined, Color(0xFFF0A500));
    case 'CONSENT_REQUEST':
      return const _AlertMeta(
          '동의 요청', Icons.assignment_turned_in_outlined, Color(0xFF86A788));
    default:
      return const _AlertMeta(
          '알림', Icons.notifications_outlined, Color(0xFF86A788));
  }
}

bool _isRead(Map<String, dynamic> alert) => alert['isRead'] == true;

int? _alertId(Map<String, dynamic> alert) {
  final id = alert['id'];
  if (id is int) return id;
  return int.tryParse('$id');
}

DateTime _createdAt(Map<String, dynamic> alert) {
  for (final key in ['createdAt', 'issuedAt', 'timestamp']) {
    final value = alert[key];
    if (value == null) continue;
    final parsed = DateTime.tryParse('$value');
    if (parsed != null) return parsed;
  }
  return DateTime.fromMillisecondsSinceEpoch(0);
}

String _time(Map<String, dynamic> alert) {
  final date = _createdAt(alert);
  if (date.millisecondsSinceEpoch == 0) return '';
  final local = date.toLocal();
  final month = local.month.toString().padLeft(2, '0');
  final day = local.day.toString().padLeft(2, '0');
  final hour = local.hour.toString().padLeft(2, '0');
  final minute = local.minute.toString().padLeft(2, '0');
  return '$month/$day $hour:$minute';
}

String _title(Map<String, dynamic> alert, String fallback) {
  final value = '${alert['title'] ?? ''}'.trim();
  return value.isEmpty || value == 'null' ? fallback : value;
}

String _message(Map<String, dynamic> alert) {
  final value = '${alert['message'] ?? ''}'.trim();
  return value.isEmpty || value == 'null' ? '확인이 필요한 알림입니다.' : value;
}

String _imageUrl(Map<String, dynamic> alert) {
  final value = '${alert['imageUrl'] ?? ''}'.trim();
  if (value.isEmpty || value == 'null') return '';
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  if (value.startsWith('/')) return '$apiBaseUrl$value';
  return '$apiBaseUrl/$value';
}
