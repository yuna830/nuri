import 'package:flutter/material.dart';
import '../../core/api/guardian_api.dart';
import '../../core/storage/guardian_session_storage.dart';
import '../../core/utils/phone_number_input_formatter.dart';
import '../../core/theme/app_colors.dart';

const _kGreen    = AppColors.green;
const _kGreenBg  = AppColors.greenBg;
const _kBg = Colors.white;
const _kDivider  = AppColors.divider;
const _kTextMain = AppColors.textMain;
const _kTextSub  = AppColors.textSub;
const _kTextHint = AppColors.textHint;

class AddSeniorScreen extends StatefulWidget {
  const AddSeniorScreen({super.key});

  @override
  State<AddSeniorScreen> createState() => _AddSeniorScreenState();
}

class _AddSeniorScreenState extends State<AddSeniorScreen> {
  final _api     = GuardianApi();
  final _storage = GuardianSessionStorage();

  final _nameCtrl     = TextEditingController();
  final _phoneCtrl    = TextEditingController();
  final _relationCtrl = TextEditingController();

  bool _searching  = false;
  bool _searched   = false;
  Map<String, dynamic>? _found;
  bool _connecting = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _relationCtrl.dispose();
    super.dispose();
  }

  // ── 유효성 검사 ────────────────────────────────────────────────────────────
  String? _validateInputs() {
    if (_nameCtrl.text.trim().isEmpty) return '이름을 입력해주세요.';
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) return '전화번호를 입력해주세요.';
    final digits = phone.replaceAll('-', '');
    if (digits.length < 10 || digits.length > 11) {
      return '올바른 전화번호 형식이 아닙니다.';
    }
    return null;
  }

  // ── 검색 ───────────────────────────────────────────────────────────────────
  Future<void> _search() async {
    final err = _validateInputs();
    if (err != null) {
      _snack(err);
      return;
    }
    setState(() { _searching = true; _searched = false; _found = null; });
    final result = await _api.searchSeniorExact(
      _nameCtrl.text.trim(),
      _phoneCtrl.text.trim(),
    );
    if (mounted) {
      setState(() { _searching = false; _searched = true; _found = result; });
    }
  }

  // ── 추가 ───────────────────────────────────────────────────────────────────
  Future<void> _connect() async {
    if (_found == null) return;
    final relation = _relationCtrl.text.trim();
    if (relation.isEmpty) { _snack('관계를 입력해주세요.'); return; }

    final info = await _storage.getGuardianInfo();
    final gId  = int.tryParse(info['guardianId'] ?? '');
    if (gId == null) return;
    final sId = _found!['id'] as int?;
    if (sId == null) return;

    setState(() => _connecting = true);
    try {
      await _api.connectSeniorToGuardian(gId, sId, relation);
      if (!mounted) return;
      _snack('보호 대상자가 추가되었습니다.');
      Navigator.pop(context, true);
    } on Exception catch (e) {
      if (!mounted) return;
      _snack(e.toString().contains('ALREADY_CONNECTED')
          ? '이미 연결된 보호 대상자입니다.'
          : '추가에 실패했습니다. 다시 시도해주세요.');
    } finally {
      if (mounted) setState(() => _connecting = false);
    }
  }

  void _snack(String msg) => ScaffoldMessenger.of(context)
      .showSnackBar(SnackBar(content: Text(msg)));

  // ── 빌드 ───────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        title: const Text('보호 대상자 추가'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [

            // ── 안내 문구 ───────────────────────────────────────
            const Text('보호 대상자 검색',
                style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: _kTextMain)),
            const SizedBox(height: 4),
            const Text('이름과 전화번호로 등록된 사용자를 검색하세요.',
                style: TextStyle(fontSize: 13, color: _kTextSub)),
            const SizedBox(height: 20),

            // ── 이름 입력 ────────────────────────────────────────
            _field(
              controller: _nameCtrl,
              hint: '이름',
              action: TextInputAction.next,
            ),
            const SizedBox(height: 10),

            // ── 전화번호 입력 ─────────────────────────────────────
            _field(
              controller: _phoneCtrl,
              hint: '전화번호 (예: 010-1234-5678)',
              keyboardType: TextInputType.phone,
              action: TextInputAction.done,
              formatters: [PhoneNumberInputFormatter()],
              onSubmitted: (_) => _search(),
            ),
            const SizedBox(height: 16),

            // ── 검색 버튼 ────────────────────────────────────────
            FilledButton(
              onPressed: _searching ? null : _search,
              style: FilledButton.styleFrom(
                backgroundColor: _kGreen,
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10)),
              ),
              child: _searching
                  ? const SizedBox(
                      height: 18, width: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('검색',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
            ),

            // ── 검색 결과 ─────────────────────────────────────────
            if (_searched) ...[
              const SizedBox(height: 28),
              if (_found == null)
                _emptyResult()
              else ...[
                _resultCard(_found!),
                const SizedBox(height: 20),

                // ── 관계 입력 ──────────────────────────────────────
                const Text('관계',
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _kTextMain)),
                const SizedBox(height: 8),
                _field(
                  controller: _relationCtrl,
                  hint: '예: 딸, 아들, 손녀, 이웃, 보호자',
                  action: TextInputAction.done,
                  onChanged: (_) => setState(() {}),
                ),
                const SizedBox(height: 20),

                // ── 추가 버튼 ──────────────────────────────────────
                FilledButton(
                  onPressed: (_connecting ||
                          _relationCtrl.text.trim().isEmpty)
                      ? null
                      : _connect,
                  style: FilledButton.styleFrom(
                    backgroundColor: _kGreen,
                    disabledBackgroundColor: _kTextHint,
                    minimumSize: const Size.fromHeight(50),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                  child: _connecting
                      ? const SizedBox(
                          height: 18, width: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white))
                      : const Text('보호 대상자로 추가',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }

  // ── 입력 필드 ──────────────────────────────────────────────────────────────
  Widget _field({
    required TextEditingController controller,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
    TextInputAction action = TextInputAction.next,
    List<dynamic> formatters = const [],
    ValueChanged<String>? onChanged,
    ValueChanged<String>? onSubmitted,
  }) =>
      TextField(
        controller: controller,
        keyboardType: keyboardType,
        textInputAction: action,
        inputFormatters: formatters.cast(),
        onChanged: onChanged,
        onSubmitted: onSubmitted,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: const TextStyle(color: _kTextHint, fontSize: 14),
          filled: true,
          fillColor: Colors.white,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _kDivider)),
          enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _kDivider)),
          focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: _kGreen, width: 1.5)),
        ),
      );

  // ── 검색 결과 없음 ──────────────────────────────────────────────────────────
  Widget _emptyResult() => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          children: const [
            Icon(Icons.search_off, size: 44, color: _kTextHint),
            SizedBox(height: 10),
            Text(
              '등록된 사용자를 찾을 수 없습니다.\n이름과 전화번호를 다시 확인해주세요.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: _kTextSub, height: 1.6),
            ),
          ],
        ),
      );

  // ── 검색 결과 카드 ──────────────────────────────────────────────────────────
  Widget _resultCard(Map<String, dynamic> senior) {
    final name  = senior['name']  as String? ?? '';
    final phone = senior['phone'] as String? ?? '';
    final age   = senior['age'];
    final region = (senior['region'] as String?)
        ?? (senior['address'] as String?)
        ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kGreen.withValues(alpha: 0.5)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: _kGreenBg,
            child: Text(name.isNotEmpty ? name[0] : '?',
                style: const TextStyle(
                    color: _kGreen,
                    fontSize: 16,
                    fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text(name,
                      style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: _kTextMain)),
                  if (age != null) ...[
                    const SizedBox(width: 6),
                    Text('$age세',
                        style: const TextStyle(
                            fontSize: 13, color: _kTextSub)),
                  ],
                ]),
                if (phone.isNotEmpty)
                  Text(phone,
                      style: const TextStyle(
                          fontSize: 13, color: _kTextSub)),
                if (region.isNotEmpty)
                  Text(region,
                      style: const TextStyle(
                          fontSize: 13, color: _kTextHint)),
              ],
            ),
          ),
          const Icon(Icons.check_circle, color: _kGreen, size: 22),
        ],
      ),
    );
  }
}
