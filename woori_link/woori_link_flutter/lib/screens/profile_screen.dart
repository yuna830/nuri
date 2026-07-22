import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/contact_api.dart';
import '../api/senior_api.dart';
import '../services/auth_service.dart';
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
  bool _recallReminder = true;
  bool _scheduleReminder = true;
  bool _voiceAnswer = true;

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
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('내 정보를 불러오지 못했습니다.')),
      );
    }
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
    if (gender == 'M' || gender == 'MALE' || gender == '남') return '남성';
    if (gender == 'F' || gender == 'FEMALE' || gender == '여') return '여성';
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
    final addressCtrl = TextEditingController(text: _text(senior['address'], fallback: ''));
    final detailAddressCtrl =
        TextEditingController(text: _text(senior['detailAddress'], fallback: ''));

    final shouldSave = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('내 정보 수정'),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _editField(nameCtrl, '이름'),
            const SizedBox(height: 10),
            _editField(phoneCtrl, '전화번호', keyboardType: TextInputType.phone),
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
    );

    if (shouldSave != true) return;

    try {
      setState(() => _saving = true);
      final id = _intValue(senior['id']) ?? await AuthService.getUserId();
      if (id == null) throw Exception('사용자 ID가 없습니다.');

      final updated = await SeniorApi.updateSenior(id, {
        'name': nameCtrl.text.trim(),
        'phone': phoneCtrl.text.trim(),
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

  Widget _editField(
    TextEditingController controller,
    String label, {
    TextInputType? keyboardType,
  }) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: kBg,
      ),
    );
  }

  Future<void> _call(String? phone) async {
    final number = '${phone ?? ''}'.replaceAll(RegExp(r'\s+'), '');
    if (number.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('등록된 전화번호가 없습니다.')),
      );
      return;
    }

    final uri = Uri.parse('tel:$number');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
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
                _InfoRow('전화번호', _text(_guardian?['phone'])),
                _InfoRow('이메일', _text(_guardian?['email'])),
              ],
            ),
            const SizedBox(height: 10),
            _contactCard(
              title: '담당 복지사',
              icon: Icons.support_agent,
              data: _worker,
              emptyText: '배정된 복지사가 없습니다.',
              lines: [
                _InfoRow('기관', _text(_worker?['organization'])),
                _InfoRow('전화번호', _text(_worker?['phone'])),
                _InfoRow('이메일', _text(_worker?['email'])),
              ],
            ),
            const SizedBox(height: 18),
            _sectionTitle('복지 정보'),
            _infoCard([
              _InfoRow('소득 구분', _incomeLabel(senior['incomeLevel'])),
              _InfoRow('독거 여부', senior['livingAlone'] == true ? '독거' : '해당 없음'),
              _InfoRow('주거 형태', _text(senior['housingType'])),
              _InfoRow('에너지바우처', senior['energyVoucherApplied'] == true ? '신청 완료' : '미신청'),
              _InfoRow('전기요금 할인', senior['electricityDiscountApplied'] == true ? '신청 완료' : '미신청'),
              _InfoRow('가스요금 할인', senior['gasDiscountApplied'] == true ? '신청 완료' : '미신청'),
            ]),
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
            ...rows.map((row) => _infoLine(row.label, row.value)),
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
  }) {
    final phone = '${data?['phone'] ?? ''}'.trim();
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
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: '전화',
                  onPressed: phone.isEmpty ? null : () => _call(phone),
                  icon: const Icon(Icons.call_outlined),
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
              ...lines.map((row) => _infoLine(row.label, row.value)),
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

  Widget _infoLine(String label, String value) {
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
            child: Text(
              value.isEmpty ? '-' : value,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow {
  const _InfoRow(this.label, this.value);

  final String label;
  final String value;
}
