import 'package:flutter/material.dart';

import '../../core/api/guardian_api.dart';
import '../../core/config/app_config.dart';
import '../../core/models/alert.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';

const _kGreen = Color(0xFF86A788);
const _kTextTitle = Color(0xFF1C1C1E);
const _kTextSub = Color(0xFF6C6C70);
const _kDivider = Color(0xFFE5E5EA);

class SeniorDetailScreen extends StatefulWidget {
  final Senior senior;

  const SeniorDetailScreen({super.key, required this.senior});

  @override
  State<SeniorDetailScreen> createState() => _SeniorDetailScreenState();
}

class _SeniorDetailScreenState extends State<SeniorDetailScreen> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();

  bool _isLoadingExtra = true;
  List<Map<String, dynamic>> _jobApplications = [];
  List<AlertModel> _consultRequests = [];

  Senior get senior => widget.senior;

  @override
  void initState() {
    super.initState();
    _loadExtraWelfareInfo();
  }

  Future<void> _loadExtraWelfareInfo() async {
    try {
      final session = await _sessionStorage.getGuardianInfo();
      final guardianId = int.tryParse(session['guardianId'] ?? '');

      final jobs = await _api.fetchSeniorJobApplications(senior.id);

      var consults = <AlertModel>[];
      if (guardianId != null) {
        final alerts = await _api.fetchGuardianAlerts(guardianId);
        consults = alerts
            .where(
              (alert) =>
                  alert.seniorId == senior.id &&
                  alert.type == 'WELFARE_CONSULT_REQUEST',
            )
            .toList();
      }

      if (!mounted) return;
      setState(() {
        _jobApplications = jobs;
        _consultRequests = consults;
        _isLoadingExtra = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isLoadingExtra = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text('${senior.name} 상세 정보'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _ProfileHeader(senior: senior),
          const SizedBox(height: 20),

          _InfoSection(
            title: '기본 정보',
            children: [
              _InfoTile(label: '성별', value: senior.gender ?? '-'),
              _InfoTile(
                label: '지역',
                value: senior.region.isEmpty ? '-' : senior.region,
              ),
              _InfoTile(label: '담당 복지사', value: senior.socialWorkerName),
              _InfoTile(label: '복지사 연락처', value: senior.socialWorkerPhone),
            ],
          ),
          const SizedBox(height: 14),

          _InfoSection(
            title: '복약 정보',
            trailing: _MedicationAlertIconButton(senior: senior),
            children: [
              _InfoTile(label: '복약 수', value: senior.medicineCount ?? '-'),
              _InfoTile(
                label: '복용 약',
                value: senior.medications.isEmpty
                    ? '-'
                    : senior.medications.join('\n'),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _InfoSection(
            title: '복지 정보',
            children: [
              _InfoTile(label: '소득 구분', value: _display(senior.incomeLevel)),
              _InfoTile(label: '가구 형태', value: _display(senior.householdType)),
              _InfoTile(label: '희망 일자리', value: _display(senior.hopeJobType)),
              _InfoTile(label: '희망 조건', value: _display(senior.hopeCondition)),
              _InfoTile(label: '희망 요일', value: _display(senior.hopeDays)),
            ],
          ),
          const SizedBox(height: 14),

          _InfoSection(title: '신청 일자리', children: _buildJobApplicationTiles()),
          const SizedBox(height: 14),

          _InfoSection(
            title: '상담 요청 내역',
            children: _buildConsultRequestTiles(),
          ),
          const SizedBox(height: 14),

          _InfoSection(
            title: '건강 정보',
            children: [
              _InfoTile(
                label: '주의 항목',
                value: senior.cautionItems.isEmpty
                    ? '-'
                    : senior.cautionItems.join(', '),
              ),
              _InfoTile(label: '활동 조건', value: senior.activityCondition),
              _InfoTile(label: '장애 등급', value: senior.disabilityGrade),
              _InfoTile(label: '장애 유형', value: senior.disabilityType ?? '-'),
            ],
          ),
          const SizedBox(height: 14),

          _InfoSection(
            title: '위치 정보',
            children: [
              _InfoTile(label: '마지막 위치', value: senior.lastLocationAddress),
              _InfoTile(label: '마지막 확인', value: senior.lastLocationTime),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _buildJobApplicationTiles() {
    if (_isLoadingExtra) {
      return const [_InfoTile(label: '조회', value: '불러오는 중')];
    }

    if (_jobApplications.isEmpty) {
      return const [_InfoTile(label: '내역', value: '-')];
    }

    return _jobApplications.asMap().entries.map((entry) {
      final index = entry.key;
      final job = entry.value;

      final rawTitle = _readJobText(job, ['jobTitle'], fallback: '일자리명 없음');
      final title = _jobTitleWithoutParentheses(rawTitle);
      final subtitle = _jobTitleParenthesesText(rawTitle);
      final organization = _readJobText(job, ['organization', 'company']);
      final status = _readJobText(job, ['status']);
      final requestedAt = _readJobText(job, ['requestedAt']);
      final location = _readJobText(job, ['location']);
      final workTime = _readJobText(job, ['workTime']);
      final wage = _readJobText(job, ['wage']);

      final details = [
        if (organization.isNotEmpty) organization,
        if (requestedAt.isNotEmpty) requestedAt,
        if (location.isNotEmpty) location,
        if (workTime.isNotEmpty) workTime,
        if (wage.isNotEmpty) wage,
      ].join(' / ');

      return _JobApplicationTile(
        title: title,
        subtitle: subtitle,
        status: status,
        details: details.isEmpty ? '-' : details,
        showDivider: index < _jobApplications.length - 1,
      );
    }).toList();
  }

  List<Widget> _buildConsultRequestTiles() {
    if (_isLoadingExtra) {
      return const [_InfoTile(label: '조회', value: '불러오는 중')];
    }

    if (_consultRequests.isEmpty) {
      return const [_InfoTile(label: '내역', value: '-')];
    }

    return _consultRequests.asMap().entries.map((entry) {
      final index = entry.key;
      final alert = entry.value;
      final createdAt = alert.createdAt == null
          ? ''
          : alert.createdAt.toString().substring(0, 16);
      final message = alert.message.isEmpty ? alert.title : alert.message;

      return _ConsultRequestTile(
        message: message,
        status: alert.isRead ? '응답 완료' : '응답 대기',
        createdAt: createdAt,
        showDivider: index < _consultRequests.length - 1,
      );
    }).toList();
  }

  String _readJobText(
    Map<String, dynamic> source,
    List<String> keys, {
    String fallback = '',
  }) {
    for (final key in keys) {
      final value = source[key];
      if (value == null) continue;
      final text = value.toString().trim();
      if (text.isNotEmpty) return text;
    }
    return fallback;
  }

  String _display(String value) {
    final text = value.trim();
    return text.isEmpty ? '-' : text;
  }

  String _jobTitleWithoutParentheses(String title) {
    final text = title.trim();
    final withoutParentheses = text
        .replaceAll(RegExp(r'\s*\([^)]*\)\s*'), ' ')
        .trim();
    return withoutParentheses.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  String _jobTitleParenthesesText(String title) {
    final matches = RegExp(r'\(([^)]*)\)').allMatches(title);
    return matches
        .map((match) => (match.group(1) ?? '').trim())
        .where((text) => text.isNotEmpty)
        .join(' / ');
  }
}

class _ProfileHeader extends StatelessWidget {
  final Senior senior;

  const _ProfileHeader({required this.senior});

  @override
  Widget build(BuildContext context) {
    final isSafe = senior.status == '안전';
    final ageText = senior.age == null ? '' : ' (${senior.age}세)';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF6FAF6),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE0E8E0)),
      ),
      child: Row(
        children: [
          _ProfilePhoto(senior: senior),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${senior.name}$ageText',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _kTextTitle,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  senior.phone.isEmpty ? '전화번호 없음' : senior.phone,
                  style: const TextStyle(
                    fontSize: 13,
                    color: _kTextSub,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: isSafe ? const Color(0xFFEEF5EE) : const Color(0xFFFFF4E5),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              senior.status,
              style: TextStyle(
                color: isSafe
                    ? const Color(0xFF4A7A4C)
                    : const Color(0xFFFF9500),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfilePhoto extends StatelessWidget {
  final Senior senior;

  const _ProfilePhoto({required this.senior});

  @override
  Widget build(BuildContext context) {
    final imageUrl = _resolveProfileImageUrl(senior.profileImageUrl);

    return CircleAvatar(
      radius: 32,
      backgroundColor: const Color(0xFFEBF8EE),
      child: ClipOval(
        child: imageUrl.isEmpty
            ? _FallbackProfileInitial(name: senior.name)
            : Image.network(
                imageUrl,
                width: 64,
                height: 64,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) {
                  return _FallbackProfileInitial(name: senior.name);
                },
              ),
      ),
    );
  }
}

String _resolveProfileImageUrl(String rawUrl) {
  final imageUrl = rawUrl.trim();
  if (imageUrl.isEmpty) return '';

  final parsedImageUrl = Uri.tryParse(imageUrl);
  if (parsedImageUrl != null && parsedImageUrl.hasScheme) {
    return imageUrl;
  }

  final apiUri = Uri.tryParse(AppConfig.apiBaseUrl);
  if (apiUri == null) return imageUrl;

  final serverOrigin = apiUri
      .replace(path: '', queryParameters: null, fragment: null)
      .toString()
      .replaceFirst(RegExp(r'/$'), '');

  if (imageUrl.startsWith('/')) {
    return '$serverOrigin$imageUrl';
  }

  return '$serverOrigin/$imageUrl';
}

class _FallbackProfileInitial extends StatelessWidget {
  final String name;

  const _FallbackProfileInitial({required this.name});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 64,
      height: 64,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0] : '?',
          style: const TextStyle(
            color: _kGreen,
            fontSize: 22,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

class _InfoSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  final Widget? trailing;

  const _InfoSection({
    required this.title,
    required this.children,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      decoration: BoxDecoration(
        border: Border.all(color: _kDivider),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _kTextTitle,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }
}

class _JobApplicationTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String status;
  final String details;
  final bool showDivider;

  const _JobApplicationTile({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.details,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    final hasStatus = status.trim().isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    color: _kTextTitle,
                    fontWeight: FontWeight.w800,
                    height: 1.35,
                  ),
                ),
              ),
              if (hasStatus) ...[
                const SizedBox(width: 8),
                _StatusPill(text: status),
              ],
            ],
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 12.5,
                color: _kTextSub,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 5),
          Text(
            details,
            style: const TextStyle(
              fontSize: 12.5,
              color: _kTextSub,
              fontWeight: FontWeight.w600,
              height: 1.45,
            ),
          ),
          if (showDivider) ...[
            const SizedBox(height: 10),
            const Divider(color: _kDivider, height: 1),
          ],
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String text;

  const _StatusPill({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 82),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFEEF5EE),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 11,
          color: Color(0xFF4A7A4C),
          fontWeight: FontWeight.w800,
          height: 1.1,
        ),
      ),
    );
  }
}

class _ConsultRequestTile extends StatelessWidget {
  final String message;
  final String status;
  final String createdAt;
  final bool showDivider;

  const _ConsultRequestTile({
    required this.message,
    required this.status,
    required this.createdAt,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(
                    fontSize: 14,
                    color: _kTextTitle,
                    fontWeight: FontWeight.w800,
                    height: 1.35,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _StatusPill(text: status),
            ],
          ),
          if (createdAt.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              createdAt,
              style: const TextStyle(
                fontSize: 12.5,
                color: _kTextSub,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ],
          if (showDivider) ...[
            const SizedBox(height: 10),
            const Divider(color: _kDivider, height: 1),
          ],
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final String label;
  final String value;

  const _InfoTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 104,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: _kTextSub),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                color: _kTextTitle,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MedicationAlertIconButton extends StatelessWidget {
  final Senior senior;

  const _MedicationAlertIconButton({required this.senior});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.notifications_outlined, color: _kGreen),
      tooltip: '복약 알림 보내기',
      onPressed: () => _showModal(context),
    );
  }

  void _showModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _MedicationAlertModal(senior: senior),
    );
  }
}

class _MedicationAlertModal extends StatefulWidget {
  final Senior senior;

  const _MedicationAlertModal({required this.senior});

  @override
  State<_MedicationAlertModal> createState() => _MedicationAlertModalState();
}

class _MedicationAlertModalState extends State<_MedicationAlertModal> {
  final _api = GuardianApi();
  final _session = GuardianSessionStorage();
  final _customMsgCtrl = TextEditingController();

  String? _selectedMed;
  int _selectedMsgIdx = 0;
  bool _isSending = false;
  String _medName(String med) => med.split(' / ').first.trim();

  static const _kModalGreen = Color(0xFF86A788);
  static const _kModalBg = Color(0xFFF5F5F5);
  static const _kModalSub = Color(0xFF6C6C70);
  static const _kModalHint = Color(0xFFAEAEB2);
  static const _kModalDivider = Color(0xFFE5E5EA);
  static const _kModalRed = Color(0xFFB85252);

  List<String> get _presets {
    final name = _selectedMed ?? '약';
    return [
      '$name 복용 시간입니다. 꼭 챙겨드세요 💊',
      '지금 $name 드실 시간이에요!',
      '오늘 $name 드셨나요? 확인해주세요.',
      '직접 입력',
    ];
  }

  String get _finalMessage {
    if (_selectedMsgIdx == _presets.length - 1) {
      return _customMsgCtrl.text.trim();
    }
    return _presets[_selectedMsgIdx];
  }

  Future<void> _send() async {
    final info = await _session.getGuardianInfo();
    final guardianId = int.tryParse(info['guardianId'] ?? '');
    if (guardianId == null) return;

    if (_finalMessage.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('메시지를 입력해주세요.')));
      return;
    }

    setState(() => _isSending = true);
    try {
      await _api.sendMedicationReminder(
        seniorId: widget.senior.id,
        guardianId: guardianId,
        message: _finalMessage,
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${widget.senior.name}님께 복약 알림을 전송했습니다.'),
          backgroundColor: _kModalGreen,
          duration: const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: _kModalRed,
        ),
      );
    }
  }

  @override
  void dispose() {
    _customMsgCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final meds = widget.senior.medications;

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 핸들
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: _kModalDivider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              '${widget.senior.name}님께 복약 알림 보내기',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1C1C1E),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              '알림은 앱 푸시와 앱 내 알림함으로 동시에 전송됩니다.',
              style: TextStyle(fontSize: 12, color: _kModalSub),
            ),
            const SizedBox(height: 24),

            // 약 선택
            const Text(
              '약 선택',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _kModalSub,
              ),
            ),
            const SizedBox(height: 8),
            if (meds.isEmpty)
              TextField(
                decoration: InputDecoration(
                  hintText: '약 이름을 직접 입력하세요',
                  hintStyle: const TextStyle(color: _kModalHint),
                  filled: true,
                  fillColor: _kModalBg,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                ),
                onChanged: (v) => setState(() => _selectedMed = v.trim()),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: meds.map((med) {
                  final name = _medName(med);
                  final selected = _selectedMed == name;
                  return GestureDetector(
                    onTap: () => setState(() {
                      _selectedMed = selected ? null : name;
                      _selectedMsgIdx = 0;
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: selected ? _kModalGreen : _kModalBg,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: selected ? _kModalGreen : _kModalDivider,
                        ),
                      ),
                      child: Text(
                        name,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: selected
                              ? Colors.white
                              : const Color(0xFF1C1C1E),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            const SizedBox(height: 24),

            // 메시지 선택
            const Text(
              '메시지',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _kModalSub,
              ),
            ),
            const SizedBox(height: 8),
            ..._presets.asMap().entries.map((e) {
              final idx = e.key;
              final isCustom = idx == _presets.length - 1;
              final selected = _selectedMsgIdx == idx;
              return Column(
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _selectedMsgIdx = idx),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: selected ? const Color(0xFFEBF8EE) : _kModalBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: selected ? _kModalGreen : _kModalDivider,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            selected
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked,
                            color: selected ? _kModalGreen : _kModalHint,
                            size: 18,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              isCustom ? '직접 입력' : e.value,
                              style: TextStyle(
                                fontSize: 13,
                                color: selected
                                    ? const Color(0xFF1C1C1E)
                                    : _kModalSub,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (isCustom && selected)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: TextField(
                        controller: _customMsgCtrl,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: '보낼 메시지를 입력하세요',
                          hintStyle: const TextStyle(color: _kModalHint),
                          filled: true,
                          fillColor: _kModalBg,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                ],
              );
            }),
            const SizedBox(height: 8),

            // 전송 버튼
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kModalGreen,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                onPressed: _isSending ? null : _send,
                child: _isSending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        '알림 보내기',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
