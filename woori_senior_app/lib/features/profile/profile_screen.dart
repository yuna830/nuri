import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;
import 'package:kakao_map_plugin/kakao_map_plugin.dart' as kakao;

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';
import '../../core/location/background_location_service.dart';
import '../../core/storage/senior_session_storage.dart';
import '../auth/login_screen.dart';

const _disableKakaoMap = bool.fromEnvironment('DISABLE_KAKAO_MAP');

/// data: URL이면 MemoryImage, 아니면 NetworkImage 반환
ImageProvider _profileImageProvider(String url) {
  if (url.startsWith('data:')) {
    try {
      final base64Data = url.substring(url.indexOf(',') + 1);
      return MemoryImage(base64Decode(base64Data));
    } catch (_) {}
  }
  return NetworkImage(url);
}

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
  '상관없음', '소음 많은 곳', '먼지 많은 곳', '덥거나 추운 곳', '미끄러운 바닥', '사람 많은 곳', '혼자 하는 작업'
];
// 웹앱 LIVING_COST_STATUSES 와 동일
const _livingCostStatuses = [
  _none, '잘 모르겠어요', '수입이 거의 없어요', '기초연금 정도만 받아요',
  '가족에게 일부 도움을 받아요', '연금이나 월급 수입이 있어요',
  '생계비/의료비/주거비 지원을 받고 있어요',
];
// 웹앱 HOUSEHOLD_TYPES 와 동일
const _householdTypes = [
  _none, '잘 모르겠어요', '혼자 살아요', '배우자와 살아요',
  '자녀/가족과 살아요', '시설이나 요양원에 있어요', '기타',
];
// 웹앱 PENSION_STATUSES 와 동일
const _pensionStatuses = [
  _none, '잘 모르겠어요', '기초연금을 받고 있어요', '국민연금을 받고 있어요',
  '기초연금과 국민연금을 모두 받고 있어요', '신청했지만 기다리는 중이에요', '신청한 적 없어요',
];
// 웹앱 HOUSING_TYPES 와 동일
const _housingTypes = [
  _none, '잘 모르겠어요', '자가', '전세', '월세', '공공임대', '시설이나 요양원', '기타',
];
// 웹앱 CURRENT_BENEFITS 와 동일
const _currentBenefits = [
  '잘 모르겠어요', '받고 있는 지원이 없어요', '기초연금', '생계비/의료비/주거비 지원',
  '장기요양 서비스', '장애 관련 지원', '노인 일자리', '노인맞춤돌봄서비스', '응급안전안심서비스',
];
// 웹앱 CARE_NEEDS 와 동일
const _careNeeds = [
  '잘 모르겠어요', '특별히 없어요', '식사 준비', '청소/빨래',
  '목욕/위생', '병원 동행', '외출/장보기', '약 챙기기', '안부 확인',
];
const _days = ['월', '화', '수', '목', '금', '토', '일'];
const _jobTypes = [
  '상관없음', '경비/청소', '급식/조리 보조', '사무 보조', '돌봄 보조',
  '작업/수공예', '판매/안내', '환경 정비',
];
const _jobConditions = [
  '상관없음', '실내 근무 선호', '안전 근무', '오후 근무', '주 3일 이하', '단기 가능', '앉아서 근무'
];
const _workTypes = [
  '상관없음', '장시간 서있기', '실외 작업', '야간 근무', '무거운 물건 운반',
  '컴퓨터 작업', '계단 이동', '반복 작업', '고객 응대',
];
const _yesNo = [_none, '예', '아니오'];
const _payTypes = ['상관없음', '시급', '월급', '일당'];
const _maxHoursOptions = [
  _none, '상관없음', '1시간', '2시간', '3시간', '4시간', '5시간', '6시간', '8시간'
];
const _maxDistanceOptions = [
  _none, '도보 10분 이내', '도보 20분 이내', '버스 1정거장', '버스 3정거장 이내', '상관없음'
];

typedef _FieldCheck = ({String label, bool Function(_ProfileForm) isEmpty});

List<_FieldCheck> _sectionFieldChecks(int i) {
  switch (i) {
    case 0: return [
      (label: '장애 등급', isEmpty: (f) => f.disabilityGrade == _none),
      (label: '장애 유형', isEmpty: (f) => f.disabilityType == _none),
    ];
    case 1: return [
      (label: '흡연 여부', isEmpty: (f) => f.smoking == _none),
      (label: '음주 여부', isEmpty: (f) => f.drinking == _none),
    ];
    case 2: return [
      (label: '복용 약품 수', isEmpty: (f) => f.medicineCount == _none),
    ];
    case 3:
      return _chronicDiseases.map((d) {
        final key = d['key']!;
        return (label: d['label']!, isEmpty: (_ProfileForm f) => f.chronic[key] == _none);
      }).toList();
    case 4: return [
      (label: '보행 보조기 사용', isEmpty: (f) => f.walkingAid == _none),
      (label: '치매', isEmpty: (f) => f.dementia == _none),
      (label: '시력', isEmpty: (f) => f.vision == _none),
      (label: '청력', isEmpty: (f) => f.hearing == _none),
      (label: '최근 낙상 경험', isEmpty: (f) => f.recentFall == _none),
      (label: '수술 이력', isEmpty: (f) => f.hasSurgery == _none),
    ];
    case 5: return [
      (label: '생활비 상황', isEmpty: (f) => f.livingCostStatus == _none),
      (label: '가구 형태', isEmpty: (f) => f.householdType == _none),
      (label: '연금 수급 상태', isEmpty: (f) => f.pensionStatus == _none),
      (label: '주거 형태', isEmpty: (f) => f.housingType == _none),
    ];
    case 6: return [
      (label: '최대 근무 시간', isEmpty: (f) => f.maxHours == _none),
      (label: '통근 가능 거리', isEmpty: (f) => f.maxDistance == _none),
      (label: '휴식 필요', isEmpty: (f) => f.restNeeds == _none),
      (label: '선호 급여 형태', isEmpty: (f) => f.payType == _none),
    ];
    default: return [];
  }
}

const _sections = [
  '인적사항', '신체정보', '복약정보', '만성질환', '거동/인지', '복지정보', '활동 및 일자리',
];

// ─── Form data model ─────────────────────────────────────────────────────────

class _ProfileForm {
  // 인적사항
  String name = '';
  String phone = '';
  String birthDate = '';
  String gender = '여성';
  String region = '';
  String profileImageUrl = '';
  String disabilityGrade = _none;
  String disabilityType = _none;
  bool hasGuardian = true; // 보호자 유무 (true=있음, false=없음)

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
  List<Map<String, dynamic>> surgeries = [];
  String otherDisease = '';

  // 활동조건
  String maxHours = _none;
  String maxDistance = _none;
  List<String> disabledWork = [];
  String restNeeds = _none;
  List<String> avoidEnvironments = [];

  // 복지정보
  String incomeLevel = _none;
  String livingCostStatus = _none;
  String householdType = _none;
  String pensionStatus = _none;
  String housingType = _none;
  List<String> currentBenefits = [];
  List<String> careNeeds = [];
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
  if (v is List) return v.map((e) => '$e').where((e) => e.isNotEmpty).toList();
  final s = '$v'.trim();
  if (s.isEmpty || s == '[]') return [];
  try {
    if (s.startsWith('[')) {
      final inner = s.substring(1, s.length - 1);
      return inner
          .split(',')
          .map((e) => e.trim().replaceAll('"', '').replaceAll("'", ''))
          .where((e) => e.isNotEmpty)
          .toList();
    }
  } catch (_) {}
  // CSV 문자열 (웹에서 join(",")으로 저장한 형식)
  return s.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
}

List<Map<String, dynamic>> _parseSurgeries(dynamic raw) {
  dynamic source = raw;
  if (source is String) {
    final trimmed = source.trim();
    if (trimmed.isEmpty || trimmed == '[]') return [];
    try { source = jsonDecode(trimmed); } catch (_) { return []; }
  }
  if (source is! List) return [];
  return source.whereType<Map>().map((m) => {
    'name': '${m['name'] ?? ''}',
    'year': '${m['year'] ?? ''}',
  }).where((s) => (s['name'] as String).isNotEmpty).toList();
}

List<Map<String, String>> _parseMedications(dynamic raw) {
  dynamic source = raw;
  if (source is String) {
    final trimmed = source.trim();
    if (trimmed.isEmpty || trimmed == '[]') return [];
    try {
      source = jsonDecode(trimmed);
    } catch (_) {
      return [];
    }
  }
  if (source is! List) return [];

  return source.whereType<Map>().map((m) {
    final name = m['name'] ??
        m['medicineName'] ??
        m['medicationName'] ??
        m['drugName'] ??
        m['disease'] ??
        '';
    final dose = m['dose'] ?? m['dosage'] ?? m['amount'] ?? '';
    return {
      'name': '$name',
      'dose': '$dose',
    };
  }).where((m) {
    return m['name']!.trim().isNotEmpty || m['dose']!.trim().isNotEmpty;
  }).toList();
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
  form.profileImageUrl = '${s['profileImageUrl'] ?? ''}';
  form.disabilityGrade = _orNone(s['disabilityGrade']);
  form.disabilityType = _orNone(s['disabilityType']);
  form.hasGuardian = s['hasGuardian'] != false; // null 이나 true → true(있음)

  // ── 신체정보 (HealthInfo 엔티티) ─────────────────
  form.height = '${h['height'] ?? ''}';
  form.weight = '${h['weight'] ?? ''}';
  form.smoking  = _orNone(h['smoking']);
  form.drinking = _orNone(h['drinking']);
  form.allergies = '${h['allergies'] ?? ''}';

  // ── 복약정보 ──────────────────────────────────────
  form.medicineCount = _orNone(h['medicineCount']);

  form.medications = _parseMedications(h['medications']);
  if (form.medications.isEmpty) {
    form.medications = _parseMedications(h['medicationsJson']);
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
  form.surgeries = _parseSurgeries(h['surgeriesJson'] ?? h['surgeries']);
  form.otherDisease  = '${h['otherDisease'] ?? ''}';

  // ── 활동조건 (Spring: restNeed / avoidEnvironment — 단수) ──
  form.maxHours        = _orNone(h['maxHours']);
  form.maxDistance     = _orNone(h['maxDistance']);
  form.disabledWork    = _parseList(h['disabledWork']);
  form.restNeeds       = _orNone(h['restNeed']);       // Spring: restNeed
  form.avoidEnvironments = _parseList(h['avoidEnvironment']); // Spring: avoidEnvironment

  // ── 복지정보 ─────────────────────────────────────
  form.incomeLevel       = _orNone(h['incomeLevel']);
  form.livingCostStatus  = _orNone(h['livingCostStatus']);
  form.householdType     = _orNone(h['householdType']);
  form.pensionStatus     = _orNone(h['pensionStatus']);
  form.housingType       = _orNone(h['housingType']);
  form.currentBenefits   = _parseList(h['currentBenefits']);
  form.careNeeds         = _parseList(h['careNeeds']);
  form.welfareMemo       = '${h['welfareMemo'] ?? ''}';

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
    'profileImageUrl': f.profileImageUrl,
    'disabilityGrade': f.disabilityGrade == _none ? '' : f.disabilityGrade,
    'disabilityType': f.disabilityType == _none ? '' : f.disabilityType,
    'hasGuardian': f.hasGuardian,
    'height': f.height,
    'weight': f.weight,
    'smoking': f.smoking == _none ? '' : f.smoking,
    'drinking': f.drinking == _none ? '' : f.drinking,
    'allergies': f.allergies,
    'medicineCount': f.medicineCount == _none ? '' : f.medicineCount,
    'medications': f.medications,
    'medicationsJson': jsonEncode(f.medications),
    for (final d in _chronicDiseases)
      d['key']!: f.chronic[d['key']] == _none ? '' : f.chronic[d['key']],
    'walkingAid': f.walkingAid == _none ? '' : f.walkingAid,
    'dementia': f.dementia == _none ? '' : f.dementia,
    'vision': f.vision == _none ? '' : f.vision,
    'hearing': f.hearing == _none ? '' : f.hearing,
    'recentFall': f.recentFall == _none ? '' : f.recentFall,
    'hasSurgery': f.hasSurgery == _none ? '' : f.hasSurgery,
    'surgeryDetail': f.surgeryDetail,
    'surgeries': f.surgeries,
    'surgeriesJson': jsonEncode(f.surgeries),
    'otherDisease': f.otherDisease,
    'maxHours': f.maxHours == _none ? '' : f.maxHours,
    'maxDistance': f.maxDistance == _none ? '' : f.maxDistance,
    'disabledWork': f.disabledWork,
    'restNeed': f.restNeeds == _none ? '' : f.restNeeds,
    'avoidEnvironment': f.avoidEnvironments,
    'incomeLevel': f.incomeLevel == _none ? '' : f.incomeLevel,
    'livingCostStatus': f.livingCostStatus == _none ? '' : f.livingCostStatus,
    'householdType': f.householdType == _none ? '' : f.householdType,
    'pensionStatus': f.pensionStatus == _none ? '' : f.pensionStatus,
    'housingType': f.housingType == _none ? '' : f.housingType,
    'currentBenefits': f.currentBenefits,
    'careNeeds': f.careNeeds,
    'welfareMemo': f.welfareMemo,
    'payType': f.payType == _none ? '' : f.payType,
    'hopeDays': f.hopeDays,
    'hopeJobType': f.hopeJobType,
    'hopeCondition': f.hopeCondition,
    'memo': f.jobMemo,
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
    this.initialSectionIndex,
    this.pendingAlertId,
    this.onSaved,
  });
  final int seniorId;
  final bool hideAppBar;
  final ActionRegistrar? onRegisterAction;
  final int? initialSectionIndex;
  final int? pendingAlertId;
  final VoidCallback? onSaved;

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
  bool _dirty = false; // 사용자가 폼을 수정한 경우 백그라운드 갱신 차단
  String? _error;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(
      length: _sections.length,
      vsync: this,
      initialIndex: widget.initialSectionIndex?.clamp(0, _sections.length - 1) ?? 0,
    );
    _load();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('로그아웃', style: TextStyle(fontWeight: FontWeight.w900)),
        content: const Text('로그아웃 하시겠어요?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('로그아웃', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      // 로그아웃하면 백그라운드 위치 전송도 중지
      await BackgroundLocationService.stop();
      await SeniorSessionStorage.clear();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const SeniorLoginScreen()),
          (route) => false,
        );
      }
    }
  }

  Future<void> _load() async {
    setState(() { _error = null; });

    // 캐시 먼저 렌더링 → 즉시 화면 표시
    final cached = await SeniorSessionStorage.getProfile(widget.seniorId);
    if (cached != null && mounted) {
      setState(() {
        _form = _apiToForm(cached);
        _loading = false;
      });
      _jumpToFirstMissingSection();
      // 백그라운드에서 최신 데이터 갱신 (사용자가 이미 수정 중이면 덮어쓰지 않음)
      _api.fetchProfile(widget.seniorId).then((raw) {
        if (!mounted || _dirty) return;
        SeniorSessionStorage.saveProfile(widget.seniorId, raw);
        setState(() => _form = _apiToForm(raw));
        _jumpToFirstMissingSection();
      }).catchError((_) {});
      return;
    }

    // 캐시 없으면 서버에서 로드
    try {
      setState(() { _loading = true; });
      final raw = await _api.fetchProfile(widget.seniorId);
      if (!mounted) return;
      await SeniorSessionStorage.saveProfile(widget.seniorId, raw);
      setState(() {
        _form = _apiToForm(raw);
        _loading = false;
      });
      _jumpToFirstMissingSection();
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
      final updated = await _api.updateProfile(widget.seniorId, _formToApi(_form));
      // 저장 성공 시 캐시 갱신
      await SeniorSessionStorage.saveProfile(widget.seniorId, updated);
      // 수정 요청 알림이 있었으면 읽음 처리 + 복지사 완료 알림
      if (widget.pendingAlertId != null) {
        await _api.readAlert(widget.pendingAlertId!);
        await _api.notifyProfileUpdateComplete(widget.seniorId, widget.pendingAlertId!);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장되었습니다'), backgroundColor: Color(0xFF86A788)),
      );
      widget.onSaved?.call();
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장에 실패했습니다'), backgroundColor: Color(0xFFD94E4E)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _jumpToFirstMissingSection() {
    if (widget.pendingAlertId == null) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      for (int i = 0; i < _sections.length; i++) {
        if (_sectionFieldChecks(i).any((c) => c.isEmpty(_form))) {
          _tabController.animateTo(i);
          break;
        }
      }
    });
  }

  List<String> _missingLabels(int sectionIndex) {
    if (widget.pendingAlertId == null) return const [];
    return _sectionFieldChecks(sectionIndex)
        .where((c) => c.isEmpty(_form))
        .map((c) => c.label)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        toolbarHeight: widget.hideAppBar ? 0 : null,
        automaticallyImplyLeading: !widget.hideAppBar,
        title: widget.hideAppBar
            ? null
            : const Text(
                '내 정보',
                style: TextStyle(
                    color: Color(0xFF1F2A20), fontWeight: FontWeight.w900),
              ),
        actions: const [],
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
                tabs: _sections.asMap().entries.map((e) {
                  final count = widget.pendingAlertId != null
                      ? _sectionFieldChecks(e.key).where((c) => c.isEmpty(_form)).length
                      : 0;
                  return Tab(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(e.value),
                        if (count > 0) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD94E4E),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text('$count',
                                style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w900)),
                          ),
                        ],
                      ],
                    ),
                  );
                }).toList(),
              ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF86A788)))
          : _error != null
              ? _ErrorView(message: _error!, onRetry: _load)
              : TabBarView(
                  controller: _tabController,
                  children: [
                    _PersonalSection(
                      form: _form,
                      onChanged: () => setState(() { _dirty = true; }),
                      missingLabels: _missingLabels(0),
                    ),
                    _BodySection(form: _form, onChanged: () => setState(() { _dirty = true; }), missingLabels: _missingLabels(1)),
                    _MedicationSection(form: _form, onChanged: () => setState(() { _dirty = true; }), missingLabels: _missingLabels(2)),
                    _ChronicSection(form: _form, onChanged: () => setState(() { _dirty = true; }), missingLabels: _missingLabels(3)),
                    _MobilitySection(form: _form, onChanged: () => setState(() { _dirty = true; }), missingLabels: _missingLabels(4)),
                    _WelfareSection(form: _form, onChanged: () => setState(() { _dirty = true; }), missingLabels: _missingLabels(5)),
                    _JobSection(form: _form, onChanged: () => setState(() { _dirty = true; }), missingLabels: _missingLabels(6)),
                  ],
                ),

      persistentFooterButtons: [
        SizedBox(
          width: double.infinity,
          child: FilledButton(
            onPressed: (_loading || _saving) ? null : _save,
            child: Text(
              _saving ? '저장 중...' : '저장하기',
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
            ),
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF86A788),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── 인적사항 ─────────────────────────────────────────────────────────────────

class _PersonalSection extends StatefulWidget {
  const _PersonalSection({
    required this.form,
    required this.onChanged,
    this.missingLabels = const [],
  });
  final _ProfileForm form;
  final VoidCallback onChanged;
  final List<String> missingLabels;

  @override
  State<_PersonalSection> createState() => _PersonalSectionState();
}

class _PersonalSectionState extends State<_PersonalSection> {
  late final TextEditingController _name;
  late final TextEditingController _phone;
  late final TextEditingController _birthDate;
  late final TextEditingController _region;
  bool _uploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.form.name);
    _phone = TextEditingController(text: widget.form.phone);
    _birthDate = TextEditingController(text: widget.form.birthDate);
    _region = TextEditingController(text: widget.form.region);
  }

  Future<void> _pickAndUploadPhoto() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;

    setState(() => _uploadingPhoto = true);
    try {
      final uri = Uri.parse('$apiBaseUrl/api/uploads/profile');
      final request = http.MultipartRequest('POST', uri)
        ..files.add(await http.MultipartFile.fromPath('image', picked.path));
      final streamed = await request.send().timeout(const Duration(seconds: 15));
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
        final data = jsonDecode(body) as Map<String, dynamic>;
        final url = '${data['fileUrl'] ?? data['imageUrl'] ?? ''}';
        if (url.isNotEmpty) {
          widget.form.profileImageUrl = url;
          widget.onChanged();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('사진 업로드에 실패했습니다.')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
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
      lastDate: DateTime(now.year - 14, now.month, now.day),
    );
    if (picked == null) return;
    final s =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    _birthDate.text = s;
    widget.form.birthDate = s;
    widget.onChanged();
  }

  Future<void> _openAddressSearch() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => _AddressSearchSheet(initialValue: _region.text),
    );
    if (selected == null || selected.isEmpty) return;
    _region.text = selected;
    widget.form.region = selected;
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    final imageUrl = widget.form.profileImageUrl.isNotEmpty
        ? (widget.form.profileImageUrl.startsWith('/')
            ? '$apiBaseUrl${widget.form.profileImageUrl}'
            : widget.form.profileImageUrl)
        : '';

    return _SectionScroll(missingLabels: widget.missingLabels, children: [
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F5E8),
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            GestureDetector(
              onTap: _uploadingPhoto ? null : _pickAndUploadPhoto,
              child: Stack(
                alignment: Alignment.bottomRight,
                children: [
                  Container(
                    width: 82,
                    height: 82,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFD4E8D6),
                      image: imageUrl.isNotEmpty
                          ? DecorationImage(
                              image: _profileImageProvider(imageUrl),
                              fit: BoxFit.cover,
                            )
                          : null,
                    ),
                    child: imageUrl.isEmpty
                        ? const Icon(Icons.person,
                            size: 42, color: Color(0xFF86A788))
                        : null,
                  ),
                  Container(
                    padding: const EdgeInsets.all(5),
                    decoration: const BoxDecoration(
                      color: Color(0xFF86A788),
                      shape: BoxShape.circle,
                    ),
                    child: _uploadingPhoto
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.camera_alt,
                            size: 16, color: Colors.white),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.form.name.isEmpty ? '이름 없음' : widget.form.name,
                    style: const TextStyle(
                      color: Color(0xFF1F2A20),
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    widget.form.phone.isEmpty ? '전화번호 미입력' : widget.form.phone,
                    style: const TextStyle(
                      color: Color(0xFF6D766A),
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    widget.form.region.isEmpty ? '주소 미입력' : widget.form.region,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Color(0xFF6D766A),
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
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
      TextField(
        controller: _region,
        readOnly: true,
        onTap: _openAddressSearch,
        decoration: _deco(hint: '주소를 검색해 선택하세요', suffix: Icons.search),
      ),
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
      const SizedBox(height: 8),
      // ── 보호자 유무 ────────────────────────────────────────────
      StatefulBuilder(
        builder: (context, setLocal) => Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: const Color(0xFFF7F5E8),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFD4E8D6)),
          ),
          child: Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('보호자 있음',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF1F2A20))),
                    SizedBox(height: 2),
                    Text('보호자가 없는 경우 꺼주세요.',
                        style: TextStyle(fontSize: 12, color: Color(0xFF7A8A7C))),
                  ],
                ),
              ),
              Switch(
                value: widget.form.hasGuardian,
                activeColor: const Color(0xFF86A788),
                onChanged: (v) {
                  setLocal(() => widget.form.hasGuardian = v);
                  widget.onChanged();
                },
              ),
            ],
          ),
        ),
      ),
    ]);
  }
}

// ─── 신체정보 ─────────────────────────────────────────────────────────────────

class _AddressSearchSheet extends StatefulWidget {
  const _AddressSearchSheet({required this.initialValue});

  final String initialValue;

  @override
  State<_AddressSearchSheet> createState() => _AddressSearchSheetState();
}

class _AddressSearchSheetState extends State<_AddressSearchSheet> {
  late final TextEditingController _queryController;
  kakao.KakaoMapController? _mapController;
  List<kakao.SearchAddress> _results = [];
  bool _loading = false;
  bool _mapReady = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _queryController = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    FocusScope.of(context).unfocus();

    final query = _queryController.text.trim();
    if (query.isEmpty) {
      setState(() => _message = '검색할 주소를 입력해주세요.');
      return;
    }

    final controller = _mapController;
    if (controller == null) {
      setState(() => _message = '주소 검색을 준비하고 있어요. 잠시 후 다시 눌러주세요.');
      return;
    }

    setState(() {
      _loading = true;
      _message = null;
    });

    try {
      final response = await controller.addressSearch(
        kakao.AddressSearchRequest(addr: query, size: 10),
      );
      if (!mounted) return;
      setState(() {
        _results = response.list;
        _message = _results.isEmpty ? '검색 결과가 없습니다.' : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _results = [];
        _message = '주소 검색에 실패했습니다.';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _primaryAddress(kakao.SearchAddress item) {
    final road = item.roadAddress?.addressName ?? '';
    if (road.isNotEmpty) return road;
    return item.address?.addressName ?? item.addressName ?? '';
  }

  String _secondaryAddress(kakao.SearchAddress item) {
    final road = item.roadAddress?.addressName ?? '';
    final jibun = item.address?.addressName ?? item.addressName ?? '';
    if (road.isNotEmpty && jibun.isNotEmpty && road != jibun) {
      return '지번 $jibun';
    }
    final zoneNo = item.roadAddress?.zoneNo ?? '';
    return zoneNo.isNotEmpty ? '우편번호 $zoneNo' : '';
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 18, 20, bottom + 20),
      child: SafeArea(
        top: false,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    '주소 검색',
                    style: TextStyle(
                      color: Color(0xFF1F2A20),
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _queryController,
              autofocus: true,
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => _search(),
              decoration: _deco(
                hint: '도로명 또는 지번 주소를 입력하세요',
                suffix: Icons.search,
              ),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed:
                  _loading || !_mapReady || _disableKakaoMap ? null : _search,
              icon: _loading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.search),
              label: Text(_mapReady ? '검색' : '지도 준비 중'),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF86A788),
                padding: const EdgeInsets.symmetric(vertical: 13),
              ),
            ),
            if (!_disableKakaoMap) SizedBox(
              height: 1,
              child: Opacity(
                opacity: 0,
                child: kakao.KakaoMap(
                  center: kakao.LatLng(37.5665, 126.9780),
                  currentLevel: 3,
                  onMapCreated: (controller) {
                    _mapController = controller;
                    if (!mounted) return;
                    setState(() => _mapReady = true);
                  },
                ),
              ),
            ),
            if (_message != null) ...[
              const SizedBox(height: 16),
              Text(
                _message!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Color(0xFF6D766A),
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
            if (_results.isNotEmpty) ...[
              const SizedBox(height: 14),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 360),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _results.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final item = _results[index];
                    final primary = _primaryAddress(item);
                    final secondary = _secondaryAddress(item);
                    return ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(
                        Icons.location_on_outlined,
                        color: Color(0xFF86A788),
                      ),
                      title: Text(
                        primary,
                        style: const TextStyle(
                          color: Color(0xFF1F2A20),
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      subtitle: secondary.isEmpty
                          ? null
                          : Text(
                              secondary,
                              style: const TextStyle(
                                color: Color(0xFF6D766A),
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                      onTap: primary.isEmpty
                          ? null
                          : () => Navigator.pop(context, primary),
                    );
                  },
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _BodySection extends StatefulWidget {
  const _BodySection({required this.form, required this.onChanged, this.missingLabels = const []});
  final _ProfileForm form;
  final VoidCallback onChanged;
  final List<String> missingLabels;

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
    return _SectionScroll(missingLabels: widget.missingLabels, children: [
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
  const _MedicationSection({required this.form, required this.onChanged, this.missingLabels = const []});
  final _ProfileForm form;
  final VoidCallback onChanged;
  final List<String> missingLabels;

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

  List<String> get _medicineNames {
    return widget.form.medications
        .map((m) => (m['name'] ?? '').trim())
        .where((name) => name.isNotEmpty)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final names = _medicineNames;
    return _SectionScroll(missingLabels: widget.missingLabels, children: [
      const _FieldLabel('복용 약품 수'),
      _Dropdown(
          value: widget.form.medicineCount,
          items: _medicineCounts,
          onChanged: (v) {
            widget.form.medicineCount = v;
            widget.onChanged();
          }),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF7F5E8),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.medication_outlined, color: Color(0xFF86A788)),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '복용 중인 약',
                    style: TextStyle(
                      color: Color(0xFF1F2A20),
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    names.isEmpty ? '아래에서 약 이름을 추가해주세요.' : names.join(', '),
                    style: const TextStyle(
                      color: Color(0xFF6D766A),
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
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
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F5E8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD4E8D6)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('복용 약 ${widget.index + 1}',
              style: const TextStyle(
                  color: Color(0xFF1F2A20), fontSize: 15, fontWeight: FontWeight.w900)),
          const Spacer(),
          GestureDetector(
            onTap: widget.onRemove,
            child: const Icon(Icons.close, size: 18, color: Color(0xFFD94E4E)),
          ),
        ]),
        const SizedBox(height: 10),
        const _FieldLabel('약 이름'),
        TextField(
          controller: _name,
          decoration: _deco(hint: '예: 아스피린'),
          onChanged: (v) {
            widget.med['name'] = v;
            widget.onChanged();
          },
        ),
        const SizedBox(height: 10),
        const _FieldLabel('복용량'),
        TextField(
          controller: _dose,
          decoration: _deco(hint: '예: 1정 하루 1회'),
          onChanged: (v) {
            widget.med['dose'] = v;
            widget.onChanged();
          },
        ),
      ]),
    );
  }
}

// ─── 수술 이력 행 ─────────────────────────────────────────────────────────────

class _SurgeryRow extends StatefulWidget {
  const _SurgeryRow({required this.index, required this.surgery, required this.onRemove, required this.onChanged});
  final int index;
  final Map<String, dynamic> surgery;
  final VoidCallback onRemove;
  final VoidCallback onChanged;

  @override
  State<_SurgeryRow> createState() => _SurgeryRowState();
}

class _SurgeryRowState extends State<_SurgeryRow> {
  late final TextEditingController _name;
  DateTime? _selectedDate;
  String? _recovery;

  static const _recoveryOptions = ['모름', '회복중', '회복완료', '미회복'];

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: '${widget.surgery['name'] ?? ''}');
    final raw = widget.surgery['date']?.toString() ?? widget.surgery['year']?.toString() ?? '';
    if (raw.length >= 10) {
      _selectedDate = DateTime.tryParse(raw);
    }
    final r = widget.surgery['recovery']?.toString() ?? '';
    _recovery = _recoveryOptions.contains(r) ? r : null;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime(2000),
      firstDate: DateTime(1940),
      lastDate: DateTime.now(),
      locale: const Locale('ko'),
    );
    if (picked != null) {
      final formatted = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      setState(() => _selectedDate = picked);
      widget.surgery['date'] = formatted;
      widget.onChanged();
    }
  }

  @override
  Widget build(BuildContext context) {
    final dateText = _selectedDate != null
        ? '${_selectedDate!.year}년 ${_selectedDate!.month}월 ${_selectedDate!.day}일'
        : '날짜 선택';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F5E8),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD4E8D6)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text('수술 ${widget.index + 1}',
              style: const TextStyle(color: Color(0xFF1F2A20), fontSize: 15, fontWeight: FontWeight.w900)),
          const Spacer(),
          GestureDetector(
            onTap: widget.onRemove,
            child: const Icon(Icons.close, size: 18, color: Color(0xFFD94E4E)),
          ),
        ]),
        const SizedBox(height: 10),
        const _FieldLabel('수술명'),
        TextField(
          controller: _name,
          decoration: _deco(hint: '예: 무릎 인공관절 수술'),
          onChanged: (v) { widget.surgery['name'] = v; widget.onChanged(); },
        ),
        const SizedBox(height: 10),
        const _FieldLabel('수술 날짜'),
        GestureDetector(
          onTap: _pickDate,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            decoration: BoxDecoration(
              color: const Color(0xFFF7F5E8),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFD4E8D6)),
            ),
            child: Row(children: [
              Expanded(child: Text(dateText,
                  style: TextStyle(color: _selectedDate != null ? const Color(0xFF1F2A20) : const Color(0xFF9E9E9E), fontSize: 14))),
              const Icon(Icons.calendar_month_outlined, size: 18, color: Color(0xFF86A788)),
            ]),
          ),
        ),
        const SizedBox(height: 10),
        const _FieldLabel('회복 여부'),
        DropdownButtonFormField<String>(
          value: _recovery,
          hint: const Text('선택해주세요'),
          items: _recoveryOptions.map((o) => DropdownMenuItem(value: o, child: Text(o))).toList(),
          onChanged: (v) {
            setState(() => _recovery = v);
            widget.surgery['recovery'] = v ?? '';
            widget.onChanged();
          },
          decoration: _deco(hint: '선택해주세요'),
          isExpanded: true,
        ),
      ]),
    );
  }
}

// ─── 만성질환 ─────────────────────────────────────────────────────────────────

class _ChronicSection extends StatelessWidget {
  const _ChronicSection({required this.form, required this.onChanged, this.missingLabels = const []});
  final _ProfileForm form;
  final VoidCallback onChanged;
  final List<String> missingLabels;

  @override
  Widget build(BuildContext context) {
    final allNone = _chronicDiseases.every((d) => form.chronic[d['key']!] == _none);
    return _SectionScroll(
      missingLabels: missingLabels,
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            onPressed: () {
              if (allNone) {
                for (final d in _chronicDiseases) { form.chronic[d['key']!] = ''; }
              } else {
                for (final d in _chronicDiseases) { form.chronic[d['key']!] = _none; }
              }
              onChanged();
            },
            style: allNone
                ? TextButton.styleFrom(
                    backgroundColor: const Color(0xFF86a788),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(99)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  )
                : null,
            child: const Text('전체 없음'),
          ),
        ),
        ..._chronicDiseases.map((d) {
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
        }),
      ],
    );
  }
}

// ─── 거동/인지 ────────────────────────────────────────────────────────────────

class _MobilitySection extends StatefulWidget {
  const _MobilitySection({required this.form, required this.onChanged, this.missingLabels = const []});
  final _ProfileForm form;
  final VoidCallback onChanged;
  final List<String> missingLabels;

  @override
  State<_MobilitySection> createState() => _MobilitySectionState();
}

class _MobilitySectionState extends State<_MobilitySection> {
  late final TextEditingController _otherDisease;

  @override
  void initState() {
    super.initState();
    _otherDisease = TextEditingController(text: widget.form.otherDisease);
  }

  @override
  void dispose() {
    _otherDisease.dispose();
    super.dispose();
  }

  void _addSurgery() {
    widget.form.surgeries.add({'name': '', 'year': ''});
    widget.onChanged();
    setState(() {});
  }

  void _removeSurgery(int i) {
    widget.form.surgeries.removeAt(i);
    widget.onChanged();
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return _SectionScroll(missingLabels: widget.missingLabels, children: [
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
            if (v == '예' && widget.form.surgeries.isEmpty) _addSurgery();
            widget.onChanged();
          }),
      if (widget.form.hasSurgery == '예') ...[
        Row(children: [
          const Expanded(child: Text('수술 이력 목록', style: TextStyle(color: Color(0xFF111827), fontSize: 15, fontWeight: FontWeight.w700))),
          TextButton.icon(
            onPressed: _addSurgery,
            icon: const Icon(Icons.add, size: 18),
            label: const Text('추가'),
            style: TextButton.styleFrom(foregroundColor: const Color(0xFF86A788)),
          ),
        ]),
        if (widget.form.surgeries.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('아래 추가 버튼을 눌러 수술 이력을 입력해주세요', style: TextStyle(color: Color(0xFF6D766A), fontSize: 13)),
          )
        else
          ...widget.form.surgeries.asMap().entries.map((entry) {
            final i = entry.key;
            final s = entry.value;
            return _SurgeryRow(
              index: i,
              surgery: s,
              onRemove: () => _removeSurgery(i),
              onChanged: () { widget.onChanged(); setState(() {}); },
            );
          }),
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

// ─── 복지정보 ─────────────────────────────────────────────────────────────────

class _WelfareSection extends StatefulWidget {
  const _WelfareSection({required this.form, required this.onChanged, this.missingLabels = const []});
  final _ProfileForm form;
  final VoidCallback onChanged;
  final List<String> missingLabels;

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
    return _SectionScroll(missingLabels: widget.missingLabels, children: [
      const _FieldLabel('생활비 상황'),
      _Dropdown(
          value: widget.form.livingCostStatus,
          items: _livingCostStatuses,
          onChanged: (v) {
            widget.form.livingCostStatus = v;
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
      const _FieldLabel('현재 받고 있는 복지 혜택 (중복 선택)'),
      _ChipGroup(
          items: _currentBenefits,
          selected: widget.form.currentBenefits,
          onChanged: (v) {
            widget.form.currentBenefits = v;
            widget.onChanged();
          }),
      const _FieldLabel('연금 수급 상태'),
      _Dropdown(
          value: widget.form.pensionStatus,
          items: _pensionStatuses,
          onChanged: (v) {
            widget.form.pensionStatus = v;
            widget.onChanged();
          }),
      const _FieldLabel('주거 형태'),
      _Dropdown(
          value: widget.form.housingType,
          items: _housingTypes,
          onChanged: (v) {
            widget.form.housingType = v;
            widget.onChanged();
          }),
      const _FieldLabel('도움이 필요한 일 (중복 선택)'),
      _ChipGroup(
          items: _careNeeds,
          selected: widget.form.careNeeds,
          onChanged: (v) {
            widget.form.careNeeds = v;
            widget.onChanged();
          }),
      const _FieldLabel('그 밖에 참고사항'),
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
  const _JobSection({required this.form, required this.onChanged, this.missingLabels = const []});
  final _ProfileForm form;
  final VoidCallback onChanged;
  final List<String> missingLabels;

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
    return _SectionScroll(missingLabels: widget.missingLabels, children: [
      const _FieldLabel('최대 근무 시간'),
      _Dropdown(
          value: widget.form.maxHours,
          items: _maxHoursOptions,
          onChanged: (v) {
            widget.form.maxHours = v;
            widget.onChanged();
          }),
      const _FieldLabel('통근 가능 거리'),
      _Dropdown(
          value: widget.form.maxDistance,
          items: _maxDistanceOptions,
          onChanged: (v) {
            widget.form.maxDistance = v;
            widget.onChanged();
          }),
      const _FieldLabel('힘든 업무 (중복 선택)'),
      _ChipGroup(
          items: _workTypes,
          selected: widget.form.disabledWork,
          onChanged: (v) {
            widget.form.disabledWork = v;
            widget.onChanged();
          }),
      const _FieldLabel('휴식 필요'),
      _Dropdown(
          value: widget.form.restNeeds,
          items: _restNeeds,
          onChanged: (v) {
            widget.form.restNeeds = v;
            widget.onChanged();
          }),
      const _FieldLabel('피해야 할 환경 (중복 선택)'),
      _ChipGroup(
          items: _avoidEnvironments,
          selected: widget.form.avoidEnvironments,
          onChanged: (v) {
            widget.form.avoidEnvironments = v;
            widget.onChanged();
          }),
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

class _MissingFieldsBanner extends StatelessWidget {
  const _MissingFieldsBanner({required this.labels});
  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFDE8),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFDDD18A)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.edit_note_outlined, color: Color(0xFFB8860B), size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  '복지사가 입력을 요청한 항목이 있어요',
                  style: TextStyle(
                    color: Color(0xFF1F2A20),
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '아직 비어 있는 항목: ${labels.join(', ')}',
                  style: const TextStyle(
                    color: Color(0xFF6D766A),
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
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

class _SectionScroll extends StatelessWidget {
  const _SectionScroll({required this.children, this.missingLabels = const []});
  final List<Widget> children;
  final List<String> missingLabels;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: _withSpacing([
          if (missingLabels.isNotEmpty) _MissingFieldsBanner(labels: missingLabels),
          ...children,
        ]),
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
