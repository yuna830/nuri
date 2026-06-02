import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/api/senior_api.dart';

// ─── Constants ──────────────────────────────────────────────────────────────

const _none = '없음';

const _chronicDiseases = [
  {'key': 'diabetes', 'label': '당뇨'},
  {'key': 'hypertension', 'label': '고혈압'},
  {'key': 'heart', 'label': '심장질환'},
  {'key': 'joint', 'label': '관절질환'},
  {'key': 'stroke', 'label': '뇌졸중'},
  {'key': 'kidney', 'label': '신장질환'},
  {'key': 'lung', 'label': '호흡기질환'},
  {'key': 'liver', 'label': '간질환'},
  {'key': 'cancer', 'label': '암'},
];

const _chronicLevels = [_none, '약이나 식단으로 관리 중', '최근 조절이 어렵거나 도움이 필요함'];

const _disabilityGrades = [_none, '1급', '2급', '3급', '4급', '5급', '6급'];
const _disabilityTypes = [
  _none, '지체장애', '시각장애', '청각장애', '언어장애', '지적장애', '정신장애', '기타'
];
const _medicineCounts = [_none, '1~2개', '3~5개', '6개 이상'];
const _visionLevels = [
  _none, '글씨가 조금 흐림', '큰 글씨만 보임', '거의 보이지 않음'
];
const _hearingLevels = [
  _none, '작은 소리가 잘 안 들림', '큰 소리로 말해야 들림', '거의 들리지 않음'
];
const _restNeeds = [
  _none, '30분마다 5분', '1시간마다 5분', '1시간마다 10분',
  '2시간마다 10분', '2시간마다 15분', '3시간마다 15분', '필요할 때 짧게 쉬기',
];
const _avoidEnvironments = [
  '소음 많은 곳', '먼지 많은 곳', '덥거나 추운 곳', '미끄러운 바닥', '사람 많은 곳', '혼자 하는 작업'
];
const _incomeLevels = [
  _none, '기초생활수급자', '차상위계층', '중위소득 50% 이하', '중위소득 100% 이하', '일반'
];
const _householdTypes = [
  _none, '독거 가구', '부부 가구', '자녀와 동거', '기타 가구'
];
const _currentBenefits = [
  '기초연금', '노인맞춤돌봄서비스', '장기요양등급', '응급안전안심서비스',
  '기초생활보장', '의료급여', '주거급여', '노인일자리 사업',
];
const _days = ['월', '화', '수', '목', '금', '토', '일'];
const _jobTypes = [
  '경비/청소', '급식/조리 보조', '사무 보조', '돌봄 보조',
  '작업/수공예', '판매/안내', '환경 정비', '상관없음',
];
const _jobConditions = [
  '실내 근무 선호', '안전 근무', '오후 근무', '주 3일 이하', '단기 가능', '앉아서 근무'
];
const _workTypes = [
  '장시간 서있기', '실외 작업', '야간 근무', '무거운 물건 운반',
  '컴퓨터 작업', '계단 이동', '반복 작업', '고객 응대',
];
const _yesNo = [_none, '예', '아니오'];
const _payTypes = [_none, '시급', '일급', '월급', '무관'];
const _maxHoursOptions = [
  _none, '1시간', '2시간', '3시간', '4시간', '5시간', '6시간', '8시간'
];
const _maxDistanceOptions = [
  _none, '도보 10분 이내', '도보 20분 이내', '버스 1정거장', '버스 3정거장 이내', '상관없음'
];

const _sections = [
  '인적사항', '신체정보', '복약정보', '만성질환', '거동/인지', '활동조건', '복지정보', '일자리',
];

// ─── Form data model ─────────────────────────────────────────────────────────

class _ProfileForm {
  // 인적사항
  String name = '';
  String phone = '';
  String birthDate = '';
  String gender = '여성';
  String region = '';
  String disabilityGrade = _none;
  String disabilityType = _none;

  // 신체정보
  String height = '';
  String weight = '';
  String smoking = _none;
  String drinking = _none;
  String allergies = '';

  // 복약정보
  String medicineCount = _none;
  List<Map<String, String>> medications = [];

  // 만성질환 — key → level
  Map<String, String> chronic = {
    for (final d in _chronicDiseases) d['key']!: _none,
  };

  // 거동/인지
  String walkingAid = _none;
  String dementia = _none;
  String vision = _none;
  String hearing = _none;
  String recentFall = _none;
  String hasSurgery = _none;
  String surgeryDetail = '';
  String otherDisease = '';

  // 활동조건
  String maxHours = _none;
  String maxDistance = _none;
  List<String> disabledWork = [];
  String restNeeds = _none;
  List<String> avoidEnvironments = [];

  // 복지정보
  String incomeLevel = _none;
  String householdType = _none;
  List<String> currentBenefits = [];
  String welfareMemo = '';

  // 일자리
  String payType = _none;
  List<String> hopeDays = [];
  List<String> hopeJobType = [];
  List<String> hopeCondition = [];
  String jobMemo = '';
}

// ─── Helper: parse list from JSON-ish string or List ─────────────────────────

List<String> _parseList(dynamic v) {
  if (v == null) return [];
  if (v is List) return v.map((e) => '$e').toList();
  final s = '$v'.trim();
  if (s.isEmpty || s == '[]') return [];
  try {
    // Try JSON array format
    if (s.startsWith('[')) {
      final inner = s.substring(1, s.length - 1);
      return inner
          .split(',')
          .map((e) => e.trim().replaceAll('"', '').replaceAll("'", ''))
          .where((e) => e.isNotEmpty)
          .toList();
    }
  } catch (_) {}
  return [s];
}

_ProfileForm _apiToForm(Map<String, dynamic> raw) {
  // Spring SeniorProfileResponse: { senior:{}, healthInfo:{}, jobPreference:{}, ... }
  final s = raw['senior'] as Map<String, dynamic>? ?? raw;
  final h = raw['healthInfo'] as Map<String, dynamic>? ?? {};
  final j = raw['jobPreference'] as Map<String, dynamic>? ?? {};
  final form = _ProfileForm();

  // ── 인적사항 (Senior 엔티티) ─────────────────────
  form.name = '${s['name'] ?? ''}';
  form.phone = '${s['phone'] ?? ''}';
  form.birthDate = '${s['birthDate'] ?? ''}';
  form.gender = '${s['gender'] ?? '여성'}';
  form.region = '${s['region'] ?? s['address'] ?? ''}';
  form.disabilityGrade = _orNone(s['disabilityGrade']);
  form.disabilityType = _orNone(s['disabilityType']);

  // ── 신체정보 (HealthInfo 엔티티) ─────────────────
  form.height = '${h['height'] ?? ''}';
  form.weight = '${h['weight'] ?? ''}';
  form.smoking  = _orNone(h['smoking']);
  form.drinking = _orNone(h['drinking']);
  form.allergies = '${h['allergies'] ?? ''}';

  // ── 복약정보 ──────────────────────────────────────
  form.medicineCount = _orNone(h['medicineCount']);

  final medsJson = h['medicationsJson'];
  if (medsJson is String && medsJson.isNotEmpty && medsJson != '[]') {
    try {
      final parsed = jsonDecode(medsJson);
      if (parsed is List) {
        form.medications = parsed
            .whereType<Map>()
            .map((m) => {'name': '${m['name'] ?? ''}', 'dose': '${m['dose'] ?? ''}'})
            .toList();
      }
    } catch (_) {}
  }

  // ── 만성질환 (HealthInfo 필드명: heartDisease, jointDisease …) ──
  // Spring DB 컬럼명 → Flutter form 키 매핑
  final chronicMap = <String, String>{
    'diabetes':    'diabetes',
    'hypertension':'hypertension',
    'heart':       'heartDisease',   // Spring: heartDisease
    'joint':       'jointDisease',
    'stroke':      'stroke',
    'kidney':      'kidneyDisease',
    'lung':        'lungDisease',
    'liver':       'liverDisease',
    'cancer':      'cancer',
  };
  for (final d in _chronicDiseases) {
    final formKey = d['key']!;
    final dbKey  = chronicMap[formKey] ?? formKey;
    form.chronic[formKey] = _orNone(h[dbKey]);
  }

  // ── 거동/인지 ─────────────────────────────────────
  form.walkingAid   = _orNone(h['walkingAid']);
  form.dementia     = _orNone(h['dementia']);
  form.vision       = _orNone(h['vision']);
  form.hearing      = _orNone(h['hearing']);
  form.recentFall   = _orNone(h['recentFall']);
  form.hasSurgery   = _orNone(h['hasSurgery']);
  form.surgeryDetail = '${h['surgeryDetail'] ?? ''}';
  form.otherDisease  = '${h['otherDisease'] ?? ''}';

  // ── 활동조건 (Spring: restNeed / avoidEnvironment — 단수) ──
  form.maxHours        = _orNone(h['maxHours']);
  form.maxDistance     = _orNone(h['maxDistance']);
  form.disabledWork    = _parseList(h['disabledWork']);
  form.restNeeds       = _orNone(h['restNeed']);       // Spring: restNeed
  form.avoidEnvironments = _parseList(h['avoidEnvironment']); // Spring: avoidEnvironment

  // ── 복지정보 ─────────────────────────────────────
  form.incomeLevel     = _orNone(h['incomeLevel']);
  form.householdType   = _orNone(h['householdType']);
  form.currentBenefits = _parseList(h['currentBenefits']);
  form.welfareMemo     = '${h['welfareMemo'] ?? ''}';

  // ── 일자리 (JobPreference 엔티티, memo 필드 사용) ──
  form.payType     = _orNone(j['payType']);
  form.hopeDays    = _parseList(j['hopeDays']);
  form.hopeJobType = _parseList(j['hopeJobType']);
  form.hopeCondition = _parseList(j['hopeCondition']);
  form.jobMemo     = '${j['memo'] ?? ''}';  // Spring: memo (not jobMemo)

  return form;
}

String _orNone(dynamic v) {
  final s = v?.toString() ?? '';
  return s.isNotEmpty ? s : _none;
}

Map<String, dynamic> _formToApi(_ProfileForm f) {
  return {
    'name': f.name,
    'phone': f.phone,
    'birthDate': f.birthDate,
    'gender': f.gender,
    'region': f.region,
    'disabilityGrade': f.disabilityGrade == _none ? '' : f.disabilityGrade,
    'disabilityType': f.disabilityType == _none ? '' : f.disabilityType,
    'height': f.height,
    'weight': f.weight,
    'smoking': f.smoking == _none ? '' : f.smoking,
    'drinking': f.drinking == _none ? '' : f.drinking,
    'allergies': f.allergies,
    'medicineCount': f.medicineCount == _none ? '' : f.medicineCount,
    'medications': f.medications,
    'medicationsJson': f.medications.toString(),
    for (final d in _chronicDiseases)
      d['key']!: f.chronic[d['key']] == _none ? '' : f.chronic[d['key']],
    'walkingAid': f.walkingAid == _none ? '' : f.walkingAid,
    'dementia': f.dementia == _none ? '' : f.dementia,
    'vision': f.vision == _none ? '' : f.vision,
    'hearing': f.hearing == _none ? '' : f.hearing,
    'recentFall': f.recentFall == _none ? '' : f.recentFall,
    'hasSurgery': f.hasSurgery == _none ? '' : f.hasSurgery,
    'surgeryDetail': f.surgeryDetail,
    'otherDisease': f.otherDisease,
    'maxHours': f.maxHours == _none ? '' : f.maxHours,
    'maxDistance': f.maxDistance == _none ? '' : f.maxDistance,
    'disabledWork': f.disabledWork,
    'restNeeds': f.restNeeds == _none ? '' : f.restNeeds,
    'avoidEnvironments': f.avoidEnvironments,
    'incomeLevel': f.incomeLevel == _none ? '' : f.incomeLevel,
    'householdType': f.householdType == _none ? '' : f.householdType,
    'currentBenefits': f.currentBenefits,
    'welfareMemo': f.welfareMemo,
    'payType': f.payType == _none ? '' : f.payType,
    'hopeDays': f.hopeDays,
    'hopeJobType': f.hopeJobType,
    'hopeCondition': f.hopeCondition,
    'jobMemo': f.jobMemo,
  };
}

// ─── Screen ──────────────────────────────────────────────────────────────────

typedef ActionRegistrar = void Function({
  required VoidCallback action,
  required IconData icon,
  required String tooltip,
});

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({
    super.key,
    required this.seniorId,
    this.hideAppBar = false,
    this.onRegisterAction,
  });
  final int seniorId;
  final bool hideAppBar;
  final ActionRegistrar? onRegisterAction;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  final _api = const SeniorApi();
  late TabController _tabController;

  _ProfileForm _form = _ProfileForm();
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _sections.length, vsync: this);
    _load();
    widget.onRegisterAction?.call(
      action: _save,
      icon: Icons.save_outlined,
      tooltip: '저장',
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      setState(() {
        _loading = true;
        _error = null;
      });
      final raw = await _api.fetchProfile(widget.seniorId);
      if (!mounted) return;
      setState(() {
        _form = _apiToForm(raw);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '프로필을 불러오지 못했습니다.';
        _loading = false;
      });
    }
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await _api.updateProfile(widget.seniorId, _formToApi(_form));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장되었습니다'), backgroundColor: Color(0xFF86A788)),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장에 실패했습니다'), backgroundColor: Color(0xFFD94E4E)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        automaticallyImplyLeading: !widget.hideAppBar,
        title: widget.hideAppBar
            ? null
            : const Text(
                '내 정보',
                style: TextStyle(
                    color: Color(0xFF1F2A20), fontWeight: FontWeight.w900),
              ),
        actions: [
          if (!_loading && !widget.hideAppBar)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: TextButton(
                onPressed: _saving ? null : _save,
                child: Text(
                  _saving ? '저장 중...' : '저장',
                  style: const TextStyle(
                    color: Color(0xFF86A788),
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
        ],
        bottom: _loading
            ? null
            : TabBar(
                controller: _tabController,
                isScrollable: true,
                labelColor: const Color(0xFF86A788),
                unselectedLabelColor: const Color(0xFF6D766A),
                indicatorColor: const Color(0xFF86A788),
                labelStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                tabAlignment: TabAlignment.start,
                tabs: _sections.map((s) => Tab(text: s)).toList(),
              ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF86A788)))
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _PersonalSection(form: _form, onChanged: () => setState(() {})),
                    _BodySection(form: _form, onChanged: () => setState(() {})),
                    _MedicationSection(form: _form, onChanged: () => setState(() {})),
                    _ChronicSection(form: _form, onChanged: () => setState(() {})),
                    _MobilitySection(form: _form, onChanged: () => setState(() {})),
                    _ActivitySection(form: _form, onChanged: () => setState(() {})),
                    _WelfareSection(form: _form, onChanged: () => setState(() {})),
                    _JobSection(form: _form, onChanged: () => setState(() {})),
                  ],
                ),
    );
  }
}

// ─── 인적사항 ─────────────────────────────────────────────────────────────────

class _PersonalSection extends StatefulWidget {
  const _PersonalSection({required this.form, required this.onChanged});
  final _ProfileForm form;
  final VoidCallback onChanged;

  @override
  State<_PersonalSection> createState() => _PersonalSectionState();
}

class _PersonalSectionState extends State<_PersonalSection> {
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _birthDate;
  late final TextEditingController _region;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.form.name);
    _phone = TextEditingController(text: widget.form.phone);
    _birthDate = TextEditingController(text: widget.form.birthDate);
    _region = TextEditingController(text: widget.form.region);
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _birthDate.dispose();
    _region.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    DateTime initial;
    try {
      initial = DateTime.parse(widget.form.birthDate);
    } catch (_) {
      initial = DateTime(now.year - 70);
    }
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: now,
    );
    if (picked == null) return;
    final s =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    _birthDate.text = s;
    widget.form.birthDate = s;
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(children: [
      const _FieldLabel('이름'),
      _FormField(controller: _name, hint: '예: 김나리', onChanged: (v) {
        widget.form.name = v;
        widget.onChanged();
      }),
      const _FieldLabel('전화번호'),
      _FormField(
        controller: _phone,
        hint: '예: 01012345678',
        keyboard: TextInputType.phone,
        onChanged: (v) {
          widget.form.phone = v;
          widget.onChanged();
        },
      ),
      const _FieldLabel('생년월일'),
      TextField(
        controller: _birthDate,
        readOnly: true,
        onTap: _pickDate,
        decoration: _deco(hint: '예: 1950-01-01', suffix: Icons.calendar_month_outlined),
      ),
      const _FieldLabel('성별'),
      Row(children: [
        Expanded(
            child: _ToggleButton(
                label: '여성',
                selected: widget.form.gender == '여성',
                onTap: () {
                  widget.form.gender = '여성';
                  widget.onChanged();
                })),
        const SizedBox(width: 10),
        Expanded(
            child: _ToggleButton(
                label: '남성',
                selected: widget.form.gender == '남성',
                onTap: () {
                  widget.form.gender = '남성';
                  widget.onChanged();
                })),
      ]),
      const _FieldLabel('주소'),
      _FormField(controller: _region, hint: '예: 서울 광진구 자양동', onChanged: (v) {
        widget.form.region = v;
        widget.onChanged();
      }),
      const _FieldLabel('장애 등급'),
      _Dropdown(
          value: widget.form.disabilityGrade,
          items: _disabilityGrades,
          onChanged: (v) {
            widget.form.disabilityGrade = v;
            widget.onChanged();
          }),
      const _FieldLabel('장애 유형'),
      _Dropdown(
          value: widget.form.disabilityType,
          items: _disabilityTypes,
          onChanged: (v) {
            widget.form.disabilityType = v;
            widget.onChanged();
          }),
    ]);
  }
}

// ─── 신체정보 ─────────────────────────────────────────────────────────────────

class _BodySection extends StatefulWidget {
  const _BodySection({required this.form, required this.onChanged});
  final _ProfileForm form;
  final VoidCallback onChanged;

  @override
  State<_BodySection> createState() => _BodySectionState();
}

class _BodySectionState extends State<_BodySection> {
  late final TextEditingController _height;
  late final TextEditingController _weight;
  late final TextEditingController _allergies;

  @override
  void initState() {
    super.initState();
    _height = TextEditingController(text: widget.form.height);
    _weight = TextEditingController(text: widget.form.weight);
    _allergies = TextEditingController(text: widget.form.allergies);
  }

  @override
  void dispose() {
    _height.dispose();
    _weight.dispose();
    _allergies.dispose();
    super.dispose();
  }

  String _bmi() {
    final h = double.tryParse(widget.form.height);
    final w = double.tryParse(widget.form.weight);
    if (h == null || w == null || h <= 0) return '-';
    final bmi = w / ((h / 100) * (h / 100));
    final label = bmi < 18.5
        ? '저체중'
        : bmi < 23
            ? '정상'
            : bmi < 25
                ? '과체중'
                : '비만';
    return '${bmi.toStringAsFixed(1)} ($label)';
  }

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(children: [
      const _FieldLabel('키 (cm)'),
      _FormField(
        controller: _height,
        hint: '예: 165',
        keyboard: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
        onChanged: (v) {
          widget.form.height = v;
          widget.onChanged();
        },
      ),
      const _FieldLabel('체중 (kg)'),
      _FormField(
        controller: _weight,
        hint: '예: 62',
        keyboard: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
        onChanged: (v) {
          widget.form.weight = v;
          widget.onChanged();
        },
      ),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF0F7F0),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(children: [
          const Icon(Icons.monitor_weight_outlined, color: Color(0xFF86A788), size: 20),
          const SizedBox(width: 8),
          Text('BMI: ${_bmi()}',
              style: const TextStyle(
                  color: Color(0xFF1F2A20), fontWeight: FontWeight.w800, fontSize: 15)),
        ]),
      ),
      const _FieldLabel('흡연'),
      _Dropdown(
          value: widget.form.smoking,
          items: const [_none, '비흡연', '흡연', '금연 중'],
          onChanged: (v) {
            widget.form.smoking = v;
            widget.onChanged();
          }),
      const _FieldLabel('음주'),
      _Dropdown(
          value: widget.form.drinking,
          items: const [_none, '음주 안 함', '가끔', '자주'],
          onChanged: (v) {
            widget.form.drinking = v;
            widget.onChanged();
          }),
      const _FieldLabel('알레르기'),
      _FormField(controller: _allergies, hint: '예: 땅콩, 복숭아', onChanged: (v) {
        widget.form.allergies = v;
        widget.onChanged();
      }),
    ]);
  }
}

// ─── 복약정보 ─────────────────────────────────────────────────────────────────

class _MedicationSection extends StatefulWidget {
  const _MedicationSection({required this.form, required this.onChanged});
  final _ProfileForm form;
  final VoidCallback onChanged;

  @override
  State<_MedicationSection> createState() => _MedicationSectionState();
}

class _MedicationSectionState extends State<_MedicationSection> {
  void _add() {
    widget.form.medications.add({'name': '', 'dose': ''});
    widget.onChanged();
    setState(() {});
  }

  void _remove(int i) {
    widget.form.medications.removeAt(i);
    widget.onChanged();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(children: [
      const _FieldLabel('복용 약품 수'),
      _Dropdown(
          value: widget.form.medicineCount,
          items: _medicineCounts,
          onChanged: (v) {
            widget.form.medicineCount = v;
            widget.onChanged();
          }),
      const SizedBox(height: 8),
      Row(children: [
        const Expanded(
            child: Text('복용 약품 목록',
                style: TextStyle(
                    color: Color(0xFF111827),
                    fontSize: 17,
                    fontWeight: FontWeight.w900))),
        TextButton.icon(
          onPressed: _add,
          icon: const Icon(Icons.add, size: 18),
          label: const Text('추가'),
          style: TextButton.styleFrom(foregroundColor: const Color(0xFF86A788)),
        ),
      ]),
      if (widget.form.medications.isEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Center(
              child: Text('등록된 약품이 없습니다',
                  style: TextStyle(color: Color(0xFF6D766A), fontSize: 14))),
        )
      else
        ...widget.form.medications.asMap().entries.map((entry) {
          final i = entry.key;
          final med = entry.value;
          return _MedicationRow(
            index: i,
            med: med,
            onRemove: () => _remove(i),
            onChanged: () {
              widget.onChanged();
              setState(() {});
            },
          );
        }),
    ]);
  }
}

class _MedicationRow extends StatefulWidget {
  const _MedicationRow({
    required this.index,
    required this.med,
    required this.onRemove,
    required this.onChanged,
  });
  final int index;
  final Map<String, String> med;
  final VoidCallback onRemove;
  final VoidCallback onChanged;

  @override
  State<_MedicationRow> createState() => _MedicationRowState();
}

class _MedicationRowState extends State<_MedicationRow> {
  late final TextEditingController _name;
  late final TextEditingController _dose;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.med['name']);
    _dose = TextEditingController(text: widget.med['dose']);
  }

  @override
  void dispose() {
    _name.dispose();
    _dose.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F5E8),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('약품 ${widget.index + 1}',
              style: const TextStyle(
                  color: Color(0xFF6D766A), fontSize: 13, fontWeight: FontWeight.w700)),
          const Spacer(),
          GestureDetector(
            onTap: widget.onRemove,
            child: const Icon(Icons.close, size: 18, color: Color(0xFFD94E4E)),
          ),
        ]),
        const SizedBox(height: 8),
        TextField(
          controller: _name,
          decoration: _deco(hint: '약품명 예: 아스피린'),
          onChanged: (v) {
            widget.med['name'] = v;
            widget.onChanged();
          },
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _dose,
          decoration: _deco(hint: '복용량 예: 1정 하루 1회'),
          onChanged: (v) {
            widget.med['dose'] = v;
            widget.onChanged();
          },
        ),
      ]),
    );
  }
}

// ─── 만성질환 ─────────────────────────────────────────────────────────────────

class _ChronicSection extends StatelessWidget {
  const _ChronicSection({required this.form, required this.onChanged});
  final _ProfileForm form;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(
      children: _chronicDiseases.map((d) {
        final key = d['key']!;
        final label = d['label']!;
        return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _FieldLabel(label),
          _Dropdown(
            value: form.chronic[key] ?? _none,
            items: _chronicLevels,
            onChanged: (v) {
              form.chronic[key] = v;
              onChanged();
            },
          ),
        ]);
      }).toList(),
    );
  }
}

// ─── 거동/인지 ────────────────────────────────────────────────────────────────

class _MobilitySection extends StatefulWidget {
  const _MobilitySection({required this.form, required this.onChanged});
  final _ProfileForm form;
  final VoidCallback onChanged;

  @override
  State<_MobilitySection> createState() => _MobilitySectionState();
}

class _MobilitySectionState extends State<_MobilitySection> {
  late final TextEditingController _surgeryDetail;
  late final TextEditingController _otherDisease;

  @override
  void initState() {
    super.initState();
    _surgeryDetail = TextEditingController(text: widget.form.surgeryDetail);
    _otherDisease = TextEditingController(text: widget.form.otherDisease);
  }

  @override
  void dispose() {
    _surgeryDetail.dispose();
    _otherDisease.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(children: [
      const _FieldLabel('보행 보조기 사용'),
      _Dropdown(
          value: widget.form.walkingAid,
          items: const [_none, '사용 안 함', '지팡이', '보행기', '휠체어'],
          onChanged: (v) {
            widget.form.walkingAid = v;
            widget.onChanged();
          }),
      const _FieldLabel('치매'),
      _Dropdown(
          value: widget.form.dementia,
          items: _yesNo,
          onChanged: (v) {
            widget.form.dementia = v;
            widget.onChanged();
          }),
      const _FieldLabel('시력'),
      _Dropdown(
          value: widget.form.vision,
          items: _visionLevels,
          onChanged: (v) {
            widget.form.vision = v;
            widget.onChanged();
          }),
      const _FieldLabel('청력'),
      _Dropdown(
          value: widget.form.hearing,
          items: _hearingLevels,
          onChanged: (v) {
            widget.form.hearing = v;
            widget.onChanged();
          }),
      const _FieldLabel('최근 낙상 경험'),
      _Dropdown(
          value: widget.form.recentFall,
          items: _yesNo,
          onChanged: (v) {
            widget.form.recentFall = v;
            widget.onChanged();
          }),
      const _FieldLabel('수술 이력'),
      _Dropdown(
          value: widget.form.hasSurgery,
          items: _yesNo,
          onChanged: (v) {
            widget.form.hasSurgery = v;
            widget.onChanged();
          }),
      if (widget.form.hasSurgery == '예') ...[
        const _FieldLabel('수술 내용'),
        _FormField(
          controller: _surgeryDetail,
          hint: '예: 무릎 인공관절 수술',
          onChanged: (v) {
            widget.form.surgeryDetail = v;
            widget.onChanged();
          },
        ),
      ],
      const _FieldLabel('기타 질환'),
      _FormField(
        controller: _otherDisease,
        hint: '기타 질환이 있으면 입력해주세요',
        maxLines: 2,
        onChanged: (v) {
          widget.form.otherDisease = v;
          widget.onChanged();
        },
      ),
    ]);
  }
}

// ─── 활동조건 ─────────────────────────────────────────────────────────────────

class _ActivitySection extends StatelessWidget {
  const _ActivitySection({required this.form, required this.onChanged});
  final _ProfileForm form;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(children: [
      const _FieldLabel('최대 근무 시간'),
      _Dropdown(
          value: form.maxHours,
          items: _maxHoursOptions,
          onChanged: (v) {
            form.maxHours = v;
            onChanged();
          }),
      const _FieldLabel('통근 가능 거리'),
      _Dropdown(
          value: form.maxDistance,
          items: _maxDistanceOptions,
          onChanged: (v) {
            form.maxDistance = v;
            onChanged();
          }),
      const _FieldLabel('힘든 업무 (중복 선택)'),
      _ChipGroup(
          items: _workTypes,
          selected: form.disabledWork,
          onChanged: (v) {
            form.disabledWork = v;
            onChanged();
          }),
      const _FieldLabel('휴식 필요'),
      _Dropdown(
          value: form.restNeeds,
          items: _restNeeds,
          onChanged: (v) {
            form.restNeeds = v;
            onChanged();
          }),
      const _FieldLabel('피해야 할 환경 (중복 선택)'),
      _ChipGroup(
          items: _avoidEnvironments,
          selected: form.avoidEnvironments,
          onChanged: (v) {
            form.avoidEnvironments = v;
            onChanged();
          }),
    ]);
  }
}

// ─── 복지정보 ─────────────────────────────────────────────────────────────────

class _WelfareSection extends StatefulWidget {
  const _WelfareSection({required this.form, required this.onChanged});
  final _ProfileForm form;
  final VoidCallback onChanged;

  @override
  State<_WelfareSection> createState() => _WelfareSectionState();
}

class _WelfareSectionState extends State<_WelfareSection> {
  late final TextEditingController _memo;

  @override
  void initState() {
    super.initState();
    _memo = TextEditingController(text: widget.form.welfareMemo);
  }

  @override
  void dispose() {
    _memo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(children: [
      const _FieldLabel('소득 수준'),
      _Dropdown(
          value: widget.form.incomeLevel,
          items: _incomeLevels,
          onChanged: (v) {
            widget.form.incomeLevel = v;
            widget.onChanged();
          }),
      const _FieldLabel('가구 형태'),
      _Dropdown(
          value: widget.form.householdType,
          items: _householdTypes,
          onChanged: (v) {
            widget.form.householdType = v;
            widget.onChanged();
          }),
      const _FieldLabel('현재 이용 중인 복지서비스 (중복 선택)'),
      _ChipGroup(
          items: _currentBenefits,
          selected: widget.form.currentBenefits,
          onChanged: (v) {
            widget.form.currentBenefits = v;
            widget.onChanged();
          }),
      const _FieldLabel('메모'),
      _FormField(
        controller: _memo,
        hint: '복지 관련 메모',
        maxLines: 3,
        onChanged: (v) {
          widget.form.welfareMemo = v;
          widget.onChanged();
        },
      ),
    ]);
  }
}

// ─── 일자리 ───────────────────────────────────────────────────────────────────

class _JobSection extends StatefulWidget {
  const _JobSection({required this.form, required this.onChanged});
  final _ProfileForm form;
  final VoidCallback onChanged;

  @override
  State<_JobSection> createState() => _JobSectionState();
}

class _JobSectionState extends State<_JobSection> {
  late final TextEditingController _memo;

  @override
  void initState() {
    super.initState();
    _memo = TextEditingController(text: widget.form.jobMemo);
  }

  @override
  void dispose() {
    _memo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(children: [
      const _FieldLabel('선호 급여 형태'),
      _Dropdown(
          value: widget.form.payType,
          items: _payTypes,
          onChanged: (v) {
            widget.form.payType = v;
            widget.onChanged();
          }),
      const _FieldLabel('희망 요일 (중복 선택)'),
      _ChipGroup(
          items: _days,
          selected: widget.form.hopeDays,
          onChanged: (v) {
            widget.form.hopeDays = v;
            widget.onChanged();
          }),
      const _FieldLabel('희망 직종 (중복 선택)'),
      _ChipGroup(
          items: _jobTypes,
          selected: widget.form.hopeJobType,
          onChanged: (v) {
            widget.form.hopeJobType = v;
            widget.onChanged();
          }),
      const _FieldLabel('희망 조건 (중복 선택)'),
      _ChipGroup(
          items: _jobConditions,
          selected: widget.form.hopeCondition,
          onChanged: (v) {
            widget.form.hopeCondition = v;
            widget.onChanged();
          }),
      const _FieldLabel('메모'),
      _FormField(
        controller: _memo,
        hint: '일자리 관련 메모',
        maxLines: 3,
        onChanged: (v) {
          widget.form.jobMemo = v;
          widget.onChanged();
        },
      ),
    ]);
  }
}

// ─── Shared widgets ───────────────────────────────────────────────────────────

class _SectionScroll extends StatelessWidget {
  const _SectionScroll({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: _withSpacing(children),
      ),
    );
  }

  List<Widget> _withSpacing(List<Widget> items) {
    final result = <Widget>[];
    for (int i = 0; i < items.length; i++) {
      result.add(items[i]);
      if (i < items.length - 1) result.add(const SizedBox(height: 12));
    }
    return result;
  }
}

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6, top: 4),
      child: Text(
        text,
        style: const TextStyle(
          color: Color(0xFF111827),
          fontSize: 15,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _FormField extends StatelessWidget {
  const _FormField({
    required this.controller,
    required this.hint,
    required this.onChanged,
    this.keyboard,
    this.inputFormatters,
    this.maxLines = 1,
  });

  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;
  final TextInputType? keyboard;
  final List<TextInputFormatter>? inputFormatters;
  final int maxLines;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboard,
      inputFormatters: inputFormatters,
      maxLines: maxLines,
      onChanged: onChanged,
      decoration: _deco(hint: hint),
    );
  }
}

class _Dropdown extends StatelessWidget {
  const _Dropdown({
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String value;
  final List<String> items;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final safeValue = items.contains(value) ? value : items.first;
    return DropdownButtonFormField<String>(
      value: safeValue,
      items: items
          .map((e) => DropdownMenuItem<String>(value: e, child: Text(e)))
          .toList(),
      onChanged: (v) {
        if (v != null) onChanged(v);
      },
      decoration: _deco(hint: ''),
    );
  }
}

class _ToggleButton extends StatelessWidget {
  const _ToggleButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 48,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          backgroundColor:
              selected ? const Color(0xFF86A788) : const Color(0xFFF7F5E8),
          foregroundColor:
              selected ? Colors.white : const Color(0xFF1F2A20),
          side: BorderSide(
            color: selected ? const Color(0xFF86A788) : const Color(0xFFF7F5E8),
          ),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
        child: Text(label,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
      ),
    );
  }
}

class _ChipGroup extends StatelessWidget {
  const _ChipGroup({
    required this.items,
    required this.selected,
    required this.onChanged,
  });
  final List<String> items;
  final List<String> selected;
  final ValueChanged<List<String>> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 4,
      children: items.map((item) {
        final isSelected = selected.contains(item);
        return FilterChip(
          label: Text(item),
          selected: isSelected,
          onSelected: (on) {
            final next = List<String>.from(selected);
            if (on) {
              next.add(item);
            } else {
              next.remove(item);
            }
            onChanged(next);
          },
          selectedColor: const Color(0xFF86A788).withValues(alpha: 0.2),
          checkmarkColor: const Color(0xFF86A788),
          labelStyle: TextStyle(
            color: isSelected ? const Color(0xFF2D5A2E) : const Color(0xFF1F2A20),
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
          side: BorderSide(
            color: isSelected ? const Color(0xFF86A788) : const Color(0xFFD1D5DB),
          ),
          backgroundColor: const Color(0xFFF7F5E8),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        );
      }).toList(),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const Icon(Icons.error_outline, size: 48, color: Color(0xFFD94E4E)),
        const SizedBox(height: 12),
        Text(message,
            style: const TextStyle(color: Color(0xFF6D766A), fontSize: 15)),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: onRetry,
          style: FilledButton.styleFrom(backgroundColor: const Color(0xFF86A788)),
          child: const Text('다시 시도'),
        ),
      ]),
    );
  }
}

InputDecoration _deco({required String hint, IconData? suffix}) {
  return InputDecoration(
    hintText: hint,
    filled: true,
    fillColor: const Color(0xFFF7F5E8),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    suffixIcon: suffix == null ? null : Icon(suffix),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
  );
}
