import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api/guardian_api.dart';
import '../../core/models/alert.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';
import '../../core/theme/app_colors.dart';

const _kGreen = AppColors.green;
const _kRed = AppColors.red;
const _kSafe = AppColors.safe;
const _kSafeBg = AppColors.safeBg;
const _kWarn = AppColors.warn;
const _kWarnBg = AppColors.warnBg;
const _kNeutral = AppColors.neutral;
const _kNeutralBg = AppColors.neutralBg;
const _kTextMain = AppColors.textMain;
const _kTextSub = AppColors.textSub;
const _kTextHint = AppColors.textHint;
const _kDivider = AppColors.divider;

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
  Map<int, Senior> _seniorMap = {};
  _AlertFilter _selectedFilter = _AlertFilter.all;
  final Set<int> _selectedAlertIds = {};
  final Set<int> _confirmedWhileUnreadTab = {};
  int? _guardianId;
  int? _selectedSeniorId;

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

      final results = await Future.wait([
        _api.fetchGuardianAlerts(guardianId),
        _api.fetchGuardianSeniors(guardianId),
      ]);

      final alerts = results[0] as List<AlertModel>;
      final seniors = results[1] as List<Senior>;

      if (!mounted) return;
      setState(() {
        _guardianId = guardianId;
        _alerts = alerts;
        _seniorMap = {for (final s in seniors) s.id: s};
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

  // ── 알림 읽음 처리 ────────────────────────────────────────────────────
  Future<void> _confirmAlert(AlertModel alert) async {
    if (alert.isRead) return;

    final index = _alerts.indexWhere((a) => a.id == alert.id);
    if (index == -1) return;

    final original = _alerts[index];
    setState(() {
      _alerts[index] = original.copyWith(isRead: true);
      if (_selectedFilter == _AlertFilter.unread) {
        _confirmedWhileUnreadTab.add(original.id);
      }
    });

    try {
      await _api.markAlertAsRead(original.id);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _alerts[index] = original;
        _confirmedWhileUnreadTab.remove(original.id);
      });
    }
  }

  // ── 전화 걸기 ─────────────────────────────────────────────────────────
  Future<void> _callPhone(String phone) async {
    final digits = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.isEmpty) {
      _showError('전화번호 정보가 없습니다.');
      return;
    }
    final uri = Uri(scheme: 'tel', path: digits);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      _showError('전화를 걸 수 없습니다.');
    }
  }

  // ── 안부 확인 요청: 이상 없음 (웹의 handleCheckInOk와 동일) ────────────
  Future<void> _checkInOk(AlertModel alert) async {
    final senior = alert.seniorId != null ? _seniorMap[alert.seniorId] : null;
    final seniorName = senior?.name ?? '사용자';
    final displayName = seniorName.endsWith('님') ? seniorName : '$seniorName님';

    try {
      await _api.sendCheckInReply(
        seniorId: alert.seniorId!,
        guardianId: _guardianId!,
        reply: '${displayName}께서 안부 확인 결과 이상 없습니다.',
        originalMessage: alert.message,
      );
      await _confirmAlert(alert);
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('복지사에게 이상 없음 알림을 보냈습니다.')));
      }
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  // ── SOS/낙상 전화 확인 모달 (웹의 isCallResultOpen 모달과 동일) ─────
  void _showCallModal(AlertModel alert) {
    final senior = alert.seniorId != null ? _seniorMap[alert.seniorId] : null;
    final phone = senior?.phone ?? '';
    final seniorName = senior?.name ?? '사용자';

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          24,
          20,
          MediaQuery.of(ctx).padding.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$seniorName님에게 연락하기',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              alert.message,
              style: const TextStyle(fontSize: 13, color: Color(0xFF6C6C70)),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      await _callPhone('119');
                    },
                    icon: const Icon(Icons.local_hospital_outlined, size: 16),
                    label: const Text('119 신고'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _kRed,
                      side: const BorderSide(color: _kRed),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: phone.isEmpty
                        ? null
                        : () async {
                            Navigator.pop(ctx);
                            await _callPhone(phone);
                            await _confirmAlert(alert);
                          },
                    icon: const Icon(Icons.phone_outlined, size: 16),
                    label: const Text('연락하기'),
                    style: FilledButton.styleFrom(
                      backgroundColor: _kGreen,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── 복지사 상담: 즉시 / 일정 잡기 모달 (웹의 상담 선택 모달과 동일) ──
  void _showConsultModal(AlertModel alert) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          24,
          20,
          MediaQuery.of(ctx).padding.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              '복지사 상담 요청',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              alert.message,
              style: const TextStyle(fontSize: 13, color: Color(0xFF6C6C70)),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await _respondConsultNow(alert);
                },
                icon: const Icon(Icons.chat_bubble_outline, size: 16),
                label: const Text('즉시 상담 가능'),
                style: FilledButton.styleFrom(
                  backgroundColor: _kGreen,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () async {
                  Navigator.pop(ctx);
                  await _respondConsultSchedule(alert);
                },
                icon: const Icon(Icons.calendar_today_outlined, size: 16),
                label: const Text('날짜 / 시간 선택'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF7A6800),
                  side: const BorderSide(color: Color(0xFF7A6800)),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _respondConsultNow(AlertModel alert) async {
    try {
      await _api.respondWelfareConsult(alertId: alert.id, responseType: '즉시');
      await _confirmAlert(alert);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('즉시 상담 가능하다고 복지사에게 전달했습니다.')),
        );
      }
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _respondConsultSchedule(AlertModel alert) async {
    final result =
        await showModalBottomSheet<({DateTime date, TimeOfDay time})>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => const _ConsultScheduleSheet(),
        );
    if (result == null || !mounted) return;

    final scheduleAt =
        '${result.date.year}-${_pad(result.date.month)}-${_pad(result.date.day)} '
        '${_pad(result.time.hour)}:${_pad(result.time.minute)}';

    try {
      await _api.respondWelfareConsult(
        alertId: alert.id,
        responseType: '예약',
        scheduleAt: scheduleAt,
      );
      await _confirmAlert(alert);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$scheduleAt 상담 일정을 복지사에게 전달했습니다.')),
        );
      }
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  String _pad(int n) => n.toString().padLeft(2, '0');

  // ── 삭제 ─────────────────────────────────────────────────────────────
  Future<void> _deleteAllVisibleAlerts() async {
    final targets = _filteredAlerts;
    if (targets.isEmpty) return;
    final confirmed = await _confirmDelete(
      title: '전체 삭제',
      message: '현재 탭의 알림 ${targets.length}건을 모두 삭제할까요?',
    );
    if (confirmed != true) return;
    final ids = targets.map((a) => a.id).toList();
    try {
      await _api.deleteAlerts(ids);
      if (!mounted) return;
      setState(() {
        _alerts.removeWhere((a) => ids.contains(a.id));
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
        _alerts.removeWhere((a) => ids.contains(a.id));
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
      builder: (context) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: _kTextMain,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                message,
                style: const TextStyle(fontSize: 13, color: _kTextSub),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFF6F5F3),
                        foregroundColor: _kTextSub,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('취소', style: TextStyle(fontSize: 13)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: _kRed,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text(
                        '삭제',
                        style: TextStyle(fontSize: 13, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _toggleSelection(AlertModel alert) {
    if (!alert.isRead) return; // 미읽음은 선택 불가
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
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message), backgroundColor: _kRed));
  }

  List<AlertModel> get _filteredAlerts {
    return _alerts.where((alert) {
      // 시니어 필터
      if (_selectedSeniorId != null && alert.seniorId != _selectedSeniorId) {
        return false;
      }
      switch (_selectedFilter) {
        case _AlertFilter.all:
          return true;
        case _AlertFilter.unread:
          return !alert.isRead || _confirmedWhileUnreadTab.contains(alert.id);
        case _AlertFilter.urgent:
          return const {
            'SOS',
            'SOS_CANCEL',
            'CALL_REQUEST',
            'CHECK_IN_REQUEST',
            'SAFE_ZONE_EXIT',
            'FALL_DETECTED',
            'FALL_RISK',
          }.contains(alert.type);
        case _AlertFilter.info:
          return const {
            'WELFARE_CONSULT_REQUEST',
            'FACE_MATCH',
            'PERSON_DETECTED',
            'INFO_UPDATE_REQUEST',
            'PROFILE_UPDATE_REQUEST',
            'PROFILE_UPDATE',
            'CONSENT_REQUEST',
            'CONSENT_CONFIRMED',
            'MEDICINE',
            'CHECK_IN_OK',
            'CHECK_IN_MESSAGE',
          }.contains(alert.type);
      }
    }).toList();
  }

  // ── 웹과 동일한 알림별 액션 빌드 ───────────────────────────────────────
  List<_AlertAction> _buildActions(AlertModel alert) {
    confirm() => _confirmAlert(alert);

    switch (alert.type) {
      // SOS / 낙상 / 안전구역 이탈 → 전화 버튼 (모달로 119신고/연락하기 선택)
      case 'SOS':
      case 'FALL_DETECTED':
      case 'FALL_RISK':
      case 'SAFE_ZONE_EXIT':
        return [
          _AlertAction(
            label: '전화',
            icon: Icons.phone_outlined,
            color: _kRed,
            primary: true,
            onTap: () => _showCallModal(alert),
          ),
          _AlertAction(label: '확인', color: Colors.grey, onTap: confirm),
        ];

      // SOS 취소
      case 'SOS_CANCEL':
        return [_AlertAction(label: '확인', color: _kGreen, onTap: confirm)];

      // 전화 요청 → 바로 전화 + 확인
      case 'CALL_REQUEST':
        final phone = alert.seniorId != null
            ? (_seniorMap[alert.seniorId]?.phone ?? '')
            : '';
        return [
          _AlertAction(
            label: '전화하기',
            icon: Icons.phone_outlined,
            color: _kGreen,
            primary: true,
            onTap: () async {
              await _callPhone(phone);
              await confirm();
            },
          ),
          _AlertAction(label: '확인', color: Colors.grey, onTap: confirm),
        ];

      // 안부 확인 요청 → 이상 없음 (복지사 자동 알림) + 확인
      case 'CHECK_IN_REQUEST':
        return [
          _AlertAction(
            label: '이상 없음',
            icon: Icons.check_circle_outline,
            color: _kGreen,
            primary: true,
            onTap: () => _checkInOk(alert),
          ),
          _AlertAction(label: '확인', color: Colors.grey, onTap: confirm),
        ];

      // 복지사 상담 요청 → 상담 선택 모달 (즉시 / 일정)
      case 'WELFARE_CONSULT_REQUEST':
        return [
          _AlertAction(
            label: '상담 선택',
            icon: Icons.support_agent_outlined,
            color: Colors.indigo,
            primary: true,
            onTap: () => _showConsultModal(alert),
          ),
          _AlertAction(
            label: '나중에',
            icon: Icons.notifications_paused_outlined,
            color: Colors.grey,
            onTap: confirm,
          ),
        ];

      // 기본 (정보성 알림)
      default:
        return [_AlertAction(label: '확인', color: _kGreen, onTap: confirm)];
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('알림 센터'),
        backgroundColor: _kGreen,
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
      return const Center(child: CircularProgressIndicator(color: _kGreen));
    }

    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 48, color: _kRed),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                style: const TextStyle(color: _kRed, fontSize: 15),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadAlerts,
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kGreen,
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
        if (_seniorMap.isNotEmpty)
          _SeniorFilterBar(
            seniors: _seniorMap.values.toList(),
            selectedSeniorId: _selectedSeniorId,
            onChanged: (id) {
              setState(() {
                _selectedSeniorId = id;
                _selectedAlertIds.clear();
              });
            },
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadAlerts,
            color: _kGreen,
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
                      // 변경 후
                      return _AlertTile(
                        alert: alert,
                        isSelected: _selectedAlertIds.contains(alert.id),
                        actions: _buildActions(alert),
                        onSelectionChanged: () => _toggleSelection(alert),
                        onScheduleTap:
                            (!alert.isRead &&
                                alert.type == 'WELFARE_CONSULT_REQUEST')
                            ? () => _respondConsultSchedule(alert)
                            : null,
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

// ── 액션 정의 ─────────────────────────────────────────────────────────────
class _AlertAction {
  final String label;
  final IconData? icon;
  final Color color;
  final bool primary;
  final VoidCallback onTap;

  const _AlertAction({
    required this.label,
    this.icon,
    required this.color,
    this.primary = false,
    required this.onTap,
  });
}

// ── 필터 ──────────────────────────────────────────────────────────────────
enum _AlertFilter {
  all('전체'),
  unread('미확인'),
  urgent('긴급'),
  info('정보');

  const _AlertFilter(this.label);
  final String label;
}

// ── 헤더 ──────────────────────────────────────────────────────────────────
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
                                    ? AppColors.green
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
                                ? AppColors.green
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
              foregroundColor: _kRed,
              disabledForegroundColor: _kRed.withValues(alpha: 0.35),
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

// ── 알림 카드 ──────────────────────────────────────────────────────────────
class _AlertTile extends StatelessWidget {
  final AlertModel alert;
  final bool isSelected;
  final List<_AlertAction> actions;
  final VoidCallback onSelectionChanged;
  final VoidCallback? onScheduleTap;

  const _AlertTile({
    required this.alert,
    required this.isSelected,
    required this.actions,
    required this.onSelectionChanged,
    this.onScheduleTap,
  });

  @override
  Widget build(BuildContext context) {
    final config = alertConfig(alert.type);
    final isRead = alert.isRead;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      color: isRead ? Colors.white : config.bgColor,
      elevation: isRead ? 1 : 3,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: isRead
            ? BorderSide.none
            : BorderSide(
                color: config.iconColor.withValues(alpha: 0.4),
                width: 1,
              ),
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 왼쪽: 아이콘
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Icon(
                config.icon,
                color: isRead ? Colors.grey : config.iconColor,
                size: 24,
              ),
            ),
            const SizedBox(width: 12),

            // 가운데+오른쪽 전체
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 제목 + (버튼 1개이거나 읽음이면 오른쪽에 표시)
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          alert.title,
                          style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                            color: isRead ? Colors.black54 : Colors.black87,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      if (isRead)
                        SizedBox(
                          width: 28,
                          height: 28,
                          child: Checkbox(
                            value: isSelected,
                            onChanged: (_) => onSelectionChanged(),
                            activeColor: _kGreen,
                            visualDensity: VisualDensity.compact,
                            materialTapTargetSize:
                                MaterialTapTargetSize.shrinkWrap,
                          ),
                        )
                      else if (actions.isNotEmpty)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            for (final action in actions) ...[
                              _buildActionButton(action),
                              if (action != actions.last)
                                const SizedBox(width: 2),
                            ],
                          ],
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    alert.message,
                    style: TextStyle(
                      fontSize: 13,
                      color: isRead ? Colors.grey : Colors.black87,
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

  Widget _buildActionButton(_AlertAction action) {
    final label = Text(
      action.label,
      style: TextStyle(
        fontSize: 12,
        // 주요 버튼은 더 굵게 해서 텍스트만으로도 구분되게
        fontWeight: action.primary ? FontWeight.w800 : FontWeight.w600,
      ),
    );
    final textStyle = TextButton.styleFrom(
      foregroundColor: action.color,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      minimumSize: const Size(0, 30),
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
    );

    if (action.icon != null) {
      return TextButton.icon(
        onPressed: action.onTap,
        icon: Icon(action.icon, size: 13),
        label: label,
        style: textStyle,
      );
    }
    return TextButton(onPressed: action.onTap, style: textStyle, child: label);
  }

  String _formatTime(DateTime? dt) {
    if (dt == null) return '-';
    return '${dt.year}-${_pad(dt.month)}-${_pad(dt.day)} '
        '${_pad(dt.hour)}:${_pad(dt.minute)}';
  }

  String _pad(int n) => n.toString().padLeft(2, '0');
}

// ── 알림 타입별 스타일 ─────────────────────────────────────────────────────
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

// ── 긴급/일반 구분 상수 ─────────────────────────────────────────────
const _kUrgentTypes = {
  'SOS',
  'UNANSWERED_SOS',
  'FALL_DETECTED',
  'FALL_RISK',
  'SAFE_ZONE_EXIT',
  'CHECK_IN_REQUEST',
};

// ── 타입별 아이콘 (색은 alertConfig에서 통합 관리) ──────────────────
IconData _alertIcon(String type) {
  switch (type) {
    case 'SOS':
    case 'UNANSWERED_SOS':
      return Icons.warning_amber_rounded;
    case 'SOS_CANCEL':
      return Icons.cancel;
    case 'FALL_DETECTED':
    case 'FALL_RISK':
      return Icons.personal_injury;
    case 'SAFE_ZONE':
    case 'SAFE_ZONE_EXIT':
      return Icons.location_off;
    case 'CALL_REQUEST':
      return Icons.phone_callback;
    case 'CHECK_IN_REQUEST':
      return Icons.health_and_safety_outlined;
    case 'CHECK_IN_OK':
    case 'CHECK_IN_MESSAGE':
      return Icons.task_alt;
    case 'MEDICINE':
      return Icons.medication;
    case 'INFO_UPDATE_REQUEST':
    case 'PROFILE_UPDATE_REQUEST':
    case 'PROFILE_UPDATE':
    case 'CONSENT_REQUEST':
    case 'CONSENT_CONFIRMED':
      return Icons.info_outline;
    case 'WELFARE_CONSULT_REQUEST':
      return Icons.support_agent;
    case 'FACE_MATCH':
    case 'PERSON_DETECTED':
      return Icons.videocam;
    default:
      return Icons.notifications;
  }
}

AlertDisplayConfig alertConfig(String type) {
  final isUrgent = _kUrgentTypes.contains(type);
  return AlertDisplayConfig(
    icon: _alertIcon(type),
    iconColor: isUrgent ? const Color(0xFFB85252) : const Color(0xFF9E9E9E),
    bgColor: isUrgent ? const Color(0xFFF5EAEA) : const Color(0xFFF3F4F6),
  );
}

// ── 상담 일정 선택 바텀시트 ──────────────────────────────────────────────
class _ConsultScheduleSheet extends StatefulWidget {
  const _ConsultScheduleSheet();

  @override
  State<_ConsultScheduleSheet> createState() => _ConsultScheduleSheetState();
}

class _ConsultScheduleSheetState extends State<_ConsultScheduleSheet> {
  late DateTime _date;
  int _hour = 10;
  int _minute = 0;

  @override
  void initState() {
    super.initState();
    _date = DateTime.now().add(const Duration(days: 1));
  }

  String get _dateLabel => '${_date.year}년 ${_date.month}월 ${_date.day}일';

  String get _timeLabel =>
      '${_hour.toString().padLeft(2, '0')}:${_minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: EdgeInsets.fromLTRB(
        0,
        12,
        0,
        MediaQuery.of(context).padding.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // 드래그 핸들
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(99),
            ),
          ),

          // 제목
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                Text(
                  '상담 일정 선택',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

          const SizedBox(height: 4),

          // 캘린더 (CalendarDatePicker 직접 삽입)
          SizedBox(
            height: 260,
            child: Theme(
              data: Theme.of(context).copyWith(
                colorScheme: const ColorScheme.light(primary: _kGreen),
              ),
              child: CalendarDatePicker(
                initialDate: _date,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 60)),
                onDateChanged: (date) => setState(() => _date = date),
              ),
            ),
          ),

          const Divider(height: 1),
          const SizedBox(height: 12),

          // 시간 선택 행
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Text(
                  '시간',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1C1C1E),
                  ),
                ),
                const Spacer(),
                _PickerDropdown(
                  value: _hour,
                  items: List.generate(24, (i) => i),
                  label: (v) => '${v}시',
                  onChanged: (v) => setState(() => _hour = v),
                ),
                const SizedBox(width: 8),
                _PickerDropdown(
                  value: _minute,
                  items: [0, 10, 20, 30, 40, 50],
                  label: (v) => '${v.toString().padLeft(2, '0')}분',
                  onChanged: (v) => setState(() => _minute = v),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // 확정 버튼
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: FilledButton(
              onPressed: () => Navigator.pop(context, (
                date: _date,
                time: TimeOfDay(hour: _hour, minute: _minute),
              )),
              style: FilledButton.styleFrom(
                backgroundColor: _kGreen,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                '$_dateLabel  $_timeLabel 확정',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── 시니어 필터 바 ────────────────────────────────────────────────────────
class _SeniorFilterBar extends StatelessWidget {
  const _SeniorFilterBar({
    required this.seniors,
    required this.selectedSeniorId,
    required this.onChanged,
  });

  final List<Senior> seniors;
  final int? selectedSeniorId;
  final ValueChanged<int?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(
          bottom: BorderSide(color: Color(0xFFE5E5EA), width: 0.6),
        ),
      ),
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        children: [
          _chip('전체', selectedSeniorId == null, () => onChanged(null)),
          ...seniors.map(
            (s) =>
                _chip(s.name, selectedSeniorId == s.id, () => onChanged(s.id)),
          ),
        ],
      ),
    );
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: selected ? _kGreen : const Color(0xFFF3F4F6),
            borderRadius: BorderRadius.circular(20),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : const Color(0xFF6C6C70),
            ),
          ),
        ),
      ),
    );
  }
}

// ── 시간 드롭다운 ─────────────────────────────────────────────────────────
class _PickerDropdown extends StatelessWidget {
  final int value;
  final List<int> items;
  final String Function(int) label;
  final ValueChanged<int> onChanged;

  const _PickerDropdown({
    required this.value,
    required this.items,
    required this.label,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFE5E5EA)),
        borderRadius: BorderRadius.circular(8),
        color: const Color(0xFFF9F9F9),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: value,
          isDense: true,
          items: items
              .map(
                (v) => DropdownMenuItem(
                  value: v,
                  child: Text(
                    label(v),
                    style: const TextStyle(
                      fontSize: 14,
                      color: Color(0xFF1C1C1E),
                    ),
                  ),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
    );
  }
}
