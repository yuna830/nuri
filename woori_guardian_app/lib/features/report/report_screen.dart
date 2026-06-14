import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;
import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:kakao_map_sdk/kakao_map_sdk.dart' as kakao;
import '../../core/api/guardian_api.dart';
import '../../core/config/app_config.dart';
import '../../core/models/safe_zone.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';
import '../../core/utils/phone_number_input_formatter.dart';
import '../../core/theme/app_colors.dart';

// ── 색상 ─────────────────────────────────────────────────────────────────
const _kGreen = AppColors.green;
const _kSafe = AppColors.safe;
const _kSafeBg = AppColors.safeBg;
const _kWarn = AppColors.warn;
const _kWarnBg = AppColors.warnBg;
const _kRed = AppColors.red;
const _kTextMain = AppColors.textMain;
const _disableKakaoMap = bool.fromEnvironment('DISABLE_KAKAO_MAP');
const _kTextSub = AppColors.textSub;
const _kTextHint = AppColors.textHint;
const _kDivider = AppColors.divider;
const _kBg = Colors.white;

// ── 신고 유형 ─────────────────────────────────────────────────────────────────

class _ReportType {
  final String value;
  final String label;
  final IconData icon;
  const _ReportType(this.value, this.label, this.icon);
}

const _kReportTypesRegistered = [
  _ReportType('missing', '실종 신고', Icons.search_off),
  _ReportType('danger', '위험 상황 신고', Icons.warning_amber_rounded),
  _ReportType('zone', '위치 이탈', Icons.location_off),
  _ReportType('fall', '낙상 의심', Icons.personal_injury),
];

const _kReportTypesOther = [
  _ReportType('missing', '실종 신고', Icons.search_off),
  _ReportType('danger', '위험 상황 신고', Icons.warning_amber_rounded),
];

enum _LocationMode { lastKnown, mapPick, search }

enum _TargetMode { registeredSenior, otherPerson }

const _kGenderOptions = ['남성', '여성'];

// ── 화면 ─────────────────────────────────────────────────────────────────────

class ReportScreen extends StatefulWidget {
  final VoidCallback? onCompleted;

  /// 얼굴 확인 카메라에서 진입할 때 '직접 입력' 탭을 미리 선택한다.
  final bool startInDirectInput;

  /// 얼굴 확인 카메라에서 찍은 사진을 사진 첨부에 미리 넣는다.
  final String? initialPhotoPath;

  /// 홈 화면에서 특정 대상자를 선택하고 신고 탭으로 넘어올 때 즉시 표시할 대상자.
  final Senior? initialSenior;

  const ReportScreen({
    super.key,
    this.onCompleted,
    this.startInDirectInput = false,
    this.initialPhotoPath,
    this.initialSenior,
  });

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();
  final _picker = ImagePicker();

  _ReportType? _selectedType;
  Senior? _selectedSenior;
  List<Senior> _seniors = [];
  bool _seniorsLoading = true;
  String? _zoneStatusBadge;

  final _descCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();

  DateTime _incidentTime = DateTime.now();
  _LocationMode _locationMode = _LocationMode.lastKnown;

  final List<XFile> _photos = [];

  bool _consentGiven = false;
  bool _submitting = false;

  // 주소 검색
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;
  List<_KakaoPlaceResult> _searchResults = [];
  bool _searchLoading = false;

  _TargetMode _targetMode = _TargetMode.registeredSenior;

  final _otherNameCtrl = TextEditingController();
  final _otherAgeCtrl = TextEditingController();
  final _otherPhoneCtrl = TextEditingController();
  final _otherClothesCtrl = TextEditingController();

  String _otherGender = '여성';

  double? _selectedLocationLatitude;
  double? _selectedLocationLongitude;

  bool get _canSubmit {
    final hasTarget = _targetMode == _TargetMode.registeredSenior
        ? _selectedSenior != null
        : _otherNameCtrl.text.trim().isNotEmpty &&
              _otherAgeCtrl.text.trim().isNotEmpty &&
              _otherPhoneCtrl.text.trim().isNotEmpty &&
              _locationCtrl.text.trim().isNotEmpty;

    return _selectedType != null && hasTarget && _consentGiven;
  }

  // ── 생명주기 ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    if (widget.startInDirectInput) {
      _targetMode = _TargetMode.otherPerson;
    }
    final initialPhotoPath = widget.initialPhotoPath;
    if (initialPhotoPath != null && initialPhotoPath.isNotEmpty) {
      _photos.add(XFile(initialPhotoPath));
    }
    // 홈에서 넘어온 대상자를 API 응답 전에 즉시 표시
    if (widget.initialSenior != null) {
      _selectedSenior = widget.initialSenior;
      _seniorsLoading = false;
      _applyLastKnownLocation(widget.initialSenior!);
      _loadZoneStatus(widget.initialSenior!);
    }
    _loadSeniors();
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _searchCtrl.dispose();
    _searchDebounce?.cancel();
    _otherNameCtrl.dispose();
    _otherAgeCtrl.dispose();
    _otherPhoneCtrl.dispose();
    super.dispose();
  }

  // ── 데이터 ────────────────────────────────────────────────────────────────

  Future<void> _loadSeniors() async {
    try {
      final info = await _sessionStorage.getGuardianInfo();
      final gid = info['guardianId'];
      if (gid == null || gid.isEmpty) return;
      final list = await _api.fetchGuardianSeniors(int.parse(gid));
      if (!mounted) return;
      setState(() {
        _seniors = list;
        _seniorsLoading = false;
        if (list.isNotEmpty) {
          // 이미 선택된 대상자가 있으면 목록의 최신 데이터로 교체, 없으면 첫 번째 선택
          final currentId = _selectedSenior?.id;
          final initial = currentId != null
              ? list.firstWhere((s) => s.id == currentId, orElse: () => list.first)
              : list.first;
          _selectedSenior = initial;
          _applyLastKnownLocation(initial);
          _loadZoneStatus(initial);
        }
      });
    } catch (_) {
      if (mounted) setState(() => _seniorsLoading = false);
    }
  }

  void _applyLastKnownLocation(Senior s) {
    if (_locationMode == _LocationMode.lastKnown) {
      _locationCtrl.text = s.lastLocationAddress != '위치 정보 없음'
          ? s.lastLocationAddress
          : '';

      // 등록된 대상자의 마지막 위치 주소만 있을 수 있으므로 좌표는 비워둠
      _selectedLocationLatitude = null;
      _selectedLocationLongitude = null;
    }
  }

  Future<void> _loadZoneStatus(Senior senior) async {
    setState(() => _zoneStatusBadge = null);
    try {
      final zones = await _api.fetchSafeZones(senior.id);
      final location = await _api.fetchLatestLocation(senior.id);
      final lat = (location['latitude'] as num?)?.toDouble();
      final lng = (location['longitude'] as num?)?.toDouble();
      if (zones.isEmpty || lat == null || lng == null) return;

      final inside = zones.any(
        (zone) =>
            _zoneDistanceMeters(
              zone.centerLatitude,
              zone.centerLongitude,
              lat,
              lng,
            ) <=
            zone.radiusMeters,
      );

      if (mounted && _selectedSenior?.id == senior.id) {
        setState(() => _zoneStatusBadge = inside ? '안전' : '이탈');
      }
    } catch (_) {}
  }

  double _zoneDistanceMeters(
    double lat1,
    double lng1,
    double lat2,
    double lng2,
  ) {
    const earthRadius = 6371000.0;
    final dLat = (lat2 - lat1) * math.pi / 180;
    final dLng = (lng2 - lng1) * math.pi / 180;
    final a =
        math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180) *
            math.cos(lat2 * math.pi / 180) *
            math.sin(dLng / 2) *
            math.sin(dLng / 2);
    return earthRadius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
  }

  // ── 액션 ─────────────────────────────────────────────────────────────────

  Future<void> _addPhoto() async {
    if (_photos.length >= 4) return;
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 80,
      );
      if (picked != null && mounted) {
        setState(() => _photos.add(picked));
      }
    } catch (e) {
      if (!mounted) return;
      _snack('사진을 불러올 수 없습니다. 앱을 완전히 재시작한 후 다시 시도해주세요.');
    }
  }

  void _removePhoto(int i) => setState(() => _photos.removeAt(i));

  // 발생 시간 선택
  Future<void> _pickTime() async {
    DateTime temp = _incidentTime;
    final title = _targetMode == _TargetMode.otherPerson
        ? '마지막 목격 시간'
        : '발생 시간';

    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Localizations.override(
          context: ctx,
          locale: const Locale('ko', 'KR'),
          child: SizedBox(
            height: 300,
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          title,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: _kTextMain,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text(
                          '취소',
                          style: TextStyle(color: _kTextSub),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          setState(() => _incidentTime = temp);
                          Navigator.pop(ctx);
                        },
                        child: const Text(
                          '확인',
                          style: TextStyle(
                            color: _kSafe,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const Divider(height: 1, color: _kDivider),
                Expanded(
                  child: CupertinoDatePicker(
                    initialDateTime: _incidentTime,
                    maximumDate: DateTime.now(),
                    minimumDate: DateTime.now().subtract(
                      const Duration(days: 30),
                    ),
                    mode: CupertinoDatePickerMode.dateAndTime,
                    use24hFormat: true,
                    onDateTimeChanged: (dt) => temp = dt,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // 주소 모드 변경
  Future<void> _onLocationModeChanged(_LocationMode mode) async {
    if (mode == _LocationMode.lastKnown) {
      // 직접 입력 대상자는 등록된 마지막 위치가 없으므로 사용하지 않음
      if (_targetMode == _TargetMode.otherPerson) return;

      setState(() {
        _locationMode = _LocationMode.lastKnown;
        _searchResults = [];
        _selectedLocationLatitude = null;
        _selectedLocationLongitude = null;
      });

      _searchCtrl.clear();

      if (_selectedSenior != null) {
        _applyLastKnownLocation(_selectedSenior!);
      }

      return;
    }

    if (mode == _LocationMode.search) {
      setState(() {
        _locationMode = _LocationMode.search;
        _searchResults = [];
        _selectedLocationLatitude = null;
        _selectedLocationLongitude = null;
      });

      _locationCtrl.clear();
      _searchCtrl.clear();
      return;
    }

    final initialLat = _selectedLocationLatitude ?? 37.5665;
    final initialLng = _selectedLocationLongitude ?? 126.9780;
    final initial = kakao.LatLng(initialLat, initialLng);

    final result = await Navigator.push<_MapPickResult>(
      context,
      MaterialPageRoute(builder: (_) => _ReportMapPickScreen(initial: initial)),
    );

    if (result != null && mounted) {
      setState(() {
        _locationMode = _LocationMode.mapPick;
        _selectedLocationLatitude = result.point.latitude;
        _selectedLocationLongitude = result.point.longitude;
        _locationCtrl.text = result.address.isNotEmpty
            ? result.address
            : '${result.point.latitude.toStringAsFixed(5)}, '
                  '${result.point.longitude.toStringAsFixed(5)}';
      });
    }
  }

  // 신고 제출
  Future<void> _submit() async {
    if (_selectedType == null) {
      _snack('신고 유형을 선택해주세요.');
      return;
    }
    if (_targetMode == _TargetMode.registeredSenior &&
        _selectedSenior == null) {
      _snack('대상자를 선택해주세요.');
      return;
    }

    if (_targetMode == _TargetMode.otherPerson) {
      if (_otherNameCtrl.text.trim().isEmpty) {
        _snack('신고 대상자 이름을 입력해주세요.');
        return;
      }

      if (_otherAgeCtrl.text.trim().isEmpty) {
        _snack('나이를 입력해주세요.');
        return;
      }

      if (_otherPhoneCtrl.text.trim().isEmpty) {
        _snack('연락처를 입력해주세요.');
        return;
      }

      if (_locationCtrl.text.trim().isEmpty) {
        _snack('마지막 위치를 선택해주세요.');
        return;
      }
    }
    if (!_consentGiven) {
      _snack('개인정보 수집 및 이용에 동의해주세요.');
      return;
    }

    setState(() => _submitting = true);

    try {
      final info = await _sessionStorage.getGuardianInfo();
      final guardianId = int.tryParse(info['guardianId'] ?? '');

      if (guardianId == null) {
        throw Exception('보호자 로그인 정보가 없습니다. 다시 로그인해주세요.');
      }

      final imageUrls = <String>[];

      for (final photo in _photos) {
        final uploadedUrl = await _uploadReportImage(photo);
        if (uploadedUrl != null && uploadedUrl.isNotEmpty) {
          imageUrls.add(uploadedUrl);
        }
      }

      final imageUrl = imageUrls.isNotEmpty ? imageUrls.first : null;

      final locationText = _locationCtrl.text.trim();
      final coords = _parseCoordinates(locationText);

      final lastSeenLatitude = _selectedLocationLatitude ?? coords?.$1;
      final lastSeenLongitude = _selectedLocationLongitude ?? coords?.$2;

      final response = await http
          .post(
            Uri.parse('${AppConfig.apiBaseUrl}/missing-reports'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'seniorId': _targetMode == _TargetMode.registeredSenior
                  ? _selectedSenior!.id
                  : null,
              'guardianId': guardianId,
              'lastSeenAddress': locationText.isEmpty ? null : locationText,
              'lastSeenLatitude': lastSeenLatitude,
              'lastSeenLongitude': lastSeenLongitude,
              'description': _buildReportDescription(),
              'imageUrl': imageUrl,
              'imageUrls': imageUrls,
            }),
          )
          .timeout(const Duration(seconds: 45));

      if (response.statusCode != 200 && response.statusCode != 201) {
        throw Exception('신고 접수 실패 (${response.statusCode})');
      }

      if (!mounted) return;

      await _showCompletedDialog();
    } on TimeoutException {
      if (mounted) {
        _snack('신고는 처리 중일 수 있습니다. 잠시 후 목록 또는 얼굴 확인을 다시 확인해주세요.');
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // 사진 업로드
  Future<String?> _uploadReportImage(XFile photo) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${AppConfig.apiBaseUrl}/uploads/missing-reports'),
    );

    request.files.add(await http.MultipartFile.fromPath('image', photo.path));

    final response = await request.send().timeout(const Duration(seconds: 30));
    final body = await response.stream.bytesToString();

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('사진 업로드 실패 (${response.statusCode})');
    }

    final data = jsonDecode(body) as Map<String, dynamic>;
    return data['imageUrl']?.toString() ?? data['fileUrl']?.toString();
  }

  // 신고 설명 빌드
  String _buildReportDescription() {
    final typeLabel = _selectedType?.label ?? '신고';
    final incidentTimeText = _formatDateTime(_incidentTime);
    final description = _descCtrl.text.trim();
    final locationText = _locationCtrl.text.trim();

    final targetLines = _targetMode == _TargetMode.otherPerson
        ? [
            '신고 대상: 직접 입력',
            '대상자 이름: ${_otherNameCtrl.text.trim()}',
            '나이: ${_otherAgeCtrl.text.trim()}',
            '성별: $_otherGender',
            '연락처: ${_otherPhoneCtrl.text.trim()}',
            if (locationText.isNotEmpty) '마지막 위치: $locationText',
            '마지막 목격 시간: $incidentTimeText',
          ]
        : [
            '신고 대상: 등록된 보호 대상자',
            if (_selectedSenior != null) '대상자 이름: ${_selectedSenior!.name}',
            if (locationText.isNotEmpty) '발생 장소: $locationText',
            '발생 시간: $incidentTimeText',
          ];

    return [
      '신고 유형: $typeLabel',
      ...targetLines,
      if (description.isNotEmpty) '',
      if (description.isNotEmpty) description,
    ].join('\n');
  }

  (double, double)? _parseCoordinates(String value) {
    final match = RegExp(
      r'^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$',
    ).firstMatch(value);

    if (match == null) return null;

    final lat = double.tryParse(match.group(1)!);
    final lng = double.tryParse(match.group(2)!);

    if (lat == null || lng == null) return null;
    return (lat, lng);
  }

  void _snack(String msg) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  void _resetForm() {
    setState(() {
      _selectedType = null;
      _targetMode = _TargetMode.registeredSenior;
      _descCtrl.clear();
      _locationCtrl.clear();
      _searchCtrl.clear();
      _otherNameCtrl.clear();
      _otherAgeCtrl.clear();
      _otherPhoneCtrl.clear();
      _otherGender = '여성';
      _selectedLocationLatitude = null;
      _selectedLocationLongitude = null;
      _searchResults = [];
      _photos.clear();
      _consentGiven = false;
      _incidentTime = DateTime.now();
      _locationMode = _LocationMode.lastKnown;

      if (_seniors.isNotEmpty) {
        _selectedSenior = _seniors.first;
        _applyLastKnownLocation(_seniors.first);
        _loadZoneStatus(_seniors.first);
      }
    });
  }

  Future<void> _showCompletedDialog() async {
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return Dialog(
          backgroundColor: Colors.white,
          surfaceTintColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  '신고 접수 완료',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: _kTextMain,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  '신고가 정상적으로 접수되었습니다.\n얼굴 확인 대상에도 반영됩니다.',
                  style: TextStyle(fontSize: 13, color: _kTextSub),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: _kGreen,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    onPressed: () {
                      Navigator.pop(dialogContext);
                      _resetForm();
                      widget.onCompleted?.call();
                    },
                    child: const Text('확인', style: TextStyle(fontSize: 13)),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Material(
      color: _kBg,
      child: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // ① 사용자 선택 + 요약 카드
                  _buildSeniorSection(),
                  const SizedBox(height: 14),

                  // ② 신고 유형
                  _sectionLabel('신고 유형', required: true),
                  const SizedBox(height: 6),
                  _buildTypeDropdown(),
                  const SizedBox(height: 14),

                  if (_targetMode == _TargetMode.otherPerson) ...[
                    // ③ 마지막 위치
                    _sectionLabel('마지막 위치', required: true),
                    const SizedBox(height: 6),
                    _buildLocationSection(),
                    const SizedBox(height: 14),

                    // ④ 마지막 목격 시간
                    _buildCompactTimePicker(),
                    const SizedBox(height: 14),
                  ] else ...[
                    // ③ 발생 시간
                    _sectionLabel('발생 시간'),
                    const SizedBox(height: 6),
                    _buildTimePicker(),
                    const SizedBox(height: 14),

                    // ④ 발생 장소
                    _sectionLabel('발생 장소'),
                    const SizedBox(height: 6),
                    _buildLocationSection(),
                    const SizedBox(height: 14),
                  ],

                  // ⑤ 상황 설명
                  _sectionLabel('상황 설명'),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _descCtrl,
                    maxLines: 4,
                    style: const TextStyle(fontSize: 14, color: _kTextMain),
                    decoration: _inputDeco(
                      '착의, 마지막 연락, 주변 상황, 특이사항 등을 자세히 입력하면 신고 처리에 도움이 됩니다.',
                    ),
                  ),
                  const SizedBox(height: 14),

                  // ⑥ 사진 첨부
                  _sectionLabel('사진 첨부  (선택, ${_photos.length}/4장)'),
                  const SizedBox(height: 6),
                  _buildPhotoSection(),
                  const SizedBox(height: 12),
                  _buildConsentSection(),
                  const SizedBox(height: 18),
                ],
              ),
            ),
          ),
          _buildBottomBar(),
        ],
      ),
    );
  }

  // ── 사용자 선택 ────────────────────────────────────────────────────────────

  Widget _buildSeniorSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const Text(
              '신고 대상자',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _kTextMain,
              ),
            ),
            const SizedBox(width: 3),
            const Text('*', style: TextStyle(fontSize: 13, color: _kRed)),
            const Spacer(),
            GestureDetector(
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ReportHistoryScreen()),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '내역 보기',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: _kTextSub,
                    ),
                  ),
                  SizedBox(width: 1),
                  Icon(Icons.chevron_right, size: 14, color: _kTextHint),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        Row(
          children: [
            _TargetModeChip(
              label: '등록된 대상자',
              icon: Icons.person_outline,
              selected: _targetMode == _TargetMode.registeredSenior,
              onTap: () {
                setState(() {
                  _targetMode = _TargetMode.registeredSenior;
                  _selectedType = null;
                  _locationMode = _LocationMode.lastKnown;
                  _locationCtrl.clear();
                  _searchCtrl.clear();
                  _searchResults = [];
                  _selectedLocationLatitude = null;
                  _selectedLocationLongitude = null;

                  if (_selectedSenior != null) {
                    _applyLastKnownLocation(_selectedSenior!);
                  }
                });
              },
            ),
            const SizedBox(width: 8),
            _TargetModeChip(
              label: '직접 입력',
              icon: Icons.edit_outlined,
              selected: _targetMode == _TargetMode.otherPerson,
              onTap: () {
                setState(() {
                  _targetMode = _TargetMode.otherPerson;
                  _selectedType = null;
                  _locationMode = _LocationMode.search;
                  _locationCtrl.clear();
                  _searchCtrl.clear();
                  _searchResults = [];
                  _selectedLocationLatitude = null;
                  _selectedLocationLongitude = null;
                });
              },
            ),
          ],
        ),

        const SizedBox(height: 10),

        if (_targetMode == _TargetMode.registeredSenior) ...[
          if (_seniorsLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(8),
                child: CircularProgressIndicator(
                  color: _kGreen,
                  strokeWidth: 2,
                ),
              ),
            )
          else if (_seniors.isEmpty)
            const Text(
              '등록된 대상자가 없습니다.',
              style: TextStyle(fontSize: 13, color: _kTextHint),
            )
          else
            _buildDropdown<Senior>(
              value: _selectedSenior,
              hint: '대상자를 선택하세요',
              items: _seniors,
              itemLabel: (s) => s.name,
              onChanged: (v) {
                setState(() {
                  _selectedSenior = v;

                  if (v != null) {
                    _applyLastKnownLocation(v);
                    _loadZoneStatus(v);
                  }
                });
              },
            ),

          if (_selectedSenior != null) ...[
            const SizedBox(height: 8),
            _SeniorCard(senior: _selectedSenior!, statusOverride: _zoneStatusBadge)
          ],
        ] else ...[
          Row(
            children: [
              Expanded(
                flex: 3,
                child: TextField(
                  controller: _otherNameCtrl,
                  style: const TextStyle(fontSize: 14, color: _kTextMain),
                  decoration: _inputDeco('이름 *'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                flex: 1,
                child: TextField(
                  controller: _otherAgeCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(fontSize: 14, color: _kTextMain),
                  decoration: _inputDeco('나이 *'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                flex: 3,
                child: TextField(
                  controller: _otherPhoneCtrl,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [PhoneNumberInputFormatter()],
                  style: const TextStyle(fontSize: 14, color: _kTextMain),
                  decoration: _inputDeco('연락처 *'),
                  onChanged: (_) => setState(() {}),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(flex: 2, child: _buildGenderDropdown()),
            ],
          ),
        ],
      ],
    );
  }

  // ── 성별 드롭다운 ─────────────────────────────────────────────────────────
  Widget _buildGenderDropdown() {
    return DropdownButtonFormField<String>(
      value: _otherGender,
      decoration: InputDecoration(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _kDivider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _kDivider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _kGreen, width: 1.5),
        ),
        filled: true,
        fillColor: Colors.white,
      ),
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down, color: _kTextSub),
      dropdownColor: Colors.white,
      borderRadius: BorderRadius.circular(12),
      items: _kGenderOptions.map((gender) {
        return DropdownMenuItem<String>(
          value: gender,
          child: Text(
            gender,
            style: const TextStyle(fontSize: 14, color: _kTextMain),
          ),
        );
      }).toList(),
      onChanged: (value) {
        if (value == null) return;

        setState(() {
          _otherGender = value;
        });
      },
    );
  }

  // ── 신고 유형 드롭다운 ──────────────────────────────────────────────────────

  Widget _buildTypeDropdown() {
    final types = _targetMode == _TargetMode.registeredSenior
        ? _kReportTypesRegistered
        : _kReportTypesOther;
    return _buildDropdown<_ReportType>(
      value: types.contains(_selectedType) ? _selectedType : null,
      hint: '신고 유형을 선택하세요',
      items: types,
      itemLabel: (t) => t.label,
      leading: (t) => Icon(t.icon, size: 16, color: _kTextSub),
      onChanged: (v) => setState(() => _selectedType = v),
    );
  }

  // ── 발생 시간 카드 ─────────────────────────────────────────────────────────

  Widget _buildTimePicker() {
    return GestureDetector(
      onTap: _pickTime,
      child: Container(
        decoration: _cardDeco(),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: _kSafeBg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(
                Icons.access_time_outlined,
                size: 16,
                color: _kSafe,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '발생 시간',
                    style: TextStyle(fontSize: 11, color: _kTextHint),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatDateTime(_incidentTime),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: _kTextMain,
                    ),
                  ),
                ],
              ),
            ),
            const Text(
              '변경',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _kSafe,
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── 마지막 목격 시간 ─────────────────────────────────────────
  Widget _buildCompactTimePicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('마지막 목격 시간'),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: _pickTime,
          child: Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: _cardDeco(),
            child: Row(
              children: [
                const Icon(Icons.access_time_outlined, size: 16, color: _kSafe),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _formatDateTime(_incidentTime),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: _kTextMain,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── 옷차림 입력 ─────────────────────────────────────────────────────────
  Widget _buildClothesInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _sectionLabel('옷차림'),
        const SizedBox(height: 6),
        SizedBox(
          height: 48,
          child: TextField(
            controller: _otherClothesCtrl,
            style: const TextStyle(fontSize: 13, color: _kTextMain),
            decoration: _inputDeco('예: 회색 점퍼'),
            onChanged: (_) => setState(() {}),
          ),
        ),
      ],
    );
  }

  // ── 발생 장소 ──────────────────────────────────────────────────────────────

  Widget _buildLocationSection() {
    final isDirectInput = _targetMode == _TargetMode.otherPerson;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            if (!isDirectInput) ...[
              _LocationChip(
                icon: Icons.person_pin_circle_outlined,
                label: '마지막 위치',
                selected: _locationMode == _LocationMode.lastKnown,
                onTap: () => _onLocationModeChanged(_LocationMode.lastKnown),
              ),
              const SizedBox(width: 8),
            ],
            _LocationChip(
              icon: Icons.map_outlined,
              label: '카카오맵 선택',
              selected: _locationMode == _LocationMode.mapPick,
              onTap: () => _onLocationModeChanged(_LocationMode.mapPick),
            ),
            const SizedBox(width: 8),
            _LocationChip(
              icon: Icons.search,
              label: '카카오 검색',
              selected: _locationMode == _LocationMode.search,
              onTap: () => _onLocationModeChanged(_LocationMode.search),
            ),
          ],
        ),
        const SizedBox(height: 8),

        if (_locationMode != _LocationMode.search)
          TextField(
            controller: _locationCtrl,
            readOnly: true,
            style: const TextStyle(fontSize: 14, color: _kTextMain),
            decoration: _inputDeco(
              isDirectInput ? '마지막 위치를 선택하세요' : '위치를 선택하면 여기에 표시됩니다',
            ).copyWith(fillColor: const Color(0xFFF8F8F8)),
          ),

        if (_locationMode == _LocationMode.search) ...[
          TextField(
            controller: _searchCtrl,
            style: const TextStyle(fontSize: 14, color: _kTextMain),
            decoration: _inputDeco('장소명 또는 주소를 입력하세요').copyWith(
              prefixIcon: const Icon(Icons.search, size: 18, color: _kTextHint),
              suffixIcon: _searchLoading
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: _kGreen,
                        ),
                      ),
                    )
                  : null,
            ),
            onChanged: (v) {
              _searchDebounce?.cancel();

              if (v.trim().length < 2) {
                setState(() => _searchResults = []);
                return;
              }

              _searchDebounce = Timer(
                const Duration(milliseconds: 500),
                () async {
                  setState(() => _searchLoading = true);

                  final results = await _searchKakaoPlaces(v.trim());

                  if (mounted) {
                    setState(() {
                      _searchResults = results;
                      _searchLoading = false;
                    });
                  }
                },
              );
            },
          ),

          if (_searchResults.isNotEmpty) ...[
            const SizedBox(height: 4),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kDivider),
              ),
              child: Column(
                children: [
                  for (var i = 0; i < _searchResults.length; i++) ...[
                    if (i > 0) const Divider(height: 1, color: _kDivider),
                    InkWell(
                      onTap: () => setState(() {
                        final selected = _searchResults[i];

                        _locationCtrl.text = selected.displayName;
                        _selectedLocationLatitude = selected.lat;
                        _selectedLocationLongitude = selected.lng;
                        _locationMode = _LocationMode.search;
                        _searchResults = [];
                        _searchCtrl.clear();
                      }),
                      borderRadius: i == 0
                          ? const BorderRadius.vertical(
                              top: Radius.circular(10),
                            )
                          : i == _searchResults.length - 1
                          ? const BorderRadius.vertical(
                              bottom: Radius.circular(10),
                            )
                          : BorderRadius.zero,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.location_on_outlined,
                              size: 14,
                              color: _kTextHint,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  if (_searchResults[i].name.isNotEmpty)
                                    Text(
                                      _searchResults[i].name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        color: _kTextMain,
                                      ),
                                    ),
                                  if (_searchResults[i].address.isNotEmpty)
                                    Text(
                                      _searchResults[i].address,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: _kTextSub,
                                        height: 1.5,
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],

          if (_locationCtrl.text.isNotEmpty &&
              _searchResults.isEmpty &&
              _searchCtrl.text.isEmpty) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: _kSafeBg,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kGreen.withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.check_circle_outline,
                    size: 14,
                    color: _kSafe,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _locationCtrl.text,
                      style: const TextStyle(fontSize: 12, color: _kSafe),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ],
    );
  }

  // ── 사진 첨부 ──────────────────────────────────────────────────────────────

  Widget _buildPhotoSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 썸네일 목록
        if (_photos.isNotEmpty) ...[
          SizedBox(
            height: 80,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _photos.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => _PhotoSlot(
                file: File(_photos[i].path),
                onRemove: () => _removePhoto(i),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
        // 사진 추가 버튼
        if (_photos.length < 4)
          GestureDetector(
            onTap: _addPhoto,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _kDivider),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.camera_alt_outlined, size: 18, color: _kTextHint),
                  SizedBox(width: 8),
                  Text(
                    '사진 추가',
                    style: TextStyle(fontSize: 13, color: _kTextSub),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  // ── 개인정보 동의 ─────────────────────────────────────────────────────────

  Widget _buildConsentSection() {
    return GestureDetector(
      onTap: () => setState(() => _consentGiven = !_consentGiven),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 20,
            height: 20,
            child: Checkbox(
              value: _consentGiven,
              onChanged: (v) => setState(() => _consentGiven = v ?? false),
              fillColor: WidgetStateProperty.resolveWith(
                (states) => states.contains(WidgetState.selected)
                    ? Colors.white
                    : Colors.white,
              ),
              checkColor: _kRed,
              side: WidgetStateBorderSide.resolveWith(
                (states) => BorderSide(
                  color: states.contains(WidgetState.selected)
                      ? _kRed
                      : const Color(0xFFBBBBBB),
                  width: 1.5,
                ),
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(4),
              ),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: const TextSpan(
                style: TextStyle(fontSize: 12, color: _kTextSub, height: 1.5),
                children: [
                  TextSpan(text: '신고 처리를 위해 '),
                  TextSpan(
                    text: '개인정보(이름, 연락처, 위치정보)',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: _kTextMain,
                    ),
                  ),
                  TextSpan(
                    text: '를 수집·이용하는 것에 동의합니다. 수집된 정보는 신고 처리 목적으로만 사용됩니다.',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── 하단 버튼 ─────────────────────────────────────────────────────────────

  Widget _buildBottomBar() {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(
        16,
        10,
        16,
        MediaQuery.of(context).padding.bottom + 14,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: double.infinity,
            height: 50,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: _canSubmit ? _kRed : const Color(0xFFCCCCCC),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                elevation: _canSubmit ? 1 : 0,
              ),
              onPressed: (_submitting || !_canSubmit) ? null : _submit,
              child: _submitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.campaign_outlined,
                          size: 18,
                          color: _canSubmit
                              ? Colors.white
                              : const Color(0xFF999999),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          '신고 접수하기',
                          style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: _canSubmit
                                ? Colors.white
                                : const Color(0xFF999999),
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ── 공통 헬퍼 ─────────────────────────────────────────────────────────────

  Widget _sectionLabel(String text, {bool required = false}) {
    return Row(
      children: [
        Text(
          text,
          style: const TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: _kTextMain,
          ),
        ),
        if (required) ...[
          const SizedBox(width: 3),
          const Text('*', style: TextStyle(fontSize: 13, color: _kRed)),
        ],
      ],
    );
  }

  Widget _buildDropdown<T>({
    required T? value,
    required String hint,
    required List<T> items,
    required String Function(T) itemLabel,
    Widget Function(T)? leading,
    required void Function(T?) onChanged,
  }) {
    return DropdownButtonFormField<T>(
      value: value,
      selectedItemBuilder: (context) => items
          .map(
            (item) => Align(
              alignment: Alignment.centerLeft,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (leading != null) ...[
                    leading(item),
                    const SizedBox(width: 8),
                  ],
                  Text(
                    itemLabel(item),
                    style: const TextStyle(fontSize: 14, color: _kTextMain),
                  ),
                ],
              ),
            ),
          )
          .toList(),
      decoration: InputDecoration(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _kDivider),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _kDivider),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: _kGreen, width: 1.5),
        ),
        filled: true,
        fillColor: Colors.white,
      ),
      hint: Text(hint, style: const TextStyle(fontSize: 14, color: _kTextHint)),
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down, color: _kTextSub),
      dropdownColor: Colors.white,
      borderRadius: BorderRadius.circular(12),
      menuMaxHeight: 280,
      itemHeight: 48,
      items: items.map((item) {
        return DropdownMenuItem<T>(
          value: item,
          child: Row(
            children: [
              if (leading != null) ...[
                leading(item),
                const SizedBox(width: 10),
              ],
              Text(
                itemLabel(item),
                style: const TextStyle(fontSize: 14, color: _kTextMain),
              ),
            ],
          ),
        );
      }).toList(),
      onChanged: onChanged,
    );
  }

  static BoxDecoration _cardDeco() => BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(10),
    border: Border.all(color: _kDivider),
  );

  static InputDecoration _inputDeco(String hint) => InputDecoration(
    hintText: hint,
    hintStyle: const TextStyle(fontSize: 13, color: _kTextHint, height: 1.5),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _kDivider),
    ),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _kDivider),
    ),
    focusedBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: const BorderSide(color: _kGreen, width: 1.5),
    ),
    filled: true,
    fillColor: Colors.white,
    contentPadding: const EdgeInsets.all(12),
  );
}

// ── 위치 모드 선택 칩 ─────────────────────────────────────────────────────────
class _TargetModeChip extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const _TargetModeChip({
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final textColor = selected ? _kSafe : _kTextSub;
    final bgColor = selected ? _kSafeBg : Colors.white;
    final borderColor = selected ? _kGreen : _kDivider;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: borderColor, width: selected ? 1.3 : 1),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: textColor),
            const SizedBox(width: 5),
            Text(
              label,
              strutStyle: const StrutStyle(
                fontSize: 13,
                height: 1.0,
                forceStrutHeight: true,
              ),
              style: TextStyle(
                fontSize: 13,
                height: 1.0,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                color: textColor,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── 사용자 요약 카드 ──────────────────────────────────────────────────────────

class _SeniorCard extends StatelessWidget {
  final Senior senior;
  final String? statusOverride; // 안전구역 기준 상태 (안전/이탈)
  const _SeniorCard({required this.senior, this.statusOverride});

  @override
  Widget build(BuildContext context) {
    final statusText = statusOverride ?? senior.status;
    final isSafe = statusText == '안전';
    final statusColor = isSafe ? _kSafe : _kWarn;
    final statusBg = isSafe ? _kSafeBg : _kWarnBg;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _kDivider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: statusBg,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.person, size: 18, color: statusColor),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  senior.name,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: _kTextMain,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                // 점과 글자를 Row 중앙 정렬로 같은 높이에 맞춘다.
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: statusColor,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      senior.status,
                      style: TextStyle(
                        fontSize: 11,
                        height: 1.0,
                        fontWeight: FontWeight.w600,
                        color: statusColor,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Divider(height: 1, color: _kDivider),
          const SizedBox(height: 8),
          _Row(
            icon: Icons.location_on_outlined,
            label: '마지막 위치',
            value: senior.lastLocationAddress,
          ),
          const SizedBox(height: 4),
          _Row(
            icon: Icons.access_time_outlined,
            label: '마지막 확인',
            value:
                senior.lastLocationTime.isEmpty ||
                    senior.lastLocationTime == '-'
                ? '정보 없음'
                : senior.lastLocationTime,
          ),
        ],
      ),
    );
  }
}

class _KakaoMapDisabledView extends StatelessWidget {
  const _KakaoMapDisabledView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.all(24),
        child: Text(
          '에뮬레이터에서는 카카오맵을 비활성화했습니다.\n실제 기기에서 지도를 확인해주세요.',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Color(0xFF6C6C70),
            fontSize: 14,
            height: 1.5,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _Row({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 12, color: _kTextHint),
      const SizedBox(width: 5),
      SizedBox(
        width: 60,
        child: Text(
          label,
          style: const TextStyle(fontSize: 11, color: _kTextSub),
        ),
      ),
      Expanded(
        child: Text(
          value,
          style: const TextStyle(fontSize: 11, color: _kTextMain),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    ],
  );
}

// ── 발생 장소 선택 칩 ─────────────────────────────────────────────────────────

class _LocationChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const _LocationChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) => Expanded(
    child: GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: selected ? _kSafeBg : Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: selected ? _kGreen : _kDivider, width: 1.2),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: selected ? _kSafe : _kTextHint),
            const SizedBox(height: 3),
            Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10,
                fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                color: selected ? _kSafe : _kTextSub,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

// ── 신고 대상 선택 카드 ─────────────────────────────────────────────────────────
class _TargetChoiceCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String description;
  final bool selected;
  final VoidCallback onTap;

  const _TargetChoiceCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: selected ? _kSafeBg : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected ? _kGreen : _kDivider,
              width: selected ? 1.4 : 1,
            ),
            boxShadow: [
              if (selected)
                BoxShadow(
                  color: _kGreen.withValues(alpha: 0.14),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: selected ? Colors.white : const Color(0xFFF7F8F3),
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Icon(
                      icon,
                      size: 17,
                      color: selected ? _kSafe : _kTextSub,
                    ),
                  ),
                  const Spacer(),
                  AnimatedOpacity(
                    duration: const Duration(milliseconds: 120),
                    opacity: selected ? 1 : 0,
                    child: Container(
                      width: 20,
                      height: 20,
                      decoration: const BoxDecoration(
                        color: _kSafe,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check,
                        size: 13,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                title,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: selected ? _kSafe : _kTextMain,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                description,
                style: TextStyle(
                  fontSize: 11,
                  height: 1.3,
                  color: selected ? _kSafe : _kTextHint,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── 사진 슬롯 ─────────────────────────────────────────────────────────────────

class _PhotoSlot extends StatelessWidget {
  final File file;
  final VoidCallback onRemove;
  const _PhotoSlot({required this.file, required this.onRemove});

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.file(file, width: 80, height: 80, fit: BoxFit.cover),
      ),
      Positioned(
        top: 2,
        right: 2,
        child: GestureDetector(
          onTap: onRemove,
          child: Container(
            width: 20,
            height: 20,
            decoration: const BoxDecoration(
              color: Colors.black54,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.close, size: 13, color: Colors.white),
          ),
        ),
      ),
    ],
  );
}

// ── 헬퍼 함수 ─────────────────────────────────────────────────────────────────

String _formatDateTime(DateTime dt) {
  final p = (int n) => n.toString().padLeft(2, '0');
  return '${dt.year}-${p(dt.month)}-${p(dt.day)} ${p(dt.hour)}:${p(dt.minute)}';
}

// ── 카카오맵 장소 검색 및 역지오코딩 ─────────────────────────────────────────
class _KakaoPlaceResult {
  final String name;
  final String address;
  final double lat;
  final double lng;

  const _KakaoPlaceResult({
    required this.name,
    required this.address,
    required this.lat,
    required this.lng,
  });

  String get displayName => name.isNotEmpty
      ? (address.isNotEmpty ? '$name, $address' : name)
      : address;
}

Future<List<_KakaoPlaceResult>> _searchKakaoPlaces(String query) async {
  final restKey = AppConfig.kakaoRestApiKey;

  if (restKey.isEmpty) {
    return [];
  }

  Future<List<_KakaoPlaceResult>> requestKakao(String path) async {
    final url = Uri.https('dapi.kakao.com', path, {
      'query': query,
      'size': '10',
    });

    final res = await http
        .get(url, headers: {'Authorization': 'KakaoAK $restKey'})
        .timeout(const Duration(seconds: 8));

    if (res.statusCode != 200) return [];

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final documents = data['documents'];

    if (documents is! List) return [];

    return documents
        .map((item) {
          if (item is! Map<String, dynamic>) return null;

          final x = double.tryParse(item['x']?.toString() ?? '');
          final y = double.tryParse(item['y']?.toString() ?? '');

          if (x == null || y == null) return null;

          final placeName = item['place_name']?.toString().trim() ?? '';
          final roadAddress =
              item['road_address_name']?.toString().trim() ?? '';
          final address = item['address_name']?.toString().trim() ?? '';

          if (placeName.isEmpty && roadAddress.isEmpty && address.isEmpty)
            return null;

          return _KakaoPlaceResult(
            name: placeName,
            address: roadAddress.isNotEmpty ? roadAddress : address,
            lat: y,
            lng: x,
          );
        })
        .whereType<_KakaoPlaceResult>()
        .toList();
  }

  try {
    final keywordResults = await requestKakao('/v2/local/search/keyword.json');

    if (keywordResults.isNotEmpty) {
      return keywordResults;
    }

    return await requestKakao('/v2/local/search/address.json');
  } catch (_) {
    return [];
  }
}

Future<String> _reverseGeocodeKakao(kakao.LatLng point) async {
  final restKey = AppConfig.kakaoRestApiKey;

  if (restKey.isEmpty) return '';

  try {
    final url =
        Uri.https('dapi.kakao.com', '/v2/local/geo/coord2address.json', {
          'x': point.longitude.toString(),
          'y': point.latitude.toString(),
          'input_coord': 'WGS84',
        });

    final res = await http
        .get(url, headers: {'Authorization': 'KakaoAK $restKey'})
        .timeout(const Duration(seconds: 6));

    if (res.statusCode != 200) return '';

    final data = jsonDecode(res.body) as Map<String, dynamic>;
    final documents = data['documents'];

    if (documents is! List || documents.isEmpty) return '';

    final first = documents.first;

    if (first is! Map<String, dynamic>) return '';

    final roadAddress = first['road_address'];
    final address = first['address'];

    if (roadAddress is Map<String, dynamic>) {
      final value = roadAddress['address_name']?.toString().trim() ?? '';

      if (value.isNotEmpty) return value;
    }

    if (address is Map<String, dynamic>) {
      return address['address_name']?.toString().trim() ?? '';
    }

    return '';
  } catch (_) {
    return '';
  }
}

// ── 지도 선택 결과 ─────────────────────────────────────────────────────────────

class _MapPickResult {
  final kakao.LatLng point;
  final String address;
  const _MapPickResult({required this.point, required this.address});
}

// ── 지도에서 위치 선택 화면 ────────────────────────────────────────────────────

class _ReportMapPickScreen extends StatefulWidget {
  final kakao.LatLng initial;
  const _ReportMapPickScreen({required this.initial});

  @override
  State<_ReportMapPickScreen> createState() => _ReportMapPickScreenState();
}

class _ReportMapPickScreenState extends State<_ReportMapPickScreen> {
  late kakao.LatLng _picked;
  kakao.KakaoMapController? _controller;
  kakao.Poi? _pickedPoi;
  bool _geocoding = false;
  String _address = '';

  @override
  void initState() {
    super.initState();
    _picked = widget.initial;
  }

  Future<void> _renderPickedPoi() async {
    final controller = _controller;
    if (controller == null) return;
    if (_pickedPoi != null) {
      await _pickedPoi!.remove();
      _pickedPoi = null;
    }
    _pickedPoi = await controller.labelLayer.addPoi(
      _picked,
      style: kakao.PoiStyle(),
    );
  }

  Future<void> _onTap(kakao.LatLng point) async {
    setState(() {
      _picked = point;
      _address = '';
      _geocoding = true;
    });

    await _renderPickedPoi();

    final address = await _reverseGeocodeKakao(point);

    if (mounted) {
      setState(() {
        _address = address;
        _geocoding = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('위치 선택'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(
              context,
              _MapPickResult(point: _picked, address: _address),
            ),
            child: const Text(
              '확인',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 15,
              ),
            ),
          ),
        ],
      ),
      body: _disableKakaoMap
          ? const _KakaoMapDisabledView()
          : Stack(
              children: [
                kakao.KakaoMap(
                  option: kakao.KakaoMapOption(
                    position: _picked,
                    zoomLevel: 15,
                  ),
                  onMapReady: (controller) {
                    _controller = controller;
                    _renderPickedPoi();
                  },
                  onMapClick: (_, position) => _onTap(position),
                ),

                // 하단 안내 박스
                Positioned(
                  bottom: 16,
                  left: 16,
                  right: 16,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: const [
                        BoxShadow(color: Colors.black12, blurRadius: 6),
                      ],
                    ),
                    child: _geocoding
                        ? const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: _kGreen,
                                ),
                              ),
                              SizedBox(width: 10),
                              Text(
                                '주소 조회 중...',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: _kTextSub,
                                ),
                              ),
                            ],
                          )
                        : Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                '지도를 탭하여 위치를 선택하세요',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: _kTextHint,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _address.isNotEmpty
                                    ? _address
                                    : '${_picked.latitude.toStringAsFixed(5)}, '
                                          '${_picked.longitude.toStringAsFixed(5)}',
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: _kTextMain,
                                  height: 1.4,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                  ),
                ),
              ],
            ),
    );
  }
}

// ── 신고 내역 화면 ─────────────────────────────────────────────────────────────

class ReportHistoryScreen extends StatefulWidget {
  const ReportHistoryScreen({super.key});

  @override
  State<ReportHistoryScreen> createState() => _ReportHistoryScreenState();
}

class _ReportHistoryScreenState extends State<ReportHistoryScreen> {
  final _sessionStorage = GuardianSessionStorage();

  bool _isLoading = true;
  String? _errorMessage;
  List<Map<String, dynamic>> _reports = [];
  List<Map<String, dynamic>> _allActiveReports = [];
  String? _myGuardianId;
  int _selectedScope = 0; // 0=전체 실종자, 1=내 신고, 2=다른 보호자 신고
  int _selectedTab = 0; // 내 신고 내 필터: 0=전체, 1=접수 완료, 2=취소

  List<Map<String, dynamic>> get _filteredReports {
    // 전체 실종자 — 모든 보호자의 ACTIVE 신고
    if (_selectedScope == 0) {
      return _allActiveReports;
    }

    // 다른 보호자가 접수한 신고만
    if (_selectedScope == 2) {
      return _allActiveReports
          .where((r) => r['guardianId']?.toString() != _myGuardianId)
          .toList();
    }

    if (_selectedTab == 1) {
      return _reports.where((r) {
        final s = r['status']?.toString() ?? '';
        return s != 'CANCELLED' && s != 'CANCELED';
      }).toList();
    }
    if (_selectedTab == 2) {
      return _reports.where((r) {
        final s = r['status']?.toString() ?? '';
        return s == 'CANCELLED' || s == 'CANCELED';
      }).toList();
    }
    return _reports;
  }

  @override
  void initState() {
    super.initState();
    _loadReports();
  }

  Future<void> _loadReports() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final info = await _sessionStorage.getGuardianInfo();
      final guardianId = info['guardianId'];
      if (guardianId == null || guardianId.isEmpty) {
        throw Exception('로그인 정보가 없습니다.');
      }

      final url = Uri.parse(
        '${AppConfig.apiBaseUrl}/missing-reports/guardian/$guardianId',
      );
      final res = await http.get(url).timeout(const Duration(seconds: 15));

      if (res.statusCode != 200) {
        throw Exception('신고 내역을 불러오지 못했습니다. (${res.statusCode})');
      }

      final body = jsonDecode(utf8.decode(res.bodyBytes));
      final list = body is List
          ? body
          : (body['content'] ?? body['data'] ?? body['reports'] ?? []) as List;

      // 전체 실종자 목록 (모든 보호자의 ACTIVE 신고) — 실패해도 내 신고는 보여준다.
      var activeReports = <Map<String, dynamic>>[];
      try {
        final activeRes = await http
            .get(Uri.parse('${AppConfig.apiBaseUrl}/missing-reports/active'))
            .timeout(const Duration(seconds: 15));
        if (activeRes.statusCode == 200) {
          final activeBody = jsonDecode(utf8.decode(activeRes.bodyBytes));
          if (activeBody is List) {
            activeReports = activeBody.cast<Map<String, dynamic>>();
          }
        }
      } catch (_) {}

      if (!mounted) return;
      setState(() {
        _myGuardianId = guardianId;
        _reports = list.cast<Map<String, dynamic>>();
        _allActiveReports = activeReports;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('신고 내역'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildScopeChip(int index, String label) {
    final selected = _selectedScope == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedScope = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? _kGreen : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? _kGreen : _kDivider),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : _kTextSub,
          ),
        ),
      ),
    );
  }

  Widget _buildTabChip(int index, String label) {
    final selected = _selectedTab == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedTab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? _kGreen : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? _kGreen : _kDivider),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : _kTextSub,
          ),
        ),
      ),
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
              const Icon(Icons.error_outline, size: 40, color: _kRed),
              const SizedBox(height: 12),
              Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, color: _kRed),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _loadReports,
                style: FilledButton.styleFrom(backgroundColor: _kGreen),
                child: const Text('다시 시도'),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        // 범위 선택: 전체 실종자(모든 보호자의 신고) / 내 신고
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              _buildScopeChip(0, '전체 실종자'),
              const SizedBox(width: 8),
              _buildScopeChip(1, '내 신고'),
              const SizedBox(width: 8),
              _buildScopeChip(2, '다른 보호자'),
            ],
          ),
        ),
        // 내 신고일 때만 상태 필터 표시
        if (_selectedScope == 1) ...[
          const SizedBox(height: 8),
          Container(
            color: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _buildTabChip(0, '전체'),
                const SizedBox(width: 8),
                _buildTabChip(1, '접수 완료'),
                const SizedBox(width: 8),
                _buildTabChip(2, '취소'),
              ],
            ),
          ),
        ],
        const SizedBox(height: 4),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadReports,
            color: _kGreen,
            child: _filteredReports.isEmpty
                ? ListView(
                    children: [
                      const SizedBox(height: 120),
                      Icon(
                        _selectedScope == 0
                            ? Icons.person_search_outlined
                            : Icons.campaign_outlined,
                        size: 48,
                        color: _kTextHint,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        _selectedScope == 0
                            ? '현재 신고된 실종자가 없습니다.'
                            : '해당 내역이 없습니다.',
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 15, color: _kTextSub),
                      ),
                    ],
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                    itemCount: _filteredReports.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final report = _filteredReports[i];
                      // 신고 취소는 내가 접수한 신고만 가능
                      final isMine =
                          report['guardianId']?.toString() == _myGuardianId;
                      return _ReportHistoryCard(
                        report: report,
                        canCancel: isMine,
                        onCancelled: _loadReports,
                      );
                    },
                  ),
          ),
        ),
      ],
    );
  }
}

// ── 신고 내역 카드 ─────────────────────────────────────────────────────────────

class _ReportHistoryCard extends StatelessWidget {
  final Map<String, dynamic> report;
  final VoidCallback? onCancelled;

  /// 신고 취소 가능 여부 — 내가 접수한 신고만 true
  final bool canCancel;

  const _ReportHistoryCard({
    required this.report,
    this.onCancelled,
    this.canCancel = true,
  });

  String get _typeLabel {
    final type =
        report['reportType']?.toString() ?? report['type']?.toString() ?? '';
    const map = {
      'missing': '실종 신고',
      'danger': '위험 상황 신고',
      'zone': '위치 이탈',
      'fall': '낙상 의심',
    };
    return map[type] ?? (type.isNotEmpty ? type : '신고');
  }

  String get _statusLabel {
    final s = report['status']?.toString() ?? '';
    const map = {
      // 'PENDING': '접수 완료',
      // 'ACTIVE': '처리 중',
      // 'IN_PROGRESS': '처리 중',
      // 'RESOLVED': '처리 완료',
      // 'CLOSED': '종료',
      'CANCELED': '취소',
      'CANCELLED': '취소',
    };
    return map[s] ?? '접수 완료';
  }

  Color get _statusColor {
    final s = report['status']?.toString() ?? '';
    if (s == 'CANCELED' || s == 'CANCELLED') return _kTextHint;
    return _kTextSub; // 접수 완료 → 회색
  }

  String get _dateLabel {
    final raw =
        report['createdAt']?.toString() ??
        report['reportedAt']?.toString() ??
        '';
    if (raw.length >= 16) return raw.substring(0, 16).replaceAll('T', ' ');
    return raw;
  }

  // description에서 '대상자 이름: ...' 파싱
  String _nameFromDescription(String desc) {
    final match = RegExp(r'대상자 이름:\s*(.+)').firstMatch(desc);
    return match?.group(1)?.trim() ?? '';
  }

  void _showDetail(BuildContext context) {
    final description = report['description']?.toString() ?? '';
    final location = report['lastSeenAddress']?.toString() ?? '';
    // apiBaseUrl에서 /api 제거
    final baseUrl = AppConfig.apiBaseUrl.replaceAll(RegExp(r'/api$'), '');

    final imageUrlRaw = report['imageUrl']?.toString() ?? '';
    final imageUrlsRaw = report['imageUrls'];

    List<String> imageUrls = [];

    if (imageUrlsRaw is List) {
      imageUrls = imageUrlsRaw
          .whereType<String>()
          .where((s) => s.isNotEmpty)
          .map((s) => s.startsWith('http') ? s : '$baseUrl$s')
          .toList();
    }

    if (imageUrls.isEmpty && imageUrlRaw.isNotEmpty) {
      final imageUrl = imageUrlRaw.startsWith('http')
          ? imageUrlRaw
          : '$baseUrl$imageUrlRaw';
      imageUrls = [imageUrl];
    }

    final seniorName =
        report['seniorName']?.toString() ??
        report['targetName']?.toString() ??
        _nameFromDescription(description);

    // description을 구조화: "키: 값" → 행, 빈 줄 이후는 메모
    final lines = description.split('\n');
    final List<MapEntry<String, String>> infoRows = [];
    final List<String> memoLines = [];
    bool inMemo = false;

    for (final line in lines) {
      if (line.trim().isEmpty) {
        inMemo = true;
        continue;
      }
      if (!inMemo) {
        final idx = line.indexOf(': ');
        if (idx > 0) {
          infoRows.add(
            MapEntry(line.substring(0, idx), line.substring(idx + 2)),
          );
        } else {
          memoLines.add(line);
        }
      } else {
        memoLines.add(line);
      }
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        minChildSize: 0.4,
        maxChildSize: 0.92,
        builder: (_, scrollCtrl) => ListView(
          controller: scrollCtrl,
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
          children: [
            // 드래그 핸들
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 20),
                decoration: BoxDecoration(
                  color: _kDivider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),

            // 신고 유형 + 상태
            Row(
              children: [
                Expanded(
                  child: Text(
                    seniorName.isNotEmpty ? seniorName : '이름 없음',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: _kTextMain,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  _statusLabel,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: _statusColor,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),

            // 날짜
            Row(
              children: [
                const Icon(
                  Icons.access_time_outlined,
                  size: 13,
                  color: _kTextHint,
                ),
                const SizedBox(width: 4),
                Text(
                  _dateLabel,
                  style: const TextStyle(fontSize: 13, color: _kTextHint),
                ),
              ],
            ),

            // 위치
            if (location.isNotEmpty) ...[
              const SizedBox(height: 6),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.location_on_outlined,
                    size: 13,
                    color: _kTextHint,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      location,
                      style: const TextStyle(fontSize: 13, color: _kTextSub),
                    ),
                  ),
                ],
              ),
            ],

            // 신고 상세 정보 (구조화된 행)
            if (infoRows.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Divider(color: _kDivider),
              const SizedBox(height: 12),
              const Text(
                '신고 정보',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _kTextSub,
                ),
              ),
              const SizedBox(height: 8),
              Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F8F8),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  children: [
                    for (var i = 0; i < infoRows.length; i++) ...[
                      if (i > 0) const Divider(height: 1, color: _kDivider),
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            SizedBox(
                              width: 90,
                              child: Text(
                                infoRows[i].key,
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: _kTextSub,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                            Expanded(
                              child: Text(
                                infoRows[i].value,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: _kTextMain,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],

            // 추가 메모 (자유 입력 텍스트)
            if (memoLines.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text(
                '상황 설명',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _kTextSub,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                memoLines.join('\n'),
                style: const TextStyle(
                  fontSize: 14,
                  color: _kTextMain,
                  height: 1.6,
                ),
              ),
            ],

            // 첨부 사진 (여러 장)
            if (imageUrls.isNotEmpty) ...[
              const SizedBox(height: 16),
              const Divider(color: _kDivider),
              const SizedBox(height: 12),
              Text(
                '첨부 사진 (${imageUrls.length}장)',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _kTextSub,
                ),
              ),
              const SizedBox(height: 8),
              _buildImageGrid(imageUrls, context),
            ],

            // 내 신고이면서 취소 상태가 아닐 때만 표시
            if (canCancel &&
                report['status']?.toString() != 'CANCELLED' &&
                report['status']?.toString() != 'CANCELED') ...[
              const SizedBox(height: 20),
              const Divider(color: _kDivider),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 46,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _kRed,
                    side: const BorderSide(color: _kRed),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                  onPressed: () async {
                    final confirmed = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => Dialog(
                        backgroundColor: Colors.white,
                        surfaceTintColor: Colors.transparent,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                '신고를 취소하시겠어요?',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: _kTextMain,
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                '취소된 신고는 3일 후 자동 삭제됩니다.',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: _kTextSub,
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 24),
                              Row(
                                children: [
                                  Expanded(
                                    child: ElevatedButton(
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(
                                          0xFFF6F5F3,
                                        ),
                                        foregroundColor: _kTextSub,
                                        elevation: 0,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                        ),
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12,
                                        ),
                                      ),
                                      onPressed: () =>
                                          Navigator.pop(ctx, false),
                                      child: const Text(
                                        '닫기',
                                        style: TextStyle(fontSize: 13),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: FilledButton(
                                      style: FilledButton.styleFrom(
                                        backgroundColor: _kRed,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                        ),
                                        padding: const EdgeInsets.symmetric(
                                          vertical: 12,
                                        ),
                                      ),
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: const Text(
                                        '취소하기',
                                        style: TextStyle(fontSize: 13),
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

                    if (confirmed != true) return;

                    try {
                      final id = report['id'];
                      final res = await http
                          .patch(
                            Uri.parse(
                              '${AppConfig.apiBaseUrl}/missing-reports/$id/cancel',
                            ),
                          )
                          .timeout(const Duration(seconds: 10));

                      if (res.statusCode == 200) {
                        if (context.mounted) Navigator.pop(context);
                        onCancelled?.call();
                      }
                    } catch (_) {}
                  },
                  child: const Text(
                    '신고 취소',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final description = report['description']?.toString() ?? '';
    final seniorName =
        report['seniorName']?.toString() ??
        report['targetName']?.toString() ??
        _nameFromDescription(description);
    final location = report['lastSeenAddress']?.toString() ?? '';
    final isCancelled =
        report['status']?.toString() == 'CANCELLED' ||
        report['status']?.toString() == 'CANCELED';

    return Opacity(
      opacity: isCancelled ? 0.45 : 1.0,
      child: GestureDetector(
        onTap: () => _showDetail(context),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _kDivider),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      seniorName.isNotEmpty ? seniorName : '이름 없음',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: _kTextMain,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _statusLabel,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: _statusColor,
                    ),
                  ),
                ],
              ),
              if (location.isNotEmpty) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(
                      Icons.location_on_outlined,
                      size: 12,
                      color: _kTextHint,
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        location,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12, color: _kTextSub),
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(
                    Icons.access_time_outlined,
                    size: 12,
                    color: _kTextHint,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _dateLabel,
                    style: const TextStyle(fontSize: 12, color: _kTextHint),
                  ),
                  const Spacer(),
                  const Icon(Icons.chevron_right, size: 14, color: _kTextHint),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildImageTile(List<String> urls, int index, BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => _ImageViewerScreen(urls: urls, initialIndex: index),
        ),
      ),
      child: AspectRatio(
        aspectRatio: 1,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Container(
            color: const Color(0xFFF2F2F2),
            child: Image.network(
              urls[index],
              fit: BoxFit.contain,
              loadingBuilder: (_, child, progress) => progress == null
                  ? child
                  : const Center(
                      child: CircularProgressIndicator(
                        color: _kGreen,
                        strokeWidth: 2,
                      ),
                    ),
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(Icons.broken_image_outlined, color: _kTextHint),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildImageGrid(List<String> urls, BuildContext context) {
    const gap = 4.0;

    if (urls.length <= 3) {
      return Row(
        children: [
          for (int i = 0; i < urls.length; i++) ...[
            if (i > 0) const SizedBox(width: gap),
            Expanded(child: _buildImageTile(urls, i, context)),
          ],
        ],
      );
    }

    // 4장: 2×2
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _buildImageTile(urls, 0, context)),
            const SizedBox(width: gap),
            Expanded(child: _buildImageTile(urls, 1, context)),
          ],
        ),
        const SizedBox(height: gap),
        Row(
          children: [
            Expanded(child: _buildImageTile(urls, 2, context)),
            const SizedBox(width: gap),
            Expanded(child: _buildImageTile(urls, 3, context)),
          ],
        ),
      ],
    );
  }
}

class _ImageViewerScreen extends StatefulWidget {
  final List<String> urls;
  final int initialIndex;
  const _ImageViewerScreen({required this.urls, required this.initialIndex});

  @override
  State<_ImageViewerScreen> createState() => _ImageViewerScreenState();
}

class _ImageViewerScreenState extends State<_ImageViewerScreen> {
  late final PageController _ctrl;
  late int _current;

  @override
  void initState() {
    super.initState();
    _current = widget.initialIndex;
    _ctrl = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(
          '${_current + 1} / ${widget.urls.length}',
          style: const TextStyle(fontSize: 15),
        ),
      ),
      body: PageView.builder(
        controller: _ctrl,
        itemCount: widget.urls.length,
        onPageChanged: (i) => setState(() => _current = i),
        itemBuilder: (_, i) => InteractiveViewer(
          minScale: 0.5,
          maxScale: 4.0,
          child: Center(
            child: Image.network(
              widget.urls[i],
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Icon(
                Icons.broken_image_outlined,
                color: Colors.white54,
                size: 48,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
