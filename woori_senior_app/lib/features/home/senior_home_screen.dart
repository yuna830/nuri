import 'package:flutter/material.dart';

import '../../core/api/senior_api.dart';

class SeniorHomeScreen extends StatefulWidget {
  const SeniorHomeScreen({super.key, required this.seniorId});

  final int seniorId;

  @override
  State<SeniorHomeScreen> createState() => _SeniorHomeScreenState();
}

class _SeniorHomeScreenState extends State<SeniorHomeScreen> {
  final SeniorApi _api = const SeniorApi();
  late Future<SeniorHomeData> _homeDataFuture;

  @override
  void initState() {
    super.initState();
    _homeDataFuture = _api.fetchHomeData(widget.seniorId);
  }

  Future<void> _refreshHomeData() async {
    setState(() {
      _homeDataFuture = _api.fetchHomeData(widget.seniorId);
    });
  }

  Future<void> _sendSos(BuildContext context) async {
    try {
      await _api.sendSos(widget.seniorId);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SOS가 보호자에게 전송되었어요.')),
      );
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('SOS 전송에 실패했어요. 잠시 후 다시 눌러주세요.')),
      );
    }
  }

  void _showSosDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        icon: const Text('🚨', style: TextStyle(fontSize: 54)),
        title: const Text(
          'SOS를 보내시겠어요?',
          textAlign: TextAlign.center,
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        content: const Text(
          '보호자와 담당 복지사에게 긴급 알림이 전송됩니다.',
          textAlign: TextAlign.center,
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('취소'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFFD94E4E),
            ),
            onPressed: () {
              Navigator.pop(context);
              _sendSos(context);
            },
            child: const Text('보내기'),
          ),
        ],
      ),
    );
  }

  void _showInfo(BuildContext context, String title, String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
        content: Text(message),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('확인'),
          ),
        ],
      ),
    );
  }

  static String _text(
    Map<String, dynamic> data,
    List<String> keys,
    String fallback,
  ) {
    for (final key in keys) {
      final value = data[key];
      final text = value == null ? '' : '$value'.trim();
      if (text.isNotEmpty && text != 'null') return text;
    }
    return fallback;
  }

  static String _scheduleTitle(dynamic schedule) {
    if (schedule is! Map<String, dynamic>) return '일정';
    return _text(schedule, ['title', 'content', 'text'], '일정');
  }

  static String _scheduleTime(dynamic schedule) {
    if (schedule is! Map<String, dynamic>) return '';
    final raw = _text(schedule, ['scheduleTime', 'time'], '');
    return raw.length >= 5 ? raw.substring(0, 5) : raw;
  }

  static String _nextScheduleSummary(List<dynamic> schedules) {
    if (schedules.isEmpty) return '오늘 등록된 일정이 없어요.';
    final first = schedules.first;
    final time = _scheduleTime(first);
    final title = _scheduleTitle(first);
    return time.isEmpty ? '다음: $title' : '다음: $time $title';
  }

  static int _todayFallCount(List<dynamic> alerts) {
    return alerts.where((alert) {
      if (alert is! Map<String, dynamic>) return false;
      final type = '${alert['type'] ?? ''}';
      return type == 'FALL_DETECTED' || type == 'FALL_RISK';
    }).length;
  }

  String _guardianSummary(Map<String, dynamic> profile) {
    final guardians = profile['guardians'];
    if (guardians is List && guardians.isNotEmpty) {
      final guardian = guardians.first;
      if (guardian is Map<String, dynamic>) {
        final name = _text(guardian, ['name'], '보호자');
        final relation = _text(guardian, ['relation'], '');
        return relation.isEmpty ? name : '$name ($relation)';
      }
    }
    return '보호자 매칭 전';
  }

  String _workerSummary(Map<String, dynamic> profile) {
    final worker = profile['welfareWorker'];
    if (worker is Map<String, dynamic>) {
      return _text(worker, ['name'], '복지사 매칭 전');
    }
    return '복지사 매칭 전';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFFDEC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: const Text(
          '우리 woori',
          style: TextStyle(
            color: Color(0xFF86A788),
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFD94E4E),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () => _showSosDialog(context),
              icon: const Text('🚨'),
              label: const Text(
                'SOS',
                style: TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
          ),
        ],
      ),
      body: SafeArea(
        child: FutureBuilder<SeniorHomeData>(
          future: _homeDataFuture,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            if (snapshot.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        '정보를 불러오지 못했어요.',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: _refreshHomeData,
                        child: const Text('다시 불러오기'),
                      ),
                    ],
                  ),
                ),
              );
            }

            final data = snapshot.data!;
            final profile = data.senior;
            final senior = profile['senior'] is Map<String, dynamic>
                ? profile['senior'] as Map<String, dynamic>
                : <String, dynamic>{};
            final healthInfo = profile['healthInfo'] is Map<String, dynamic>
                ? profile['healthInfo'] as Map<String, dynamic>
                : <String, dynamic>{};
            final schedules = data.schedules;
            final climateAlerts = data.climateAlerts;
            final alerts = data.alerts;

            final seniorName = _text(senior, ['name'], '어르신');
            final region = _text(senior, ['region', 'address'], '현재 위치 확인 중');
            final incomeLevel = _text(healthInfo, ['incomeLevel'], '미입력');
            final householdType = _text(healthInfo, ['householdType'], '미입력');
            final fallCount = _todayFallCount(alerts);

            return RefreshIndicator(
              onRefresh: _refreshHomeData,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
                children: [
                  _ProfileHeader(name: seniorName, region: region),
                  const SizedBox(height: 16),
                  _SosButton(onPressed: () => _showSosDialog(context)),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _ActionTile(
                          icon: Icons.call,
                          title: '보호자 전화',
                          subtitle: _guardianSummary(profile),
                          onTap: () => _showInfo(
                            context,
                            '보호자 전화',
                            '전화 앱에서 보호자에게 연락해주세요.',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _ActionTile(
                          icon: Icons.support_agent,
                          title: '복지사 전화',
                          subtitle: _workerSummary(profile),
                          onTap: () => _showInfo(
                            context,
                            '복지사 전화',
                            '담당 복지사에게 상담을 요청할 수 있어요.',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _LocationCard(region: region),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _SmallStatusCard(
                          title: '오늘 낙상',
                          value: '$fallCount건',
                          description: fallCount > 0
                              ? '감지 이력을 확인해주세요.'
                              : '감지된 낙상이 없어요.',
                          icon: Icons.health_and_safety_outlined,
                          valueColor: const Color(0xFFD94E4E),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _SmallStatusCard(
                          title: '오늘 일정',
                          value: '${schedules.length}건',
                          description: _nextScheduleSummary(schedules),
                          icon: Icons.event_note_outlined,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  _WelfareCheckCard(
                    incomeLevel: incomeLevel,
                    householdType: householdType,
                    onTap: () => _showInfo(
                      context,
                      '복지제도 확인',
                      '소득 정보와 가구 형태는 보호자와 복지사가 복지제도 확인에 함께 참고합니다.',
                    ),
                  ),
                  const SizedBox(height: 14),
                  _ScheduleCard(schedules: schedules),
                  const SizedBox(height: 14),
                  _ClimateAlertCard(alerts: climateAlerts),
                  const SizedBox(height: 14),
                  _AppFeatureGrid(onTap: _showInfo),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.name, required this.region});

  final String name;
  final String region;

  @override
  Widget build(BuildContext context) {
    final initial = name.isNotEmpty ? name.characters.first : '우';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF86A788),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          Container(
            width: 62,
            height: 62,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.24),
              shape: BoxShape.circle,
            ),
            child: Text(
              initial,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$name님 안녕하세요',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  '우리 돌봄 서비스 · 디바이스 연결됨',
                  style: TextStyle(
                    color: Color(0xFFEAF4EA),
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  region,
                  style: const TextStyle(
                    color: Color(0xFFEAF4EA),
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SosButton extends StatelessWidget {
  const _SosButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 112,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: const Color(0xFFD94E4E),
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        onPressed: onPressed,
        child: const Text(
          '🚨 긴급 SOS 요청',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900),
        ),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF6F9271), size: 30),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF1F2A20),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF6D766A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LocationCard extends StatelessWidget {
  const _LocationCard({required this.region});

  final String region;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '현재 위치'),
          const SizedBox(height: 10),
          const Row(
            children: [
              Icon(Icons.check_circle, color: Color(0xFF86A788), size: 20),
              SizedBox(width: 8),
              Text(
                '안전 반경 안',
                style: TextStyle(
                  color: Color(0xFF48624B),
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            region,
            style: const TextStyle(
              color: Color(0xFF6D766A),
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _SmallStatusCard extends StatelessWidget {
  const _SmallStatusCard({
    required this.title,
    required this.value,
    required this.description,
    required this.icon,
    this.valueColor = const Color(0xFF1F2A20),
  });

  final String title;
  final String value;
  final String description;
  final IconData icon;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: const Color(0xFF86A788), size: 30),
          const SizedBox(height: 10),
          Text(
            title,
            style: const TextStyle(
              color: Color(0xFF6D766A),
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 28,
              fontWeight: FontWeight.w900,
            ),
          ),
          Text(
            description,
            style: const TextStyle(
              color: Color(0xFF6D766A),
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _WelfareCheckCard extends StatelessWidget {
  const _WelfareCheckCard({
    required this.incomeLevel,
    required this.householdType,
    required this.onTap,
  });

  final String incomeLevel;
  final String householdType;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '복지제도 확인'),
          const SizedBox(height: 12),
          const Text(
            '소득과 가구 정보를 바탕으로 받을 수 있는 복지제도를 함께 확인해요.',
            style: TextStyle(
              color: Color(0xFF1F2A20),
              fontSize: 16,
              fontWeight: FontWeight.w800,
              height: 1.45,
            ),
          ),
          const SizedBox(height: 12),
          _InfoLine(label: '소득 정보', value: incomeLevel),
          _InfoLine(label: '가구 형태', value: householdType),
        ],
      ),
    );
  }
}

class _InfoLine extends StatelessWidget {
  const _InfoLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF6D766A),
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(
              color: Color(0xFF1F2A20),
              fontSize: 15,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScheduleCard extends StatelessWidget {
  const _ScheduleCard({required this.schedules});

  final List<dynamic> schedules;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '오늘 일정'),
          const SizedBox(height: 12),
          if (schedules.isEmpty)
            const Text(
              '등록된 일정이 없어요.',
              style: TextStyle(
                color: Color(0xFF6D766A),
                fontSize: 15,
                fontWeight: FontWeight.w700,
              ),
            )
          else
            ...schedules.map((schedule) {
              return _ScheduleRow(
                time: _SeniorHomeScreenState._scheduleTime(schedule),
                text: _SeniorHomeScreenState._scheduleTitle(schedule),
              );
            }),
        ],
      ),
    );
  }
}

class _ScheduleRow extends StatelessWidget {
  const _ScheduleRow({required this.time, required this.text});

  final String time;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(
              time.isEmpty ? '시간 없음' : time,
              style: const TextStyle(
                color: Color(0xFF48624B),
                fontSize: 14,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: Color(0xFF86A788),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                color: Color(0xFF1F2A20),
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ClimateAlertCard extends StatelessWidget {
  const _ClimateAlertCard({required this.alerts});

  final List<dynamic> alerts;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '기후 알림'),
          const SizedBox(height: 10),
          if (alerts.isEmpty)
            const Text(
              '현재 발령된 기상특보가 없습니다. 오늘 하루 기후 상태는 비교적 안전합니다.',
              style: TextStyle(
                color: Color(0xFF1F2A20),
                fontSize: 15,
                fontWeight: FontWeight.w700,
                height: 1.45,
              ),
            )
          else
            ...alerts.map((alert) {
              final text = alert is Map<String, dynamic>
                  ? _SeniorHomeScreenState._text(
                      alert,
                      ['message', 'type', 'level'],
                      '기후 알림',
                    )
                  : '기후 알림';
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  text,
                  style: const TextStyle(
                    color: Color(0xFF1F2A20),
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    height: 1.45,
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _AppFeatureGrid extends StatelessWidget {
  const _AppFeatureGrid({required this.onTap});

  final void Function(BuildContext context, String title, String message) onTap;

  @override
  Widget build(BuildContext context) {
    return _BaseCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(title: '앱 기능'),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _FeatureButton(
                  icon: Icons.location_on_outlined,
                  label: '위치 공유',
                  onTap: () => onTap(context, '위치 공유', '현재 위치를 보호자에게 공유합니다.'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _FeatureButton(
                  icon: Icons.medication_outlined,
                  label: '복약 확인',
                  onTap: () => onTap(context, '복약 확인', '보호자가 보낸 복약 알림을 확인합니다.'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _FeatureButton(
                  icon: Icons.policy_outlined,
                  label: '복지 확인',
                  onTap: () => onTap(context, '복지 확인', '입력한 정보를 바탕으로 복지제도를 확인합니다.'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FeatureButton extends StatelessWidget {
  const _FeatureButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 88),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF6FAF4),
          border: Border.all(color: const Color(0xFFDDE9D8)),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: const Color(0xFF86A788), size: 30),
            const SizedBox(height: 8),
            Text(
              label,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Color(0xFF1F2A20),
                fontSize: 14,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        color: Color(0xFF1F2A20),
        fontSize: 19,
        fontWeight: FontWeight.w900,
      ),
    );
  }
}

class _BaseCard extends StatelessWidget {
  const _BaseCard({required this.child, this.onTap});

  final Widget child;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFDDE9D8)),
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF86A788).withOpacity(0.08),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: child,
    );

    if (onTap == null) return card;

    return InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: onTap,
      child: card,
    );
  }
}
