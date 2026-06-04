import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import '../../core/api/guardian_api.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';

// ── 색상 토큰 ─────────────────────────────────────────────────────────────────
const _kGreen    = Color(0xFF86A788);
const _kSafe     = Color(0xFF4A7A4C);
const _kSafeBg   = Color(0xFFEEF5EE);
const _kWarn     = Color(0xFFFF9500);
const _kWarnBg   = Color(0xFFFFF4E5);
const _kRed      = Color(0xFFB85252);
const _kTextMain = Color(0xFF1C1C1E);
const _kTextSub  = Color(0xFF6C6C70);
const _kTextHint = Color(0xFFAEAEB2);
const _kDivider  = Color(0xFFE5E5EA);
const _kBg = Colors.white;

// ── 신고 유형 ─────────────────────────────────────────────────────────────────

class _ReportType {
  final String   value;
  final String   label;
  final IconData icon;
  const _ReportType(this.value, this.label, this.icon);
}

const _kReportTypes = [
  _ReportType('missing', '실종 신고',      Icons.search_off),
  _ReportType('danger',  '위험 상황 신고',  Icons.warning_amber_rounded),
  _ReportType('sos',     'SOS 미응답',      Icons.sos),
  _ReportType('zone',    '위치 이탈',       Icons.location_off),
  _ReportType('fall',    '낙상 의심',       Icons.personal_injury),
  _ReportType('other',   '기타',            Icons.more_horiz),
];

// ── 발생 장소 선택 모드 ────────────────────────────────────────────────────────

enum _LocationMode { lastKnown, mapPick, search }

// ── 화면 ─────────────────────────────────────────────────────────────────────

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _api            = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();
  final _picker         = ImagePicker();

  _ReportType? _selectedType;
  Senior?      _selectedSenior;
  List<Senior> _seniors        = [];
  bool         _seniorsLoading = true;

  final _descCtrl     = TextEditingController();
  final _locationCtrl = TextEditingController();

  DateTime      _incidentTime = DateTime.now();
  _LocationMode _locationMode = _LocationMode.lastKnown;

  final List<XFile> _photos = [];

  bool _consentGiven = false;
  bool _submitting   = false;

  // 주소 검색
  final _searchCtrl = TextEditingController();
  Timer? _searchDebounce;
  List<_NominatimResult> _searchResults = [];
  bool _searchLoading = false;

  bool get _canSubmit =>
      _selectedType != null && _selectedSenior != null && _consentGiven;

  // ── 생명주기 ──────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    _loadSeniors();
  }

  @override
  void dispose() {
    _descCtrl.dispose();
    _locationCtrl.dispose();
    _searchCtrl.dispose();
    _searchDebounce?.cancel();
    super.dispose();
  }

  // ── 데이터 ────────────────────────────────────────────────────────────────

  Future<void> _loadSeniors() async {
    try {
      final info = await _sessionStorage.getGuardianInfo();
      final gid  = info['guardianId'];
      if (gid == null || gid.isEmpty) return;
      final list = await _api.fetchGuardianSeniors(int.parse(gid));
      if (!mounted) return;
      setState(() {
        _seniors        = list;
        _seniorsLoading = false;
        if (list.isNotEmpty) {
          _selectedSenior = list.first;
          _applyLastKnownLocation(list.first);
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
    }
  }

  // ── 액션 ─────────────────────────────────────────────────────────────────

  Future<void> _addPhoto() async {
    if (_photos.length >= 4) return;
    try {
      final picked = await _picker.pickImage(
          source: ImageSource.gallery, imageQuality: 80);
      if (picked != null && mounted) {
        setState(() => _photos.add(picked));
      }
    } catch (e) {
      if (!mounted) return;
      _snack('사진을 불러올 수 없습니다. 앱을 완전히 재시작한 후 다시 시도해주세요.');
    }
  }

  void _removePhoto(int i) => setState(() => _photos.removeAt(i));

  Future<void> _pickTime() async {
    DateTime temp = _incidentTime;
    await showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return SizedBox(
          height: 300,
          child: Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 8, 0),
              child: Row(children: [
                const Expanded(
                  child: Text('발생 시간',
                      style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: _kTextMain)),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('취소',
                      style: TextStyle(color: _kTextSub)),
                ),
                TextButton(
                  onPressed: () {
                    setState(() => _incidentTime = temp);
                    Navigator.pop(ctx);
                  },
                  child: const Text('확인',
                      style: TextStyle(
                          color: _kSafe, fontWeight: FontWeight.w600)),
                ),
              ]),
            ),
            const Divider(height: 1, color: _kDivider),
            Expanded(
              child: CupertinoDatePicker(
                initialDateTime: _incidentTime,
                maximumDate: DateTime.now(),
                minimumDate:
                    DateTime.now().subtract(const Duration(days: 30)),
                mode: CupertinoDatePickerMode.dateAndTime,
                use24hFormat: true,
                onDateTimeChanged: (dt) => temp = dt,
              ),
            ),
          ]),
        );
      },
    );
  }

  Future<void> _onLocationModeChanged(_LocationMode mode) async {
    if (mode == _LocationMode.lastKnown) {
      setState(() {
        _locationMode  = _LocationMode.lastKnown;
        _searchResults = [];
      });
      _searchCtrl.clear();
      if (_selectedSenior != null) _applyLastKnownLocation(_selectedSenior!);
      return;
    }
    if (mode == _LocationMode.search) {
      setState(() {
        _locationMode  = _LocationMode.search;
        _searchResults = [];
      });
      _locationCtrl.clear();
      _searchCtrl.clear();
      return;
    }
    // 지도에서 선택
    final defaultLat = 37.5665;
    final defaultLng = 126.9780;
    final initial = LatLng(defaultLat, defaultLng);

    final result = await Navigator.push<_MapPickResult>(
      context,
      MaterialPageRoute(
        builder: (_) => _ReportMapPickScreen(initial: initial),
      ),
    );
    if (result != null && mounted) {
      setState(() {
        _locationMode = _LocationMode.mapPick;
        _locationCtrl.text = result.address.isNotEmpty
            ? result.address
            : '${result.point.latitude.toStringAsFixed(5)}, ${result.point.longitude.toStringAsFixed(5)}';
      });
    }
  }

  void _submit() {
    if (_selectedType == null) { _snack('신고 유형을 선택해주세요.'); return; }
    if (_selectedSenior == null) { _snack('대상자를 선택해주세요.'); return; }
    if (!_consentGiven) { _snack('개인정보 수집 및 이용에 동의해주세요.'); return; }

    setState(() => _submitting = true);
    // TODO: 신고 API 연동 시 _photos(XFile 목록)를 multipart로 업로드
    Future.delayed(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      setState(() => _submitting = false);
      _snack('신고가 접수되었습니다. (개발 예정)');
    });
  }

  void _snack(String msg) =>
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(msg)));

  // ── UI ────────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: _kBg,
      child: Column(children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ① 어르신 선택 + 요약 카드
                _buildSeniorSection(),
                const SizedBox(height: 14),

                // ② 신고 유형
                _sectionLabel('신고 유형', required: true),
                const SizedBox(height: 6),
                _buildTypeDropdown(),
                const SizedBox(height: 14),

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

                // ⑤ 상황 설명
                _sectionLabel('상황 설명'),
                const SizedBox(height: 6),
                TextField(
                  controller: _descCtrl,
                  maxLines: 4,
                  style: const TextStyle(fontSize: 14, color: _kTextMain),
                  decoration: _inputDeco(
                    '상황을 자세히 적어주세요. 마지막 연락, 주변 상황, 특이사항 등을 입력하면 신고 처리에 도움이 됩니다.',
                  ),
                ),
                const SizedBox(height: 14),

                // ⑥ 사진 첨부
                _sectionLabel('사진 첨부  (선택, ${_photos.length}/4장)'),
                const SizedBox(height: 6),
                _buildPhotoSection(),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
        _buildBottomBar(),
      ]),
    );
  }

  // ── 어르신 선택 ────────────────────────────────────────────────────────────

  Widget _buildSeniorSection() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _sectionLabel('신고 대상자', required: true),
      const SizedBox(height: 6),
      if (_seniorsLoading)
        const Center(
            child: Padding(
          padding: EdgeInsets.all(8),
          child: CircularProgressIndicator(color: _kGreen, strokeWidth: 2),
        ))
      else
        _buildDropdown<Senior>(
          value: _selectedSenior,
          hint: '대상자를 선택하세요',
          items: _seniors,
          itemLabel: (s) => s.name,
          onChanged: (v) => setState(() {
            _selectedSenior = v;
            if (v != null) _applyLastKnownLocation(v);
          }),
        ),
      if (_selectedSenior != null) ...[
        const SizedBox(height: 8),
        _SeniorCard(senior: _selectedSenior!),
      ],
    ]);
  }

  // ── 신고 유형 드롭다운 ──────────────────────────────────────────────────────

  Widget _buildTypeDropdown() {
    return _buildDropdown<_ReportType>(
      value: _selectedType,
      hint: '신고 유형을 선택하세요',
      items: _kReportTypes,
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
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: _kSafeBg,
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Icon(Icons.access_time_outlined,
                size: 16, color: _kSafe),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('발생 시간',
                      style:
                          TextStyle(fontSize: 11, color: _kTextHint)),
                  const SizedBox(height: 2),
                  Text(_formatDateTime(_incidentTime),
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: _kTextMain)),
                ]),
          ),
          const Text('변경',
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: _kSafe)),
        ]),
      ),
    );
  }

  // ── 발생 장소 ──────────────────────────────────────────────────────────────

  Widget _buildLocationSection() {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // 3가지 선택 칩
      Row(children: [
        _LocationChip(
          icon: Icons.person_pin_circle_outlined,
          label: '마지막 위치',
          selected: _locationMode == _LocationMode.lastKnown,
          onTap: () => _onLocationModeChanged(_LocationMode.lastKnown),
        ),
        const SizedBox(width: 8),
        _LocationChip(
          icon: Icons.map_outlined,
          label: '지도에서 선택',
          selected: _locationMode == _LocationMode.mapPick,
          onTap: () => _onLocationModeChanged(_LocationMode.mapPick),
        ),
        const SizedBox(width: 8),
        _LocationChip(
          icon: Icons.search,
          label: '주소 검색',
          selected: _locationMode == _LocationMode.search,
          onTap: () => _onLocationModeChanged(_LocationMode.search),
        ),
      ]),
      const SizedBox(height: 8),

      // 마지막 위치 / 지도 선택 결과 표시
      if (_locationMode != _LocationMode.search)
        TextField(
          controller: _locationCtrl,
          readOnly: true,
          style: const TextStyle(fontSize: 14, color: _kTextMain),
          decoration: _inputDeco('위치를 선택하면 여기에 표시됩니다').copyWith(
            fillColor: const Color(0xFFF8F8F8),
          ),
        ),

      // 주소 검색 모드
      if (_locationMode == _LocationMode.search) ...[
        TextField(
          controller: _searchCtrl,
          style: const TextStyle(fontSize: 14, color: _kTextMain),
          decoration: _inputDeco('주소를 입력하세요 (예: 서초동 편의점)').copyWith(
            prefixIcon: const Icon(Icons.search, size: 18, color: _kTextHint),
            suffixIcon: _searchLoading
                ? const Padding(
                    padding: EdgeInsets.all(12),
                    child: SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: _kGreen),
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
            _searchDebounce =
                Timer(const Duration(milliseconds: 500), () async {
              setState(() => _searchLoading = true);
              final results = await _searchNominatim(v.trim());
              if (mounted) setState(() {
                _searchResults = results;
                _searchLoading = false;
              });
            });
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
            child: Column(children: [
              for (var i = 0; i < _searchResults.length; i++) ...[
                if (i > 0) const Divider(height: 1, color: _kDivider),
                InkWell(
                  onTap: () => setState(() {
                    _locationCtrl.text = _searchResults[i].displayName;
                    _locationMode  = _LocationMode.search;
                    _searchResults = [];
                    _searchCtrl.clear();
                  }),
                  borderRadius: i == 0
                      ? const BorderRadius.vertical(top: Radius.circular(10))
                      : i == _searchResults.length - 1
                          ? const BorderRadius.vertical(
                              bottom: Radius.circular(10))
                          : BorderRadius.zero,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 10),
                    child: Row(children: [
                      const Icon(Icons.location_on_outlined,
                          size: 14, color: _kTextHint),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _searchResults[i].displayName,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 12, color: _kTextMain, height: 1.4),
                        ),
                      ),
                    ]),
                  ),
                ),
              ],
            ]),
          ),
        ],
        // 검색 결과 선택 후 선택된 주소 표시
        if (_locationCtrl.text.isNotEmpty && _searchResults.isEmpty &&
            _searchCtrl.text.isEmpty) ...[
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: _kSafeBg,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: _kGreen.withValues(alpha: 0.4)),
            ),
            child: Row(children: [
              const Icon(Icons.check_circle_outline,
                  size: 14, color: _kSafe),
              const SizedBox(width: 8),
              Expanded(
                child: Text(_locationCtrl.text,
                    style: const TextStyle(fontSize: 12, color: _kSafe),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis),
              ),
            ]),
          ),
        ],
      ],
    ]);
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
                  Icon(Icons.camera_alt_outlined,
                      size: 18, color: _kTextHint),
                  SizedBox(width: 8),
                  Text('사진 추가',
                      style: TextStyle(fontSize: 13, color: _kTextSub)),
                ],
              ),
            ),
          ),
      ],
    );
  }

  // ── 하단 동의 + 버튼 ───────────────────────────────────────────────────────

  Widget _buildBottomBar() {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.fromLTRB(
          16, 10, 16, MediaQuery.of(context).padding.bottom + 14),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        const SizedBox(height: 4),

        // 개인정보 동의 — 심플 인라인
        GestureDetector(
          onTap: () =>
              setState(() => _consentGiven = !_consentGiven),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 20,
                height: 20,
                child: Checkbox(
                  value: _consentGiven,
                  onChanged: (v) =>
                      setState(() => _consentGiven = v ?? false),
                  fillColor: WidgetStateProperty.resolveWith((states) =>
                      states.contains(WidgetState.selected)
                          ? Colors.white
                          : Colors.white),
                  checkColor: _kRed,
                  side: WidgetStateBorderSide.resolveWith((states) =>
                      BorderSide(
                        color: states.contains(WidgetState.selected)
                            ? _kRed
                            : const Color(0xFFBBBBBB),
                        width: 1.5,
                      )),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(4)),
                  materialTapTargetSize:
                      MaterialTapTargetSize.shrinkWrap,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  text: const TextSpan(
                    style: TextStyle(
                        fontSize: 12,
                        color: _kTextSub,
                        height: 1.5),
                    children: [
                      TextSpan(text: '신고 처리를 위해 '),
                      TextSpan(
                        text: '개인정보(이름, 연락처, 위치정보)',
                        style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: _kTextMain),
                      ),
                      TextSpan(
                          text:
                              '를 수집·이용하는 것에 동의합니다. 수집된 정보는 신고 처리 목적으로만 사용됩니다.'),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),

        SizedBox(
          width: double.infinity,
          height: 50,
          child: FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor:
                  _canSubmit ? _kRed : const Color(0xFFCCCCCC),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              elevation: _canSubmit ? 1 : 0,
            ),
            onPressed: (_submitting || !_canSubmit) ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.campaign_outlined,
                          size: 18,
                          color: _canSubmit
                              ? Colors.white
                              : const Color(0xFF999999)),
                      const SizedBox(width: 6),
                      Text('신고 접수하기',
                          style: TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.bold,
                              color: _canSubmit
                                  ? Colors.white
                                  : const Color(0xFF999999))),
                    ],
                  ),
          ),
        ),
      ]),
    );
  }

  // ── 공통 헬퍼 ─────────────────────────────────────────────────────────────

  Widget _sectionLabel(String text, {bool required = false}) {
    return Row(children: [
      Text(text,
          style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: _kTextMain)),
      if (required) ...[
        const SizedBox(width: 3),
        const Text('*',
            style: TextStyle(fontSize: 13, color: _kRed)),
      ],
    ]);
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
          .map((item) => Align(
                alignment: Alignment.centerLeft,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  if (leading != null) ...[
                    leading(item),
                    const SizedBox(width: 8),
                  ],
                  Text(itemLabel(item),
                      style: const TextStyle(
                          fontSize: 14, color: _kTextMain)),
                ]),
              ))
          .toList(),
      decoration: InputDecoration(
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: _kDivider)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: _kDivider)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: _kGreen, width: 1.5)),
        filled: true,
        fillColor: Colors.white,
      ),
      hint: Text(hint,
          style: const TextStyle(fontSize: 14, color: _kTextHint)),
      isExpanded: true,
      icon: const Icon(Icons.keyboard_arrow_down, color: _kTextSub),
      dropdownColor: Colors.white,
      borderRadius: BorderRadius.circular(12),
      menuMaxHeight: 280,
      itemHeight: 48,
      items: items.map((item) {
        return DropdownMenuItem<T>(
          value: item,
          child: Row(children: [
            if (leading != null) ...[
              leading(item),
              const SizedBox(width: 10),
            ],
            Text(itemLabel(item),
                style: const TextStyle(
                    fontSize: 14, color: _kTextMain)),
          ]),
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
        hintStyle: const TextStyle(
            fontSize: 13, color: _kTextHint, height: 1.5),
        border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: _kDivider)),
        enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: _kDivider)),
        focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: _kGreen, width: 1.5)),
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.all(12),
      );
}

// ── 어르신 요약 카드 ──────────────────────────────────────────────────────────

class _SeniorCard extends StatelessWidget {
  final Senior senior;
  const _SeniorCard({required this.senior});

  @override
  Widget build(BuildContext context) {
    final isSafe      = senior.status == '안전';
    final statusColor = isSafe ? _kSafe : _kWarn;
    final statusBg    = isSafe ? _kSafeBg : _kWarnBg;

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
            Row(children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                    color: statusBg, shape: BoxShape.circle),
                child:
                    Icon(Icons.person, size: 18, color: statusColor),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(senior.name,
                    style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                        color: _kTextMain)),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle)),
                  const SizedBox(width: 4),
                  Text(senior.status,
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: statusColor)),
                ]),
              ),
            ]),
            const SizedBox(height: 8),
            const Divider(height: 1, color: _kDivider),
            const SizedBox(height: 8),
            _Row(
                icon: Icons.location_on_outlined,
                label: '마지막 위치',
                value: senior.lastLocationAddress),
            const SizedBox(height: 4),
            _Row(
                icon: Icons.access_time_outlined,
                label: '마지막 확인',
                value: senior.lastLocationTime.isEmpty ||
                        senior.lastLocationTime == '-'
                    ? '정보 없음'
                    : senior.lastLocationTime),
          ]),
    );
  }
}

class _Row extends StatelessWidget {
  final IconData icon;
  final String   label;
  final String   value;
  const _Row(
      {required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) => Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 12, color: _kTextHint),
          const SizedBox(width: 5),
          SizedBox(
              width: 60,
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 11, color: _kTextSub))),
          Expanded(
              child: Text(value,
                  style: const TextStyle(
                      fontSize: 11, color: _kTextMain),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis)),
        ],
      );
}

// ── 발생 장소 선택 칩 ─────────────────────────────────────────────────────────

class _LocationChip extends StatelessWidget {
  final IconData     icon;
  final String       label;
  final bool         selected;
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
              border: Border.all(
                  color: selected ? _kGreen : _kDivider,
                  width: 1.2),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon,
                  size: 15,
                  color: selected ? _kSafe : _kTextHint),
              const SizedBox(height: 3),
              Text(label,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                      fontSize: 10,
                      fontWeight: selected
                          ? FontWeight.w600
                          : FontWeight.normal,
                      color: selected ? _kSafe : _kTextSub)),
            ]),
          ),
        ),
      );
}

// ── 사진 슬롯 ─────────────────────────────────────────────────────────────────

class _PhotoSlot extends StatelessWidget {
  final File         file;
  final VoidCallback onRemove;
  const _PhotoSlot({required this.file, required this.onRemove});

  @override
  Widget build(BuildContext context) => Stack(children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.file(file,
              width: 80, height: 80, fit: BoxFit.cover),
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
                  color: Colors.black54, shape: BoxShape.circle),
              child: const Icon(Icons.close,
                  size: 13, color: Colors.white),
            ),
          ),
        ),
      ]);
}

// ── 헬퍼 함수 ─────────────────────────────────────────────────────────────────

String _formatDateTime(DateTime dt) {
  final p = (int n) => n.toString().padLeft(2, '0');
  return '${dt.year}-${p(dt.month)}-${p(dt.day)} ${p(dt.hour)}:${p(dt.minute)}';
}

// ── Nominatim 주소 검색 ───────────────────────────────────────────────────────

class _NominatimResult {
  final String displayName;
  final double lat;
  final double lng;
  const _NominatimResult(
      {required this.displayName, required this.lat, required this.lng});
}

Future<List<_NominatimResult>> _searchNominatim(String query) async {
  final url = Uri.parse(
    'https://nominatim.openstreetmap.org/search'
    '?q=${Uri.encodeComponent(query)}&format=json&limit=5&accept-language=ko',
  );
  try {
    final res = await http
        .get(url, headers: {'User-Agent': 'woori_guardian_app'})
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return [];
    final list = jsonDecode(res.body) as List<dynamic>;
    return list
        .map((j) => _NominatimResult(
              displayName: j['display_name'] as String? ?? '',
              lat: double.tryParse(j['lat'] as String? ?? '') ?? 0,
              lng: double.tryParse(j['lon'] as String? ?? '') ?? 0,
            ))
        .where((r) => r.lat != 0 && r.lng != 0)
        .toList();
  } catch (_) {
    return [];
  }
}

// ── 지도 선택 결과 ─────────────────────────────────────────────────────────────

class _MapPickResult {
  final LatLng point;
  final String address;
  const _MapPickResult({required this.point, required this.address});
}

// ── 지도에서 위치 선택 화면 ────────────────────────────────────────────────────

class _ReportMapPickScreen extends StatefulWidget {
  final LatLng initial;
  const _ReportMapPickScreen({required this.initial});

  @override
  State<_ReportMapPickScreen> createState() => _ReportMapPickScreenState();
}

class _ReportMapPickScreenState extends State<_ReportMapPickScreen> {
  late LatLng _picked;
  final _mc = MapController();
  bool _geocoding = false;
  String _address = '';

  @override
  void initState() {
    super.initState();
    _picked = widget.initial;
  }

  @override
  void dispose() {
    _mc.dispose();
    super.dispose();
  }

  Future<void> _onTap(LatLng point) async {
    setState(() {
      _picked   = point;
      _address  = '';
      _geocoding = true;
    });
    try {
      final url = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse'
        '?lat=${point.latitude}&lon=${point.longitude}'
        '&format=json&accept-language=ko',
      );
      final res = await http
          .get(url, headers: {'User-Agent': 'woori_guardian_app'})
          .timeout(const Duration(seconds: 6));
      if (res.statusCode == 200 && mounted) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        setState(() => _address = data['display_name'] as String? ?? '');
      }
    } catch (_) {}
    if (mounted) setState(() => _geocoding = false);
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
            child: const Text('확인',
                style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15)),
          ),
        ],
      ),
      body: Stack(children: [
        FlutterMap(
          mapController: _mc,
          options: MapOptions(
            initialCenter: _picked,
            initialZoom: 15.0,
            onTap: (_, point) => _onTap(point),
          ),
          children: [
            TileLayer(
              urlTemplate:
                  'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.woori.woori_guardian_app',
            ),
            MarkerLayer(markers: [
              Marker(
                point: _picked,
                width: 40,
                height: 40,
                child: const Icon(Icons.location_pin,
                    color: _kGreen, size: 40),
              ),
            ]),
          ],
        ),

        // 하단 안내 박스
        Positioned(
          bottom: 16,
          left: 16,
          right: 16,
          child: Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: const [
                BoxShadow(color: Colors.black12, blurRadius: 6)
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
                              strokeWidth: 2, color: _kGreen)),
                      SizedBox(width: 10),
                      Text('주소 조회 중...',
                          style: TextStyle(
                              fontSize: 13, color: _kTextSub)),
                    ],
                  )
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text('지도를 탭하여 위치를 선택하세요',
                          style: TextStyle(
                              fontSize: 12, color: _kTextHint)),
                      const SizedBox(height: 4),
                      Text(
                        _address.isNotEmpty
                            ? _address
                            : '${_picked.latitude.toStringAsFixed(5)}, '
                                '${_picked.longitude.toStringAsFixed(5)}',
                        style: const TextStyle(
                            fontSize: 13,
                            color: _kTextMain,
                            height: 1.4),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
          ),
        ),
      ]),
    );
  }
}
