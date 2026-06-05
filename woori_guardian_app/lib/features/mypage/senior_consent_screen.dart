import 'package:flutter/material.dart';
import '../../core/api/guardian_api.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';

// ── 색상 토큰 ──────────────────────────────────────────────────────────────────
const _kGreen = Color(0xFF86A788);
const _kGreenBg = Color(0xFFEBF8EE);
const _kBg = Colors.white;
const _kDiv = Color(0xFFE5E5EA);
const _kMain = Color(0xFF1C1C1E);
const _kSub = Color(0xFF6C6C70);
const _kHint = Color(0xFFAEAEB2);

// ── 동의 상태 ──────────────────────────────────────────────────────────────────
enum ConsentStatus { allowed, pending, denied, revoked }

extension ConsentStatusExt on ConsentStatus {
  String get label => switch (this) {
    ConsentStatus.allowed => '허용됨',
    ConsentStatus.pending => '요청 중',
    ConsentStatus.denied => '미동의',
    ConsentStatus.revoked => '철회됨',
  };

  Color get color => switch (this) {
    ConsentStatus.allowed => const Color(0xFF4A7A4C),
    ConsentStatus.pending => const Color(0xFF7A6800),
    ConsentStatus.denied => const Color(0xFF9A6060),
    ConsentStatus.revoked => const Color(0xFF9A6060),
  };

  Color get bgColor => switch (this) {
    ConsentStatus.allowed => const Color(0xFFEEF5EE),
    ConsentStatus.pending => const Color(0xFFFFF8E1),
    ConsentStatus.denied => const Color(0xFFF5EEEE),
    ConsentStatus.revoked => const Color(0xFFF5EEEE),
  };
}

// ── 동의 항목 정의 ─────────────────────────────────────────────────────────────
class _ConsentItem {
  final String key;
  final String label;
  final String desc;
  final IconData icon;
  ConsentStatus status;

  _ConsentItem({
    required this.key,
    required this.label,
    required this.desc,
    required this.icon,
    required this.status,
  });
}

List<_ConsentItem> _defaultItems() => [
  _ConsentItem(
    key: 'privacy',
    label: '개인정보 동의 요청',
    desc: '보호자가 대상자의 기본 개인정보를 확인할 수 있도록 요청합니다.',
    icon: Icons.privacy_tip_outlined,
    status: ConsentStatus.denied,
  ),
  _ConsentItem(
    key: 'location_share',
    label: '위치 공유 요청',
    desc: '마지막 위치와 이동 정보를 보호자가 확인할 수 있도록 요청합니다.',
    icon: Icons.location_on_outlined,
    status: ConsentStatus.denied,
  ),
  _ConsentItem(
    key: 'emergency_contact',
    label: '긴급 연락 권한',
    desc: 'SOS, 낙상, 위험 상황 발생 시 보호자가 긴급 연락을 받을 수 있도록 요청합니다.',
    icon: Icons.sos_outlined,
    status: ConsentStatus.denied,
  ),
  _ConsentItem(
    key: 'guardian_link',
    label: '보호 대상자 연결 요청',
    desc: '보호자가 대상자를 보호 목록에 추가하기 위한 연결 동의를 요청합니다.',
    icon: Icons.group_add_outlined,
    status: ConsentStatus.denied,
  ),
  _ConsentItem(
    key: 'safe_zone',
    label: '안전 구역 설정 동의',
    desc: '안전 구역 설정과 이탈 여부 확인에 대한 동의를 요청합니다.',
    icon: Icons.shield_outlined,
    status: ConsentStatus.denied,
  ),
  _ConsentItem(
    key: 'report_info',
    label: '신고 정보 사용 동의',
    desc: '실종/위험 신고 시 참고 정보를 사용할 수 있도록 요청합니다.',
    icon: Icons.assignment_outlined,
    status: ConsentStatus.denied,
  ),
  _ConsentItem(
    key: 'contact_share',
    label: '연락처 정보 제공 동의',
    desc: '사용자와 보호자 간 전화/문자 연결을 위한 연락처 제공 동의를 요청합니다.',
    icon: Icons.contact_phone_outlined,
    status: ConsentStatus.denied,
  ),
];

// ── 어르신별 동의 데이터 (mock — TODO: 백엔드 연동 시 API로 교체) ─────────────
final Map<int, List<_ConsentItem>> _mockConsentData = {};

List<_ConsentItem> _consentOf(int seniorId) {
  _mockConsentData.putIfAbsent(seniorId, _defaultItems);
  return _mockConsentData[seniorId]!;
}

// ── 대표 상태 계산 ─────────────────────────────────────────────────────────────
ConsentStatus _summaryStatus(List<_ConsentItem> items) {
  final statuses = items.map((e) => e.status).toSet();
  if (statuses.contains(ConsentStatus.revoked)) return ConsentStatus.revoked;
  if (statuses.length == 1 && statuses.first == ConsentStatus.allowed) {
    return ConsentStatus.allowed;
  }
  if (statuses.contains(ConsentStatus.pending)) return ConsentStatus.pending;
  if (statuses.contains(ConsentStatus.allowed)) return ConsentStatus.pending;
  return ConsentStatus.denied;
}

String _summaryText(List<_ConsentItem> items) {
  final allowed = items
      .where((e) => e.status == ConsentStatus.allowed)
      .map((e) => e.label)
      .toList();
  if (allowed.isEmpty) return '허용된 항목이 없습니다.';
  return '${allowed.take(3).join(', ')} 공유 허용';
}

// ── 메인 화면 ──────────────────────────────────────────────────────────────────
class SeniorConsentScreen extends StatefulWidget {
  const SeniorConsentScreen({super.key});

  @override
  State<SeniorConsentScreen> createState() => _SeniorConsentScreenState();
}

class _SeniorConsentScreenState extends State<SeniorConsentScreen> {
  final _api = GuardianApi();
  final _storage = GuardianSessionStorage();

  bool _loading = true;
  List<Senior> _seniors = [];
  String? _error;
  int? _guardianId;
  String _guardianName = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final info = await _storage.getGuardianInfo();
      final idStr = info['guardianId'];

      if (idStr == null || idStr.isEmpty) {
        throw Exception('세션 정보가 없습니다.');
      }

      final guardianId = int.parse(idStr);
      final seniors = await _api.fetchGuardianSeniors(guardianId);

      if (!mounted) return;

      setState(() {
        _guardianId = guardianId;
        _guardianName = info['name'] ?? '보호자';
        _seniors = seniors;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        title: const Text('대상자 정보 동의 관리'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kGreen))
          : _error != null
          ? _ErrorView(message: _error!, onRetry: _load)
          : _seniors.isEmpty
          ? const _EmptyView()
          : RefreshIndicator(
              onRefresh: _load,
              color: _kGreen,
              child: ListView(
                padding: const EdgeInsets.symmetric(
                  vertical: 16,
                  horizontal: 0,
                ),
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
                    child: Text(
                      '보호 대상자를 선택해 동의 현황을 확인하고 동의를 요청할 수 있습니다.',
                      style: const TextStyle(
                        fontSize: 13,
                        color: _kSub,
                        height: 1.5,
                      ),
                    ),
                  ),
                  for (int i = 0; i < _seniors.length; i++) ...[
                    if (i > 0) const Divider(height: 1, color: _kDiv),
                    _SeniorRow(
                      senior: _seniors[i],
                      guardianId: _guardianId!,
                      guardianName: _guardianName,
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

// ── 어르신 행 ──────────────────────────────────────────────────────────────────
class _SeniorRow extends StatelessWidget {
  final Senior senior;
  final int guardianId;
  final String guardianName;

  const _SeniorRow({
    required this.senior,
    required this.guardianId,
    required this.guardianName,
  });

  @override
  Widget build(BuildContext context) {
    final items = _consentOf(senior.id);
    final status = _summaryStatus(items);
    final summary = _summaryText(items);

    return ColoredBox(
      color: Colors.white,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 10,
        ),
        leading: CircleAvatar(
          radius: 22,
          backgroundColor: _kGreenBg,
          child: Text(
            senior.name.isNotEmpty ? senior.name[0] : '?',
            style: const TextStyle(
              color: _kGreen,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        title: Row(
          children: [
            Text(
              senior.name,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: _kMain,
              ),
            ),
            if (senior.age != null) ...[
              const SizedBox(width: 6),
              Text(
                '${senior.age}세',
                style: const TextStyle(fontSize: 13, color: _kSub),
              ),
            ],
            const SizedBox(width: 8),
            _StatusBadge(status),
          ],
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            summary,
            style: const TextStyle(fontSize: 12, color: _kHint),
          ),
        ),
        trailing: const Icon(Icons.chevron_right, color: _kHint, size: 20),
        onTap: () =>
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => SeniorConsentDetailScreen(
                  senior: senior,
                  guardianId: guardianId,
                  guardianName: guardianName,
                ),
              ),
            ).then((_) {
              // 복귀 시 목록 갱신
              if (context.mounted) (context as Element).markNeedsBuild();
            }),
      ),
    );
  }
}

// ── 동의 상세 화면 ─────────────────────────────────────────────────────────────
class SeniorConsentDetailScreen extends StatefulWidget {
  final Senior senior;
  final int guardianId;
  final String guardianName;

  const SeniorConsentDetailScreen({
    super.key,
    required this.senior,
    required this.guardianId,
    required this.guardianName,
  });

  @override
  State<SeniorConsentDetailScreen> createState() =>
      _SeniorConsentDetailScreenState();
}

class _SeniorConsentDetailScreenState extends State<SeniorConsentDetailScreen> {
  final _api = GuardianApi();
  
  late List<_ConsentItem> _items;

  @override
  void initState() {
    super.initState();
    // TODO: 백엔드 연동 시 API에서 어르신별 동의 목록 조회
    _items = _consentOf(widget.senior.id);
  }

  Future<void> _requestAll() async {
    final requestItems = _items
        .where((item) => item.status != ConsentStatus.allowed)
        .map((item) => item.label)
        .toList();

    if (requestItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('요청할 미동의 항목이 없습니다.')),
      );
      return;
    }

    try {
      await _api.sendConsentRequest(
        guardianId: widget.guardianId,
        seniorId: widget.senior.id,
        guardianName: widget.guardianName,
        items: requestItems,
      );

      setState(() {
        for (final item in _items) {
          if (item.status != ConsentStatus.allowed) {
            item.status = ConsentStatus.pending;
          }
        }
      });

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('동의 요청 알림을 전송했습니다.')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        title: Text('${widget.senior.name} 동의 현황'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 16),
              children: [
                // 동의 항목 리스트
                for (int i = 0; i < _items.length; i++) ...[
                  if (i > 0) const Divider(height: 1, indent: 56, color: _kDiv),
                  _ConsentRow(item: _items[i]),
                ],

                const SizedBox(height: 24),

                // 안내 문구
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(
                    '정보 공유 동의는 어르신이 직접 수락 또는 거절합니다.\n보호자는 필요한 항목에 대해 동의 요청만 보낼 수 있습니다.',
                    style: const TextStyle(
                      fontSize: 12,
                      color: _kHint,
                      height: 1.6,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 하단 버튼 영역
          _BottomButtons(onRequestAll: _requestAll),
        ],
      ),
    );
  }
}

// ── 동의 항목 행 ────────────────────────────────────────────────────────────────
class _ConsentRow extends StatelessWidget {
  final _ConsentItem item;
  const _ConsentRow({required this.item});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Icon(item.icon, size: 22, color: _kSub),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: _kMain,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.desc,
                    style: const TextStyle(
                      fontSize: 12,
                      color: _kSub,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            _StatusBadge(item.status),
          ],
        ),
      ),
    );
  }
}

// ── 하단 버튼 ──────────────────────────────────────────────────────────────────
class _BottomButtons extends StatelessWidget {
  final VoidCallback onRequestAll;

  const _BottomButtons({required this.onRequestAll});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(
        16,
        12,
        16,
        MediaQuery.of(context).padding.bottom + 12,
      ),
      child: FilledButton(
        onPressed: onRequestAll,
        style: FilledButton.styleFrom(
          backgroundColor: _kGreen,
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: const Text(
          '동의 요청 보내기',
          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}

// ── 상태 배지 ──────────────────────────────────────────────────────────────────
class _StatusBadge extends StatelessWidget {
  final ConsentStatus status;
  final bool large;
  const _StatusBadge(this.status, {this.large = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: large ? 10 : 8,
        vertical: large ? 4 : 3,
      ),
      decoration: BoxDecoration(
        color: status.bgColor,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          fontSize: large ? 13 : 11,
          fontWeight: FontWeight.w600,
          color: status.color,
        ),
      ),
    );
  }
}

// ── 에러/빈 상태 ───────────────────────────────────────────────────────────────
class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorView({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          message,
          style: const TextStyle(color: _kSub),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: onRetry,
          style: FilledButton.styleFrom(backgroundColor: _kGreen),
          child: const Text('다시 시도'),
        ),
      ],
    ),
  );
}

class _EmptyView extends StatelessWidget {
  const _EmptyView();

  @override
  Widget build(BuildContext context) => const Center(
    child: Text('등록된 보호 대상자가 없습니다.', style: TextStyle(color: _kSub)),
  );
}
