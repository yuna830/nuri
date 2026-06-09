import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';
import '../../core/storage/senior_session_storage.dart';
import '../../core/utils/phone_formatter.dart';
import '../shell/app_shell.dart';

// ── 상수 ─────────────────────────────────────────────────────────────────────

const _none = '없음';

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

const _steps = [
  '기본 정보',
  '건강 정보',
  '복약 정보',
  '건강 상태',
  '거동/인지/감각',
  '복지 정보',
  '활동/일자리',
];

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
const _disabilityTypes = [_none, '지체장애', '시각장애', '청각장애', '언어장애', '지적장애', '정신장애', '기타'];
const _medicineCounts = [_none, '1~2개', '3~5개', '6개 이상'];
const _visionLevels = [_none, '글씨가 조금 흐림', '큰 글씨만 보임', '거의 보이지 않음'];
const _hearingLevels = [_none, '작은 소리가 잘 안 들림', '큰 소리로 말해야 들림', '거의 들리지 않음'];
const _restNeeds = [
  _none, '30분마다 5분', '1시간마다 5분', '1시간마다 10분',
  '2시간마다 10분', '2시간마다 15분', '3시간마다 15분', '필요할 때 짧게 쉬기',
];
const _avoidEnvironments = ['소음 많은 곳', '먼지 많은 곳', '덥거나 추운 곳', '미끄러운 바닥', '사람 많은 곳', '혼자 하는 작업'];
const _livingCostStatuses = [
  _none, '잘 모르겠어요', '수입이 거의 없어요', '기초연금 정도만 받아요',
  '가족에게 일부 도움을 받아요', '연금이나 월급 수입이 있어요',
  '생계비/의료비/주거비 지원을 받고 있어요',
];
const _householdTypesList = [
  _none, '잘 모르겠어요', '혼자 살아요', '배우자와 살아요',
  '자녀/가족과 살아요', '시설이나 요양원에 있어요', '기타',
];
const _pensionStatuses = [
  _none, '잘 모르겠어요', '기초연금을 받고 있어요', '국민연금을 받고 있어요',
  '기초연금과 국민연금을 모두 받고 있어요', '신청했지만 기다리는 중이에요', '신청한 적 없어요',
];
const _housingTypesList = [_none, '잘 모르겠어요', '자가', '전세', '월세', '공공임대', '시설이나 요양원', '기타'];
const _currentBenefitsList = [
  '잘 모르겠어요', '받고 있는 지원이 없어요', '기초연금', '생계비/의료비/주거비 지원',
  '장기요양 서비스', '장애 관련 지원', '노인 일자리', '노인맞춤돌봄서비스', '응급안전안심서비스',
];
const _careNeedsList = [
  '잘 모르겠어요', '특별히 없어요', '식사 준비', '청소/빨래',
  '목욕/위생', '병원 동행', '외출/장보기', '약 챙기기', '안부 확인',
];
const _workTypesList = ['서류 작업', '컴퓨터 입력', '전화 상담', '청소', '정리/분류', '포장/조립', '배달', '요리/식품', '안전/경비', '돌봄/보조', '기타'];
const _jobTypesList = ['사무/행정', '경비/안전', '청소/미화', '배달/운반', '요리/식음', '판매/서비스', '제조/생산', '농업/원예', '돌봄/복지', '기타'];
const _jobConditionsList = ['단기/계절', '상시', '파트타임', '전일제', '재택/원격', '야외 활동', '실내 활동'];
const _daysList = ['월', '화', '수', '목', '금', '토', '일'];

// ── 헬퍼 함수 ─────────────────────────────────────────────────────────────────

Map<String, dynamic>? _calcBmi(String h, String w) {
  final height = double.tryParse(h);
  final weight = double.tryParse(w);
  if (height == null || weight == null || height <= 0) return null;
  final bmi = weight / ((height / 100) * (height / 100));
  final bmiStr = bmi.toStringAsFixed(1);
  String status; Color color; String guide;
  if (bmi < 18.5) {
    status = '저체중'; color = const Color(0xFF4C8ED9); guide = '영양 섭취를 늘려보세요.';
  } else if (bmi < 23) {
    status = '정상'; color = const Color(0xFF86A788); guide = '적정 체중을 유지하고 있어요.';
  } else if (bmi < 25) {
    status = '과체중'; color = const Color(0xFFE07B00); guide = '식단 관리를 권장해요.';
  } else {
    status = '비만'; color = const Color(0xFFD94E4E); guide = '전문가와 상담해보세요.';
  }
  return {'bmi': bmiStr, 'status': status, 'color': color, 'guide': guide};
}

int? _calcAge(String birthDate) {
  if (birthDate.isEmpty) return null;
  try {
    final birth = DateTime.parse(birthDate);
    final now = DateTime.now();
    int age = now.year - birth.year;
    if (now.month < birth.month || (now.month == birth.month && now.day < birth.day)) age--;
    return age;
  } catch (_) {
    return null;
  }
}

// ── 메인 위젯 ─────────────────────────────────────────────────────────────────

class SeniorSignUpScreen extends StatefulWidget {
  const SeniorSignUpScreen({super.key});

  @override
  State<SeniorSignUpScreen> createState() => _SeniorSignUpScreenState();
}

class _SeniorSignUpScreenState extends State<SeniorSignUpScreen> {
  int _step = 0;
  bool _saving = false;

  // ── 0: 기본 정보 ──
  final _nameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String _birthDate = '';
  String _gender = '여성';
  final _cityCtrl = TextEditingController();
  final _districtCtrl = TextEditingController();
  final _dongCtrl = TextEditingController();
  final _detailCtrl = TextEditingController();
  String _disabilityGrade = _none;
  String _disabilityType = _none;
  bool _hasGuardian = true; // 보호자 유무
  String _profileImageUrl = '';
  bool _uploadingPhoto = false;

  // ── 1: 건강 정보 ──
  final _heightCtrl = TextEditingController();
  final _weightCtrl = TextEditingController();
  String _smoking = '';
  String _drinking = '';
  final _allergiesCtrl = TextEditingController();

  // ── 2: 복약 정보 ──
  String _medicineCount = '';
  final List<Map<String, dynamic>> _medications = [];

  // ── 3: 건강 상태 ──
  // 서버 SeniorCreateRequest 필드명과 일치: heart/joint/kidney/lung/liver (단축형)
  final Map<String, String> _chronic = {
    'diabetes': '', 'hypertension': '', 'heart': '',
    'joint': '', 'stroke': '', 'kidney': '',
    'lung': '', 'liver': '', 'cancer': '',
  };

  // ── 4: 거동/인지/감각 ──
  String _walkingAid = '';
  String _dementia = '';
  String _vision = '';
  String _hearing = '';
  String _recentFall = '';

  // ── 5: 복지 정보 ──
  String _livingCostStatus = '';
  String _householdType = '';
  final List<String> _currentBenefits = [];
  String _pensionStatus = '';
  String _housingType = '';
  final List<String> _careNeeds = [];
  final _welfareMemoCtrl = TextEditingController();

  // ── 6: 활동/일자리 ──
  String _maxHours = '';
  String _maxDistance = '';
  final List<String> _disabledWork = [];
  String _restNeed = '';
  final List<String> _avoidEnvironment = [];
  String _payType = '';
  final List<String> _hopeDays = [];
  final List<String> _hopeJobType = [];
  final List<String> _hopeCondition = [];
  final _memoCtrl = TextEditingController();

  @override
  void dispose() {
    for (final c in [
      _nameCtrl, _phoneCtrl, _cityCtrl, _districtCtrl, _dongCtrl, _detailCtrl,
      _heightCtrl, _weightCtrl, _allergiesCtrl, _welfareMemoCtrl, _memoCtrl,
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  // ── 유효성 검사 ──
  String? _validate() {
    if (_step == 0) {
      if (_nameCtrl.text.trim().isEmpty) return '이름을 입력해주세요.';
      if (_birthDate.isEmpty) return '생년월일을 선택해주세요.';
      final age = _calcAge(_birthDate);
      if (age == null || age < 14) return '만 14세 이상만 가입할 수 있어요.';
      if (_cityCtrl.text.trim().isEmpty) return '시/도를 입력해주세요.';
      if (_districtCtrl.text.trim().isEmpty) return '구/군을 입력해주세요.';
      if (_dongCtrl.text.trim().isEmpty) return '도로명/동네를 입력해주세요.';
      if (_phoneCtrl.text.trim().isEmpty) return '전화번호를 입력해주세요.';
    }
    if (_step == 1) {
      if (_heightCtrl.text.trim().isEmpty) return '키를 입력해주세요.';
      if (_weightCtrl.text.trim().isEmpty) return '몸무게를 입력해주세요.';
    }
    return null;
  }

  void _next() async {
    final err = _validate();
    if (err != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(err), backgroundColor: const Color(0xFFD94E4E)),
      );
      return;
    }
    if (_step < _steps.length - 1) {
      setState(() => _step++);
      return;
    }
    await _submit();
  }

  void _prev() {
    if (_step > 0) setState(() => _step--);
  }

  /// 선택 단계(1~6) 건너뛰기 — 유효성 검사 없이 다음 단계로
  void _skip() {
    if (_step < _steps.length - 1) {
      setState(() => _step++);
    } else {
      // 마지막 단계에서 건너뛰면 바로 등록
      _submit();
    }
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 65),
      firstDate: DateTime(1900),
      lastDate: now,
    );
    if (picked == null) return;
    setState(() {
      _birthDate =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    });
  }

  Future<void> _pickProfileImage() async {
    final picker = ImagePicker();
    final picked =
        await picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    setState(() => _uploadingPhoto = true);
    try {
      final bytes = await picked.readAsBytes();
      final request = http.MultipartRequest(
          'POST', Uri.parse('$apiBaseUrl/api/uploads/profile'))
        ..files.add(http.MultipartFile.fromBytes('image', bytes,
            filename: picked.name));
      final streamed =
          await request.send().timeout(const Duration(seconds: 15));
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
        final data = jsonDecode(body) as Map<String, dynamic>;
        final url = '${data['fileUrl'] ?? data['imageUrl'] ?? ''}';
        if (url.isNotEmpty && mounted) setState(() => _profileImageUrl = url);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(const SnackBar(content: Text('사진 업로드 실패')));
      }
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  void _syncMedications(String count) {
    setState(() {
      _medicineCount = count;
      int target = 0;
      if (count == '1~2개') { target = 2; }
      else if (count == '3~5개') { target = 3; }
      else if (count == '6개 이상') { target = 6; }
      while (_medications.length < target) {
        _medications.add({
          'name': '', 'startDate': '', 'endDate': '',
          'ongoing': false, 'interval': '', 'dailyCount': '', 'alertEnabled': false,
        });
      }
      while (_medications.length > target) {
        _medications.removeLast();
      }
    });
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    final region = [
      _cityCtrl.text.trim(), _districtCtrl.text.trim(),
      _dongCtrl.text.trim(), _detailCtrl.text.trim(),
    ].where((s) => s.isNotEmpty).join(' ');

    final age = _calcAge(_birthDate);

    final data = <String, dynamic>{
      'name': _nameCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'birthDate': _birthDate,
      'age': age != null ? '$age' : '',
      'gender': _gender,
      'region': region,
      'profileImageUrl': _profileImageUrl,
      'disabilityGrade': _disabilityGrade == _none ? '' : _disabilityGrade,
      'disabilityType': _disabilityType == _none ? '' : _disabilityType,
      'hasGuardian': _hasGuardian,
      // 건강 정보
      'height': _heightCtrl.text.trim(),
      'weight': _weightCtrl.text.trim(),
      'smoking': _smoking,
      'drinking': _drinking,
      'allergies': _allergiesCtrl.text.trim(),
      // 복약
      'medicineCount': _medicineCount,
      'medicationsJson': jsonEncode(_medications),
      // 만성질환
      ..._chronic,
      // 거동/인지/감각
      'walkingAid': _walkingAid,
      'dementia': _dementia,
      'vision': _vision,
      'hearing': _hearing,
      'recentFall': _recentFall,
      // 복지
      'livingCostStatus': _livingCostStatus,
      'householdType': _householdType,
      'currentBenefits': _currentBenefits,
      'pensionStatus': _pensionStatus,
      'housingType': _housingType,
      'careNeeds': _careNeeds,
      'welfareMemo': _welfareMemoCtrl.text.trim(),
      // 활동/일자리
      'maxHours': _maxHours,
      'maxDistance': _maxDistance,
      'disabledWork': _disabledWork,
      'restNeed': _restNeed,
      'avoidEnvironment': _avoidEnvironment,
      'payType': _payType,
      'hopeDays': _hopeDays,
      'hopeJobType': _hopeJobType,
      'hopeCondition': _hopeCondition,
      'memo': _memoCtrl.text.trim(),
      // 서버 필수 필드
      'hasSurgery': '', 'surgeryDetail': '', 'otherDisease': '',
      'bloodPressure': '', 'healthStatus': '', 'incomeLevel': '',
      'welfareDecision': '',
    };

    try {
      final response = await const SeniorApi().signUpSeniorFull(data);
      final senior = response['senior'] as Map<String, dynamic>?;
      if (senior == null) throw Exception('어르신 정보가 없습니다.');
      final seniorId = senior['id'];
      await SeniorSessionStorage.saveSeniorId(seniorId);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => AppShell(seniorId: seniorId)),
        (_) => false,
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().contains('이미 등록된 전화번호')
              ? '이미 등록된 전화번호입니다.'
              : '회원가입에 실패했습니다. 다시 시도해주세요.'),
          backgroundColor: const Color(0xFFD94E4E),
        ));
        setState(() { _step = 0; _saving = false; });
      }
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
        leading: _step > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                onPressed: _prev)
            : null,
        title: Text(
          '사용자 정보 등록 ${_step + 1} / ${_steps.length}',
          style: const TextStyle(
              color: Color(0xFF1F2A20),
              fontWeight: FontWeight.w900,
              fontSize: 16),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(6),
          child: LinearProgressIndicator(
            value: (_step + 1) / _steps.length,
            backgroundColor: const Color(0xFFE8F5E9),
            valueColor:
                const AlwaysStoppedAnimation<Color>(Color(0xFF86A788)),
            minHeight: 6,
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(child: _SuStepTitle(_steps[_step])),
                  if (_step == _steps.length - 1)
                    GestureDetector(
                      onTap: _saving ? null : _skip,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF86A788),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: const Text(
                          '건너뛰기',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 20),
              if (_step == 0) _buildStep0(),
              if (_step == 1) _buildStep1(),
              if (_step == 2) _buildStep2(),
              if (_step == 3) _buildStep3(),
              if (_step == 4) _buildStep4(),
              if (_step == 5) _buildStep5(),
              if (_step == 6) _buildStep6(),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 4, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 2),
              Row(children: [
                if (_step > 0) ...[
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving ? null : _prev,
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        side: const BorderSide(color: Color(0xFF86A788)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('이전',
                          style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Color(0xFF86A788))),
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    onPressed: _saving || _uploadingPhoto ? null : _next,
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF86A788),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: Text(
                      _saving
                          ? '저장 중...'
                          : _step == _steps.length - 1
                              ? '등록 완료'
                              : '다음',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w900),
                    ),
                  ),
                ),
              ]),
            ],
          ),
        ),
      ),
    );
  }

  // ── Step 0: 기본 정보 ─────────────────────────────────────────────────────
  Widget _buildStep0() {
    final age = _calcAge(_birthDate);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      // 프로필 사진
      Center(
        child: Stack(children: [
          CircleAvatar(
            radius: 48,
            backgroundColor: const Color(0xFFE8F5E9),
            backgroundImage: _profileImageUrl.isNotEmpty
                ? _profileImageProvider(_profileImageUrl.startsWith('/')
                    ? '$apiBaseUrl$_profileImageUrl'
                    : _profileImageUrl)
                : null,
            child: _profileImageUrl.isEmpty
                ? const Icon(Icons.person, size: 48, color: Color(0xFF86A788))
                : null,
          ),
          Positioned(
            right: 0,
            bottom: 0,
            child: GestureDetector(
              onTap: _uploadingPhoto ? null : _pickProfileImage,
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: const BoxDecoration(
                    color: Color(0xFF86A788), shape: BoxShape.circle),
                child: _uploadingPhoto
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.camera_alt,
                        size: 16, color: Colors.white),
              ),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 24),
      const _SuLabel('이름 *'),
      _SuTextField(controller: _nameCtrl, hint: '예: 김영희'),
      const SizedBox(height: 16),
      const _SuLabel('생년월일 *'),
      GestureDetector(
        onTap: _pickBirthDate,
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          decoration: BoxDecoration(
              color: const Color(0xFFF7F5E8),
              borderRadius: BorderRadius.circular(10)),
          child: Row(children: [
            Expanded(
              child: Text(
                _birthDate.isEmpty
                    ? '예: 1950-01-01'
                    : '$_birthDate${age != null ? '  (만 $age세)' : ''}',
                style: TextStyle(
                    color: _birthDate.isEmpty
                        ? const Color(0xFFBDBDBD)
                        : const Color(0xFF1F2A20),
                    fontSize: 15),
              ),
            ),
            const Icon(Icons.calendar_month_outlined,
                color: Color(0xFF86A788)),
          ]),
        ),
      ),
      const SizedBox(height: 16),
      const _SuLabel('성별 *'),
      Row(
        children: ['여성', '남성', '기타'].map((g) {
          final selected = _gender == g;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: 8),
              child: GestureDetector(
                onTap: () => setState(() => _gender = g),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  decoration: BoxDecoration(
                    color: selected
                        ? const Color(0xFF86A788)
                        : const Color(0xFFF7F5E8),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(g,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: selected
                              ? Colors.white
                              : const Color(0xFF1F2A20))),
                ),
              ),
            ),
          );
        }).toList(),
      ),
      const SizedBox(height: 16),
      const _SuLabel('시/도 *'),
      _SuTextField(controller: _cityCtrl, hint: '예: 서울특별시'),
      const SizedBox(height: 10),
      const _SuLabel('구/군 *'),
      _SuTextField(controller: _districtCtrl, hint: '예: 강남구'),
      const SizedBox(height: 10),
      const _SuLabel('도로명/동네 *'),
      _SuTextField(controller: _dongCtrl, hint: '예: 역삼로, 역삼동'),
      const SizedBox(height: 10),
      const _SuLabel('상세 주소'),
      _SuTextField(controller: _detailCtrl, hint: '예: 101동 1203호'),
      const SizedBox(height: 16),
      const _SuLabel('전화번호 *'),
      _SuTextField(
          controller: _phoneCtrl,
          hint: '010-0000-0000',
          keyboardType: TextInputType.phone,
          inputFormatters: [PhoneNumberFormatter()]),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SuLabel('장애 등급'),
                _SuDropdown(
                  value: _disabilityGrade,
                  items: _disabilityGrades,
                  onChanged: (v) => setState(() => _disabilityGrade = v),
                ),
              ]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SuLabel('장애 유형'),
                _SuDropdown(
                  value: _disabilityType,
                  items: _disabilityTypes,
                  onChanged: (v) => setState(() => _disabilityType = v),
                ),
              ]),
        ),
      ]),
      const SizedBox(height: 8),
      // ── 보호자 유무 ──────────────────────────────────────────────────
      Container(
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
              value: _hasGuardian,
              activeColor: const Color(0xFF86A788),
              onChanged: (v) => setState(() => _hasGuardian = v),
            ),
          ],
        ),
      ),
    ]);
  }

  // ── Step 1: 건강 정보 ─────────────────────────────────────────────────────
  Widget _buildStep1() {
    final bmi = _calcBmi(_heightCtrl.text, _weightCtrl.text);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const _SuHint('키와 몸무게를 입력하면 BMI가 자동으로 계산돼요.'),
      const SizedBox(height: 16),
      Row(children: [
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SuLabel('키(cm) *'),
                _SuTextField(
                    controller: _heightCtrl,
                    hint: '예: 165',
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {})),
              ]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SuLabel('몸무게(kg) *'),
                _SuTextField(
                    controller: _weightCtrl,
                    hint: '예: 60',
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {})),
              ]),
        ),
      ]),
      if (bmi != null) ...[
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: (bmi['color'] as Color).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(children: [
            Expanded(
              child: Column(children: [
                const Text('BMI',
                    style: TextStyle(fontSize: 12, color: Color(0xFF6D766A))),
                Text(bmi['bmi'] as String,
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: bmi['color'] as Color)),
              ]),
            ),
            Expanded(
              child: Column(children: [
                const Text('판정',
                    style: TextStyle(fontSize: 12, color: Color(0xFF6D766A))),
                Text(bmi['status'] as String,
                    style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: bmi['color'] as Color)),
              ]),
            ),
            Expanded(
              flex: 2,
              child: Text(bmi['guide'] as String,
                  style: const TextStyle(
                      fontSize: 13, color: Color(0xFF6D766A))),
            ),
          ]),
        ),
      ],
      const SizedBox(height: 16),
      const _SuLabel('흡연 여부'),
      _ChipSelector(
          value: _smoking,
          options: const [_none, '금연 중', '과거 흡연', '가끔 흡연', '흡연 중'],
          onSelect: (v) => setState(() => _smoking = v)),
      const SizedBox(height: 16),
      const _SuLabel('음주 여부'),
      _ChipSelector(
          value: _drinking,
          options: const [_none, '금주 실천 중', '가끔', '주 1~2회', '자주'],
          onSelect: (v) => setState(() => _drinking = v)),
      const SizedBox(height: 16),
      const _SuLabel('알레르기 정보'),
      _SuTextField(
          controller: _allergiesCtrl, hint: '예: 땅콩, 우유 / 없으면 없음'),
    ]);
  }

  // ── Step 2: 복약 정보 ─────────────────────────────────────────────────────
  Widget _buildStep2() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const _SuLabel('현재 복용 중인 약 개수'),
      _ChipSelector(
          value: _medicineCount,
          options: _medicineCounts,
          onSelect: _syncMedications),
      const SizedBox(height: 16),
      ..._medications.asMap().entries.map((entry) {
        final i = entry.key;
        final med = entry.value;
        return _MedicationCard(
          index: i,
          medicine: med,
          onChanged: (key, value) =>
              setState(() => _medications[i][key] = value),
          onRemove: () => setState(() => _medications.removeAt(i)),
        );
      }),
      if (_medicineCount.isNotEmpty && _medicineCount != _none)
        OutlinedButton.icon(
          onPressed: () => setState(() => _medications.add({
            'name': '', 'startDate': '', 'endDate': '',
            'ongoing': false, 'interval': '', 'dailyCount': '',
            'alertEnabled': false,
          })),
          icon: const Icon(Icons.add),
          label: const Text('복용 약 추가'),
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF86A788),
            side: const BorderSide(color: Color(0xFF86A788)),
          ),
        ),
    ]);
  }

  // ── Step 3: 건강 상태 ─────────────────────────────────────────────────────
  Widget _buildStep3() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const _SuHint('어려운 의학 단계 대신 일상에서 판단하기 쉬운 기준으로 선택해주세요.'),
      const SizedBox(height: 16),
      ..._chronicDiseases.map((d) {
        final key = d['key']!;
        final label = d['label']!;
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _SuLabel(label),
                _ChipSelector(
                  value: _chronic[key] ?? '',
                  options: _chronicLevels,
                  onSelect: (v) => setState(() => _chronic[key] = v),
                ),
              ]),
        );
      }),
    ]);
  }

  // ── Step 4: 거동/인지/감각 ───────────────────────────────────────────────
  Widget _buildStep4() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const _SuLabel('보행 보조기구'),
      _ChipSelector(
          value: _walkingAid,
          options: const [_none, '지팡이', '보행기', '휠체어'],
          onSelect: (v) => setState(() => _walkingAid = v)),
      const SizedBox(height: 16),
      const _SuLabel('기억하거나 판단하는 데 어려움'),
      _ChipSelector(
          value: _dementia,
          options: const [_none, '가끔 헷갈림', '도움이 자주 필요함'],
          onSelect: (v) => setState(() => _dementia = v)),
      const SizedBox(height: 16),
      const _SuLabel('눈으로 보는 데 어려움'),
      _ChipSelector(
          value: _vision,
          options: _visionLevels,
          onSelect: (v) => setState(() => _vision = v)),
      const SizedBox(height: 16),
      const _SuLabel('귀로 듣는 데 어려움'),
      _ChipSelector(
          value: _hearing,
          options: _hearingLevels,
          onSelect: (v) => setState(() => _hearing = v)),
      const SizedBox(height: 16),
      const _SuLabel('최근 1년 낙상 경험'),
      _ChipSelector(
          value: _recentFall,
          options: const [_none, '1회', '2~3회', '4회 이상'],
          onSelect: (v) => setState(() => _recentFall = v)),
    ]);
  }

  // ── Step 5: 복지 정보 ─────────────────────────────────────────────────────
  Widget _buildStep5() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const _SuHint('복지 제도 추천과 상담에 필요한 정보입니다.\n잘 모르는 항목은 나중에 보호자나 복지사가 도와드릴 수 있어요.'),
      const SizedBox(height: 16),
      const _SuLabel('생활비 상황'),
      _ChipSelector(
          value: _livingCostStatus,
          options: _livingCostStatuses,
          onSelect: (v) => setState(() => _livingCostStatus = v)),
      const SizedBox(height: 16),
      const _SuLabel('가구 형태'),
      _ChipSelector(
          value: _householdType,
          options: _householdTypesList,
          onSelect: (v) => setState(() => _householdType = v)),
      const SizedBox(height: 16),
      const _SuLabel('현재 받고 있는 복지 혜택 (복수 선택)'),
      _MultiChipSelector(
          values: _currentBenefits,
          options: _currentBenefitsList,
          onToggle: (v) => setState(() {
            if (_currentBenefits.contains(v)) {
              _currentBenefits.remove(v);
            } else {
              _currentBenefits.add(v);
            }
          })),
      const SizedBox(height: 16),
      const _SuLabel('연금 수급 상태'),
      _ChipSelector(
          value: _pensionStatus,
          options: _pensionStatuses,
          onSelect: (v) => setState(() => _pensionStatus = v)),
      const SizedBox(height: 16),
      const _SuLabel('주거 형태'),
      _ChipSelector(
          value: _housingType,
          options: _housingTypesList,
          onSelect: (v) => setState(() => _housingType = v)),
      const SizedBox(height: 16),
      const _SuLabel('도움이 필요한 일 (복수 선택)'),
      _MultiChipSelector(
          values: _careNeeds,
          options: _careNeedsList,
          onToggle: (v) => setState(() {
            if (_careNeeds.contains(v)) {
              _careNeeds.remove(v);
            } else {
              _careNeeds.add(v);
            }
          })),
      const SizedBox(height: 16),
      const _SuLabel('그 밖에 참고사항'),
      TextField(
        controller: _welfareMemoCtrl,
        maxLines: 4,
        decoration: _inputDecoration(hint: '예: 구청 지원, 병원비 지원, 식사 지원 등'),
      ),
    ]);
  }

  // ── Step 6: 활동/일자리 ───────────────────────────────────────────────────
  Widget _buildStep6() {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Row(children: [
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SuLabel('하루 최대 활동 시간'),
                _SuDropdown(
                  value: _maxHours.isEmpty ? _none : _maxHours,
                  items: const [_none, '2', '4', '6', '8'],
                  labels: const {
                    _none: '선택',
                    '2': '2시간 이내',
                    '4': '4시간 이내',
                    '6': '6시간 이내',
                    '8': '8시간 이내',
                  },
                  onChanged: (v) =>
                      setState(() => _maxHours = v == _none ? '' : v),
                ),
              ]),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const _SuLabel('이동 가능 거리'),
                _SuDropdown(
                  value: _maxDistance.isEmpty ? _none : _maxDistance,
                  items: const [
                    _none,
                    '도보 10분 이내',
                    '도보 30분 이내',
                    '대중교통 30분 이내',
                    '대중교통 1시간 이내'
                  ],
                  onChanged: (v) =>
                      setState(() => _maxDistance = v == _none ? '' : v),
                ),
              ]),
        ),
      ]),
      const SizedBox(height: 16),
      const _SuLabel('하기 어려운 작업 (복수 선택)'),
      _MultiChipSelector(
          values: _disabledWork,
          options: _workTypesList,
          onToggle: (v) => setState(() {
            if (_disabledWork.contains(v)) {
              _disabledWork.remove(v);
            } else {
              _disabledWork.add(v);
            }
          })),
      const SizedBox(height: 16),
      const _SuLabel('쉬는 시간이 얼마나 필요하세요?'),
      _ChipSelector(
          value: _restNeed,
          options: _restNeeds,
          onSelect: (v) => setState(() => _restNeed = v)),
      const SizedBox(height: 16),
      const _SuLabel('피하고 싶은 작업 환경 (복수 선택)'),
      _MultiChipSelector(
          values: _avoidEnvironment,
          options: _avoidEnvironments,
          onToggle: (v) => setState(() {
            if (_avoidEnvironment.contains(v)) {
              _avoidEnvironment.remove(v);
            } else {
              _avoidEnvironment.add(v);
            }
          })),
      const SizedBox(height: 16),
      const _SuLabel('희망 급여 형태'),
      _ChipSelector(
          value: _payType,
          options: const ['무관', '시급', '월급', '일당'],
          onSelect: (v) => setState(() => _payType = v)),
      const SizedBox(height: 16),
      const _SuLabel('희망 근무 요일 (복수 선택)'),
      _MultiChipSelector(
          values: _hopeDays,
          options: _daysList,
          onToggle: (v) => setState(() {
            if (_hopeDays.contains(v)) {
              _hopeDays.remove(v);
            } else {
              _hopeDays.add(v);
            }
          })),
      const SizedBox(height: 16),
      const _SuLabel('희망 직종 (복수 선택)'),
      _MultiChipSelector(
          values: _hopeJobType,
          options: _jobTypesList,
          onToggle: (v) => setState(() {
            if (_hopeJobType.contains(v)) {
              _hopeJobType.remove(v);
            } else {
              _hopeJobType.add(v);
            }
          })),
      const SizedBox(height: 16),
      const _SuLabel('희망 근무 형태 (복수 선택)'),
      _MultiChipSelector(
          values: _hopeCondition,
          options: _jobConditionsList,
          onToggle: (v) => setState(() {
            if (_hopeCondition.contains(v)) {
              _hopeCondition.remove(v);
            } else {
              _hopeCondition.add(v);
            }
          })),
      const SizedBox(height: 16),
      const _SuLabel('기타 희망사항'),
      TextField(
        controller: _memoCtrl,
        maxLines: 4,
        decoration: _inputDecoration(hint: '원하시는 것을 자유롭게 적어주세요'),
      ),
    ]);
  }
}

// ── 공통 위젯 ─────────────────────────────────────────────────────────────────

class _SuStepTitle extends StatelessWidget {
  const _SuStepTitle(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Text(text,
      style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w900,
          color: Color(0xFF1F2A20)));
}

class _SuLabel extends StatelessWidget {
  const _SuLabel(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(text,
          style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1F2A20))));
}

class _SuHint extends StatelessWidget {
  const _SuHint(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
          color: const Color(0xFFF0F7F0),
          borderRadius: BorderRadius.circular(8)),
      child: Text(text,
          style: const TextStyle(
              fontSize: 13, color: Color(0xFF5A7A5C), height: 1.5)));
}

class _SuTextField extends StatelessWidget {
  const _SuTextField({
    required this.controller,
    required this.hint,
    this.keyboardType,
    this.onChanged,
    this.inputFormatters,
  });
  final TextEditingController controller;
  final String hint;
  final TextInputType? keyboardType;
  final ValueChanged<String>? onChanged;
  final List<TextInputFormatter>? inputFormatters;
  @override
  Widget build(BuildContext context) => TextField(
      controller: controller,
      keyboardType: keyboardType,
      onChanged: onChanged,
      inputFormatters: inputFormatters,
      decoration: _inputDecoration(hint: hint));
}

class _SuDropdown extends StatelessWidget {
  const _SuDropdown({
    required this.value,
    required this.items,
    required this.onChanged,
    this.labels = const {},
  });
  final String value;
  final List<String> items;
  final ValueChanged<String> onChanged;
  final Map<String, String> labels;
  @override
  Widget build(BuildContext context) => DropdownButtonFormField<String>(
      value: items.contains(value) ? value : items.first,
      decoration: _inputDecoration(hint: '선택'),
      isExpanded: true,
      items: items
          .map((item) => DropdownMenuItem(
              value: item,
              child: Text(labels[item] ?? item,
                  overflow: TextOverflow.ellipsis)))
          .toList(),
      onChanged: (v) { if (v != null) onChanged(v); });
}

class _ChipSelector extends StatelessWidget {
  const _ChipSelector(
      {required this.value, required this.options, required this.onSelect});
  final String value;
  final List<String> options;
  final ValueChanged<String> onSelect;
  @override
  Widget build(BuildContext context) => Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((opt) {
        final selected = value == opt;
        return GestureDetector(
          onTap: () => onSelect(selected ? '' : opt),
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: selected
                  ? const Color(0xFF86A788)
                  : const Color(0xFFF7F5E8),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: selected
                      ? const Color(0xFF86A788)
                      : const Color(0xFFE0E0E0)),
            ),
            child: Text(opt,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected
                        ? Colors.white
                        : const Color(0xFF6D766A))),
          ),
        );
      }).toList());
}

class _MultiChipSelector extends StatelessWidget {
  const _MultiChipSelector(
      {required this.values, required this.options, required this.onToggle});
  final List<String> values;
  final List<String> options;
  final ValueChanged<String> onToggle;
  @override
  Widget build(BuildContext context) => Wrap(
      spacing: 8,
      runSpacing: 8,
      children: options.map((opt) {
        final selected = values.contains(opt);
        return GestureDetector(
          onTap: () => onToggle(opt),
          child: Container(
            padding:
                const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: selected
                  ? const Color(0xFF86A788)
                  : const Color(0xFFF7F5E8),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                  color: selected
                      ? const Color(0xFF86A788)
                      : const Color(0xFFE0E0E0)),
            ),
            child: Text(opt,
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: selected
                        ? Colors.white
                        : const Color(0xFF6D766A))),
          ),
        );
      }).toList());
}

class _MedicationCard extends StatefulWidget {
  const _MedicationCard({
    required this.index,
    required this.medicine,
    required this.onChanged,
    required this.onRemove,
  });
  final int index;
  final Map<String, dynamic> medicine;
  final void Function(String key, dynamic value) onChanged;
  final VoidCallback onRemove;

  @override
  State<_MedicationCard> createState() => _MedicationCardState();
}

class _MedicationCardState extends State<_MedicationCard> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _intervalCtrl;
  late final TextEditingController _dailyCtrl;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: '${widget.medicine['name'] ?? ''}');
    _intervalCtrl = TextEditingController(text: '${widget.medicine['interval'] ?? ''}');
    _dailyCtrl = TextEditingController(text: '${widget.medicine['dailyCount'] ?? ''}');
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _intervalCtrl.dispose();
    _dailyCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(String key, {bool enabled = true}) async {
    if (!enabled) return;
    final now = DateTime.now();
    final current = widget.medicine[key] as String? ?? '';
    DateTime initial;
    try {
      initial = current.isNotEmpty ? DateTime.parse(current) : now;
    } catch (_) {
      initial = now;
    }
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2000),
      lastDate: now,
    );
    if (picked == null) return;
    final formatted =
        '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
    widget.onChanged(key, formatted);
  }

  Widget _dateTile(String label, String key, {bool enabled = true}) {
    final value = widget.medicine[key] as String? ?? '';
    return Expanded(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _SuLabel(label),
        GestureDetector(
          onTap: enabled ? () => _pickDate(key, enabled: enabled) : null,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
            decoration: BoxDecoration(
              color: enabled
                  ? const Color(0xFFF7F5E8)
                  : const Color(0xFFEEEEEE),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(children: [
              Expanded(
                child: Text(
                  value.isEmpty ? 'YYYY-MM-DD' : value,
                  style: TextStyle(
                    fontSize: 13,
                    color: value.isEmpty
                        ? const Color(0xFFBDBDBD)
                        : enabled
                            ? const Color(0xFF1F2A20)
                            : const Color(0xFFAAAAAA),
                  ),
                ),
              ),
              Icon(Icons.calendar_month_outlined,
                  size: 16,
                  color: enabled
                      ? const Color(0xFF86A788)
                      : const Color(0xFFCCCCCC)),
            ]),
          ),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ongoing = widget.medicine['ongoing'] as bool? ?? false;
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
                  fontWeight: FontWeight.w900, fontSize: 15)),
          const Spacer(),
          GestureDetector(
              onTap: widget.onRemove,
              child: const Icon(Icons.close,
                  size: 18, color: Color(0xFFD94E4E))),
        ]),
        const SizedBox(height: 10),
        const _SuLabel('약 이름'),
        TextField(
          controller: _nameCtrl,
          decoration: _inputDecoration(hint: '예: 혈압약'),
          onChanged: (v) => widget.onChanged('name', v),
        ),
        const SizedBox(height: 10),
        Row(children: [
          _dateTile('복용 시작일', 'startDate'),
          const SizedBox(width: 8),
          _dateTile('복용 종료일', 'endDate', enabled: !ongoing),
        ]),
        Row(children: [
          Checkbox(
            value: ongoing,
            onChanged: (v) => widget.onChanged('ongoing', v ?? false),
            activeColor: const Color(0xFF86A788),
          ),
          const Flexible(
            child: Text('계속 복용 중이라 종료일이 없어요',
                style: TextStyle(fontSize: 13)),
          ),
        ]),
        Row(children: [
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SuLabel('복용 간격(시간)'),
                  TextField(
                    controller: _intervalCtrl,
                    decoration: _inputDecoration(hint: '예: 8'),
                    keyboardType: TextInputType.number,
                    onChanged: (v) => widget.onChanged('interval', v),
                  ),
                ]),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const _SuLabel('하루 복용 횟수'),
                  TextField(
                    controller: _dailyCtrl,
                    decoration: _inputDecoration(hint: '예: 2'),
                    keyboardType: TextInputType.number,
                    onChanged: (v) => widget.onChanged('dailyCount', v),
                  ),
                ]),
          ),
        ]),
        Row(children: [
          Checkbox(
            value: widget.medicine['alertEnabled'] as bool? ?? false,
            onChanged: (v) => widget.onChanged('alertEnabled', v ?? false),
            activeColor: const Color(0xFF86A788),
          ),
          const Flexible(
            child: Text('이 약 복용 시간에 알림 받기',
                style: TextStyle(fontSize: 13)),
          ),
        ]),
      ]),
    );
  }
}

InputDecoration _inputDecoration({required String hint}) => InputDecoration(
    hintText: hint,
    hintStyle:
        const TextStyle(color: Color(0xFFCECECE), fontSize: 14),
    filled: true,
    fillColor: const Color(0xFFF7F5E8),
    contentPadding:
        const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide.none));

// 전화번호 포매터는 lib/core/utils/phone_formatter.dart 의 PhoneNumberFormatter 사용
