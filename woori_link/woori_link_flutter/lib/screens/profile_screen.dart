import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';

import '../api/care_monitoring_api.dart';
import '../api/contact_api.dart';
import '../api/senior_api.dart';
import '../services/auth_service.dart';
import '../text_scale_controller.dart';
import '../theme.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _senior;
  Map<String, dynamic>? _guardian;
  Map<String, dynamic>? _worker;
  bool _loading = true;
  bool _saving = false;
  bool _savingSettings = false;
  bool _requestingConsultation = false;
  bool _recallReminder = true;
  bool _scheduleReminder = true;
  bool _voiceAnswer = true;
  final FlutterSecureStorage _consentStorage = const FlutterSecureStorage();
  bool _aiAnalysisConsent = true;
  bool _externalAiConsent = true;
  bool _guardianSharingConsent = true;
  bool _workerSharingConsent = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) throw Exception('로그인 정보가 없습니다.');

      final senior = await SeniorApi.getSenior(seniorId);
      final results = await Future.wait([
        ContactApi.getGuardian(_intValue(senior['guardianId'])),
        ContactApi.getWelfareWorker(_intValue(senior['welfareWorkerId'])),
      ]);

      if (!mounted) return;
      setState(() {
        _senior = senior;
        _guardian = results[0];
        _worker = results[1];
        _applySettingsFromSenior(senior);
        _loading = false;
      });
      await _loadConsentSettings();
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('내 정보를 불러오지 못했습니다.')),
      );
    }
  }

  Future<void> _loadConsentSettings() async {
    final values = await Future.wait([
      _consentStorage.read(key: 'consent_ai_analysis'),
      _consentStorage.read(key: 'consent_external_ai'),
      _consentStorage.read(key: 'consent_guardian_sharing'),
      _consentStorage.read(key: 'consent_worker_sharing'),
    ]);
    if (!mounted) return;
    setState(() {
      _aiAnalysisConsent = values[0] != 'false';
      _externalAiConsent = values[1] != 'false';
      _guardianSharingConsent = values[2] != 'false';
      _workerSharingConsent = values[3] != 'false';
    });
  }

  Future<void> _updateConsent(String key, bool value) async {
    await _consentStorage.write(key: key, value: value.toString());
    await _consentStorage.write(
      key: '${key}_updated_at',
      value: DateTime.now().toIso8601String(),
    );
    if (!mounted) return;
    setState(() {
      if (key == 'consent_ai_analysis') _aiAnalysisConsent = value;
      if (key == 'consent_external_ai') _externalAiConsent = value;
      if (key == 'consent_guardian_sharing') _guardianSharingConsent = value;
      if (key == 'consent_worker_sharing') _workerSharingConsent = value;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('동의 설정을 저장했습니다.')),
    );
  }

  int? _intValue(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;
    return int.tryParse('$value');
  }

  String _text(dynamic value, {String fallback = '-'}) {
    final text = '${value ?? ''}'.trim();
    return text.isEmpty ? fallback : text;
  }

  String _dateLabel(dynamic value) {
    final text = '${value ?? ''}'.trim();
    if (text.isEmpty) return '-';
    final date = DateTime.tryParse(text);
    if (date == null) return text;
    return DateFormat('yyyy.MM.dd').format(date);
  }

  String _genderLabel(dynamic value) {
    final gender = '${value ?? ''}'.toUpperCase();
    if (gender == 'M' || gender == 'MALE' || gender == '남' || gender == '남성') {
      return '남성';
    }
    if (gender == 'F' || gender == 'FEMALE' || gender == '여' || gender == '여성') {
      return '여성';
    }
    return _text(value);
  }

  String _incomeLabel(dynamic value) {
    return switch ('${value ?? ''}') {
      'LIVELIHOOD' => '생계급여',
      'MEDICAL' => '의료급여',
      'HOUSING' => '주거급여',
      'EDUCATION' => '교육급여',
      'NONE' => '해당 없음',
      _ => _text(value),
    };
  }

  void _applySettingsFromSenior(Map<String, dynamic> senior) {
    _recallReminder = senior['recallReminderEnabled'] != false;
    _scheduleReminder = senior['scheduleReminderEnabled'] != false;
    _voiceAnswer = senior['chatbotVoiceEnabled'] != false;
  }

  Future<void> _updateSetting(String field, bool value) async {
    if (_savingSettings) return;

    final senior = _senior;
    final previousRecall = _recallReminder;
    final previousSchedule = _scheduleReminder;
    final previousVoice = _voiceAnswer;

    setState(() {
      _savingSettings = true;
      if (field == 'recallReminderEnabled') _recallReminder = value;
      if (field == 'scheduleReminderEnabled') _scheduleReminder = value;
      if (field == 'chatbotVoiceEnabled') _voiceAnswer = value;
    });

    try {
      final id = _intValue(senior?['id']) ?? await AuthService.getUserId();
      if (id == null) throw Exception('사용자 ID가 없습니다.');
      final updated = await SeniorApi.updateSenior(id, {field: value});
      if (!mounted) return;
      setState(() {
        _senior = updated;
        _applySettingsFromSenior(updated);
        _savingSettings = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _recallReminder = previousRecall;
        _scheduleReminder = previousSchedule;
        _voiceAnswer = previousVoice;
        _savingSettings = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('설정을 저장하지 못했습니다.')),
      );
    }
  }

  Future<void> _editProfile() async {
    final senior = _senior;
    if (senior == null || _saving) return;

    final nameCtrl = TextEditingController(text: _text(senior['name'], fallback: ''));
    final phoneCtrl = TextEditingController(text: _text(senior['phone'], fallback: ''));
    final birthDateCtrl =
        TextEditingController(text: _text(senior['birthDate'], fallback: ''));
    final addressCtrl = TextEditingController(text: _text(senior['address'], fallback: ''));
    final detailAddressCtrl =
        TextEditingController(text: _text(senior['detailAddress'], fallback: ''));
    String? gender = _normalizeGender(senior['gender']);

    final shouldSave = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) => AlertDialog(
          title: const Text('내 정보 수정'),
          scrollable: true,
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _editField(nameCtrl, '이름'),
              const SizedBox(height: 10),
              _editField(phoneCtrl, '전화번호', keyboardType: TextInputType.phone),
              const SizedBox(height: 10),
              _editField(
                birthDateCtrl,
                '생년월일',
                hintText: '예: 19450301',
                keyboardType: TextInputType.number,
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                value: gender,
                items: const [
                  DropdownMenuItem(value: 'M', child: Text('남성')),
                  DropdownMenuItem(value: 'F', child: Text('여성')),
                ],
                onChanged: (value) => setDialogState(() => gender = value),
                decoration: InputDecoration(
                  labelText: '성별',
                  filled: true,
                  fillColor: kBg,
                ),
              ),
              const SizedBox(height: 10),
              _editField(addressCtrl, '주소'),
              const SizedBox(height: 10),
              _editField(detailAddressCtrl, '상세주소'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('취소'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('저장'),
            ),
          ],
        ),
      ),
    );

    if (shouldSave != true) return;
    final birthDate = _normalizeDate(birthDateCtrl.text);
    if (birthDateCtrl.text.trim().isNotEmpty && birthDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('생년월일은 19450301처럼 숫자 8자리로 입력해 주세요.')),
      );
      return;
    }

    try {
      setState(() => _saving = true);
      final id = _intValue(senior['id']) ?? await AuthService.getUserId();
      if (id == null) throw Exception('사용자 ID가 없습니다.');

      final updated = await SeniorApi.updateSenior(id, {
        'name': nameCtrl.text.trim(),
        'phone': phoneCtrl.text.trim(),
        'birthDate': birthDate,
        'gender': gender,
        'address': addressCtrl.text.trim(),
        'detailAddress': detailAddressCtrl.text.trim(),
      });

      if (!mounted) return;
      setState(() {
        _senior = updated;
        _applySettingsFromSenior(updated);
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('내 정보가 수정되었습니다.')),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('내 정보를 수정하지 못했습니다.')),
      );
    }
  }

  String? _normalizeGender(dynamic value) {
    final gender = '${value ?? ''}'.trim().toUpperCase();
    if (gender == 'M' || gender == 'MALE' || gender == '남성') return 'M';
    if (gender == 'F' || gender == 'FEMALE' || gender == '여성') return 'F';
    return null;
  }

  String? _normalizeDate(String value) {
    final cleaned = value.trim().replaceAll('.', '-').replaceAll('/', '-');
    if (cleaned.isEmpty) return null;
    final compactMatch = RegExp(r'^(\d{4})(\d{2})(\d{2})$').firstMatch(cleaned);
    if (compactMatch != null) {
      return _validDateOrNull(
        compactMatch.group(1)!,
        compactMatch.group(2)!,
        compactMatch.group(3)!,
      );
    }
    final match = RegExp(r'^(\d{4})-(\d{1,2})-(\d{1,2})$').firstMatch(cleaned);
    if (match == null) return null;
    return _validDateOrNull(
      match.group(1)!,
      match.group(2)!.padLeft(2, '0'),
      match.group(3)!.padLeft(2, '0'),
    );
  }

  String? _validDateOrNull(String year, String month, String day) {
    final parsed = DateTime.tryParse('$year-$month-$day');
    if (parsed == null) return null;
    if (parsed.year != int.parse(year) ||
        parsed.month != int.parse(month) ||
        parsed.day != int.parse(day)) {
      return null;
    }
    return '$year-$month-$day';
  }

  Widget _editField(
    TextEditingController controller,
    String label, {
    String? hintText,
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        hintText: hintText,
        filled: true,
        fillColor: kBg,
      ),
    );
  }

  Future<void> _copyToClipboard(String? value, String label) async {
    final text = '${value ?? ''}'.trim();
    if (text.isEmpty || text == '-') {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('복사할 $label 정보가 없습니다.')),
      );
      return;
    }

    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$label을 복사했습니다.')),
    );
  }

  Future<void> _requestConsultation() async {
    if (_requestingConsultation) return;
    final worker = _worker;
    if (worker == null) return;
    final senior = _senior ?? const <String, dynamic>{};
    final seniorId = _intValue(senior['id']) ?? await AuthService.getUserId();
    if (seniorId == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('상담 신청'),
        content: Text(
          '${_text(worker['name'], fallback: '담당 복지사')}님에게 상담 요청 알림을 보낼까요?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('신청하기'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _requestingConsultation = true);
    try {
      final seniorName = _text(senior['name'], fallback: '어르신');
      await CareMonitoringApi.requestConsultation(
        seniorId,
        '$seniorName님이 담당 복지사 상담을 요청했습니다.',
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('담당 복지사에게 상담 요청을 보냈습니다.')),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('상담 요청을 보내지 못했습니다. 다시 시도해 주세요.')),
      );
    } finally {
      if (mounted) {
        setState(() => _requestingConsultation = false);
      }
    }
  }

  Future<void> _logout() async {
    await AuthService.logout();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final senior = _senior ?? const <String, dynamic>{};
    return Scaffold(
      backgroundColor: kBg,
      appBar: AppBar(
        title: const Text('내 정보'),
        actions: [
          const _TextSizeAction(),
          IconButton(
            tooltip: '새로고침',
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          children: [
            _profileHeader(senior),
            const SizedBox(height: 16),
            _sectionTitle('기본 정보'),
            _infoCard(
              [
                _InfoRow('이름', _text(senior['name'])),
                _InfoRow('전화번호', _text(senior['phone'])),
                _InfoRow('생년월일', _dateLabel(senior['birthDate'])),
                _InfoRow('성별', _genderLabel(senior['gender'])),
                _InfoRow('주소', [
                  _text(senior['address']),
                  _text(senior['detailAddress'], fallback: ''),
                ].where((v) => v.isNotEmpty && v != '-').join(' ')),
              ],
              action: TextButton.icon(
                onPressed: _saving ? null : _editProfile,
                icon: const Icon(Icons.edit_outlined),
                label: const Text('수정'),
              ),
            ),
            const SizedBox(height: 18),
            _sectionTitle('연결된 사람'),
            _contactCard(
              title: '보호자',
              icon: Icons.family_restroom,
              data: _guardian,
              emptyText: '연결된 보호자가 없습니다.',
              lines: [
                _InfoRow('관계', _text(_guardian?['relationship'])),
                _InfoRow(
                  '전화번호',
                  _text(_guardian?['phone']),
                  copyable: true,
                ),
                _InfoRow('이메일', _text(_guardian?['email'])),
              ],
            ),
            const SizedBox(height: 10),
            _contactCard(
              title: '담당 복지사',
              icon: Icons.support_agent,
              data: _worker,
              emptyText: '배정된 복지사가 없습니다.',
              onConsultationRequest: _requestConsultation,
              consultationRequesting: _requestingConsultation,
              lines: [
                _InfoRow('기관', _text(_worker?['organization'])),
                _InfoRow(
                  '전화번호',
                  _text(_worker?['phone']),
                  copyable: true,
                ),
                _InfoRow('이메일', _text(_worker?['email'])),
              ],
            ),
            const SizedBox(height: 18),
            _sectionTitle('복지 정보'),
            _infoCard([
              _InfoRow('소득 구분', _incomeLabel(senior['incomeLevel'])),
              _InfoRow('독거 여부', senior['livingAlone'] == true ? '독거' : '해당 없음'),
              _InfoRow('주거 형태', _text(senior['housingType'])),
              _InfoRow('에너지 복지', '에너지 탭에서 입력 현황 확인'),
            ]),
            const SizedBox(height: 18),
            _sectionTitle('개인정보 및 동의 관리'),
            _consentCard(),
            const SizedBox(height: 18),
            _sectionTitle('앱 설정'),
            _settingsCard(),
            const SizedBox(height: 18),
            OutlinedButton.icon(
              onPressed: _logout,
              icon: const Icon(Icons.logout),
              label: const Text('로그아웃'),
              style: OutlinedButton.styleFrom(
                foregroundColor: kDanger,
                side: BorderSide(color: kDanger.withOpacity(0.35)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _profileHeader(Map<String, dynamic> senior) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: kPrimary,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.18),
              borderRadius: BorderRadius.circular(18),
            ),
            child: const Icon(Icons.person, color: Colors.white, size: 32),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_text(senior['name'])}님',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  _text(senior['address'], fallback: '주소 미등록'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.84),
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

  Widget _sectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 2, bottom: 8),
      child: Text(
        title,
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
      ),
    );
  }

  Widget _infoCard(List<_InfoRow> rows, {Widget? action}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            if (action != null) ...[
              Align(alignment: Alignment.centerRight, child: action),
              const Divider(height: 10),
            ],
            ...rows.map(
              (row) => _infoLine(
                row.label,
                row.value,
                copyable: row.copyable,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _contactCard({
    required String title,
    required IconData icon,
    required Map<String, dynamic>? data,
    required String emptyText,
    required List<_InfoRow> lines,
    VoidCallback? onConsultationRequest,
    bool consultationRequesting = false,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 38,
                  height: 38,
                  decoration: BoxDecoration(
                    color: kPrimary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: kPrimaryDark),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    data == null ? title : '$title · ${_text(data['name'])}',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                if (data != null && onConsultationRequest != null)
                  OutlinedButton.icon(
                    onPressed:
                        consultationRequesting ? null : onConsultationRequest,
                    icon: consultationRequesting
                        ? const SizedBox(
                            width: 14,
                            height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.chat_outlined, size: 16),
                    label: const Text('상담 신청'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: kPrimaryDark,
                      side: BorderSide(color: kPrimary.withOpacity(0.3)),
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      visualDensity: VisualDensity.compact,
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),
            if (data == null)
              Text(
                emptyText,
                style: const TextStyle(color: kTextMuted, fontWeight: FontWeight.w600),
              )
            else
              ...lines.map(
                (row) => _infoLine(
                  row.label,
                  row.value,
                  copyable: row.copyable,
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _settingsCard() {
    return Card(
      child: Column(
        children: [
          SwitchListTile(
            value: _recallReminder,
            onChanged: _savingSettings
                ? null
                : (value) => _updateSetting('recallReminderEnabled', value),
            title: const Text('리콜 조치 알림'),
            subtitle: const Text('방문 예정일과 조치 상태를 앱에서 안내합니다.'),
          ),
          const Divider(height: 1),
          SwitchListTile(
            value: _scheduleReminder,
            onChanged: _savingSettings
                ? null
                : (value) => _updateSetting('scheduleReminderEnabled', value),
            title: const Text('일정 안내'),
            subtitle: const Text('챗봇과 홈에서 오늘 일정을 보여줍니다.'),
          ),
          const Divider(height: 1),
          SwitchListTile(
            value: _voiceAnswer,
            onChanged: _savingSettings
                ? null
                : (value) => _updateSetting('chatbotVoiceEnabled', value),
            title: const Text('챗봇 음성 답변'),
            subtitle: const Text('챗봇 답변을 소리로 들을 수 있게 합니다.'),
          ),
        ],
      ),
    );
  }

  Widget _consentCard() {
    return Card(
      child: Column(
        children: [
          _consentTile(
            title: '개인정보 수집·이용',
            subtitle: '서비스 제공과 계정 운영에 필요한 기본 정보를 처리합니다.',
            value: true,
            isRequired: true,
          ),
          const Divider(height: 1),
          _consentTile(
            title: '건강·위치 등 민감정보 처리',
            subtitle: '돌봄과 안전 확인에 필요한 정보만 처리합니다.',
            value: true,
            isRequired: true,
          ),
          const Divider(height: 1),
          _consentTile(
            title: 'AI 안부·위험 신호 분석',
            subtitle: 'AI 결과는 참고 정보이며 최종 판단은 사람이 수행합니다.',
            value: _aiAnalysisConsent,
            onChanged: (value) => _updateConsent('consent_ai_analysis', value),
          ),
          const Divider(height: 1),
          _consentTile(
            title: '외부 AI 서비스 전송',
            subtitle: '분석에 필요한 최소 정보만 비식별화하여 전송합니다.',
            value: _externalAiConsent,
            onChanged: (value) => _updateConsent('consent_external_ai', value),
          ),
          const Divider(height: 1),
          _consentTile(
            title: '보호자에게 정보 공유',
            subtitle: '안부, 위치, 위험 알림을 연결된 보호자에게 제공합니다.',
            value: _guardianSharingConsent,
            onChanged: (value) => _updateConsent('consent_guardian_sharing', value),
          ),
          const Divider(height: 1),
          _consentTile(
            title: '담당 복지사에게 정보 공유',
            subtitle: '상담과 후속조치에 필요한 범위에서 담당자에게 제공합니다.',
            value: _workerSharingConsent,
            onChanged: (value) => _updateConsent('consent_worker_sharing', value),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            color: kBg,
            child: const Text(
              '선택 동의는 언제든 철회할 수 있습니다. 필수 동의 철회와 개인정보 삭제는 계정 탈퇴 절차에서 처리됩니다.',
              style: TextStyle(color: kTextMuted, fontSize: 12, height: 1.45),
            ),
          ),
        ],
      ),
    );
  }

  Widget _consentTile({
    required String title,
    required String subtitle,
    required bool value,
    bool isRequired = false,
    ValueChanged<bool>? onChanged,
  }) {
    return SwitchListTile(
      value: value,
      onChanged: isRequired ? null : onChanged,
      title: Row(
        children: [
          Flexible(child: Text(title)),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
            decoration: BoxDecoration(
              color: isRequired ? const Color(0xFFEDF3EA) : const Color(0xFFFAF3E5),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              isRequired ? '필수' : '선택',
              style: TextStyle(
                color: isRequired ? kPrimary : const Color(0xFF9A6D28),
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
      subtitle: Text(subtitle),
    );
  }

  Widget _infoLine(String label, String value, {bool copyable = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 92,
            child: Text(
              label,
              style: const TextStyle(
                color: kTextMuted,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value.isEmpty ? '-' : value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      height: 1.35,
                    ),
                  ),
                ),
                if (copyable) ...[
                  const SizedBox(width: 6),
                  IconButton(
                    tooltip: '$label 복사',
                    onPressed: () => _copyToClipboard(value, label),
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.copy_outlined, size: 18),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TextSizeAction extends StatelessWidget {
  const _TextSizeAction();

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: AppTextScaleController.scale,
      builder: (context, _, __) {
        return MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: TextScaler.noScaling,
          ),
          child: Center(
            child: Semantics(
              label: '글씨 크기 조절',
              child: Container(
                margin: const EdgeInsets.only(right: 4),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: const Color(0xFFD4E8D6)),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(right: 5),
                      child: Text(
                        '글씨',
                        style: TextStyle(
                          color: Color(0xFF7A9A7C),
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          height: 1,
                        ),
                      ),
                    ),
                    _FontSizeButton(
                      index: 0,
                      fontSize: 12,
                      size: 24,
                      selected: AppTextScaleController.currentIndex == 0,
                    ),
                    const SizedBox(width: 3),
                    _FontSizeButton(
                      index: 1,
                      fontSize: 15,
                      size: 28,
                      selected: AppTextScaleController.currentIndex == 1,
                    ),
                    const SizedBox(width: 3),
                    _FontSizeButton(
                      index: 2,
                      fontSize: 18,
                      size: 32,
                      selected: AppTextScaleController.currentIndex == 2,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _FontSizeButton extends StatelessWidget {
  const _FontSizeButton({
    required this.index,
    required this.fontSize,
    required this.size,
    required this.selected,
  });

  final int index;
  final double fontSize;
  final double size;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final title = switch (index) {
      0 => '기본 크기',
      1 => '크게',
      _ => '매우 크게',
    };

    return Tooltip(
      message: title,
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () => AppTextScaleController.setScale(
          AppTextScaleController.values[index],
        ),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected ? kPrimary : Colors.transparent,
            border: Border.all(
              color: selected ? kPrimaryDark : Colors.transparent,
            ),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            '가',
            style: TextStyle(
              color: selected ? Colors.white : const Color(0xFF5F7D61),
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              height: 1,
            ),
          ),
        ),
      ),
    );
  }
}

class _InfoRow {
  const _InfoRow(
    this.label,
    this.value, {
    this.copyable = false,
  });

  final String label;
  final String value;
  final bool copyable;
}
