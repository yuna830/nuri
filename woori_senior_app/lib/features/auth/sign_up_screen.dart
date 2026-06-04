import 'package:flutter/material.dart';

import '../../core/api/senior_api.dart';
import '../../core/storage/senior_session_storage.dart';
import '../shell/app_shell.dart';

class SeniorSignUpScreen extends StatefulWidget {
  const SeniorSignUpScreen({super.key});

  @override
  State<SeniorSignUpScreen> createState() => _SeniorSignUpScreenState();
}

class _SeniorSignUpScreenState extends State<SeniorSignUpScreen> {
  final SeniorApi _api = const SeniorApi();

  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _birthDateController = TextEditingController();
  final TextEditingController _regionController = TextEditingController();

  String _gender = '여성';
  String _incomeLevel = '없음';
  String _householdType = '없음';
  bool _agreedToPrivacy = false;
  bool _isLoading = false;
  String _errorMessage = '';

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _birthDateController.dispose();
    _regionController.dispose();
    super.dispose();
  }

  Future<void> _signUp() async {
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();
    final birthDate = _birthDateController.text.trim();
    final region = _regionController.text.trim();

    if (name.isEmpty || phone.isEmpty || birthDate.isEmpty || region.isEmpty) {
      setState(() {
        _errorMessage = '필수 정보를 모두 입력해주세요.';
      });
      return;
    }

    if (!_agreedToPrivacy) {
      setState(() {
        _errorMessage = '약관 및 개인정보 수집·이용에 동의해주세요.';
      });
      return;
    }

    try {
      setState(() {
        _isLoading = true;
        _errorMessage = '';
      });

      final response = await _api.signUpSenior(
        name: name,
        phone: phone,
        birthDate: birthDate,
        gender: _gender,
        region: region,
        incomeLevel: _incomeLevel,
        householdType: _householdType,
      );

      final senior = response['senior'];

      if (senior is! Map<String, dynamic>) {
        throw Exception('어르신 정보가 없습니다.');
      }

      final seniorId = senior['id'];

      await SeniorSessionStorage.saveSeniorId(seniorId);

      if (!mounted) return;

      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => AppShell(seniorId: seniorId)),
        (_) => false,
      );
    } catch (_) {
      setState(() {
        _errorMessage = '회원가입에 실패했습니다. 입력 정보를 확인해주세요.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();

    final selected = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 70),
      firstDate: DateTime(1900),
      lastDate: now,
    );

    if (selected == null) return;

    _birthDateController.text =
        '${selected.year.toString().padLeft(4, '0')}-${selected.month.toString().padLeft(2, '0')}-${selected.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: const Text(
          '어르신 정보 등록',
          style: TextStyle(
            color: Color(0xFF1F2A20),
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(32, 4, 32, 32),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 360),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    '돌봄 서비스 이용을 위해 기본 정보를 입력해주세요.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF6D766A),
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 30),

                  const _SignUpLabel('이름'),
                  _SignUpTextField(
                    controller: _nameController,
                    hintText: '예: 김나리',
                    textInputAction: TextInputAction.next,
                  ),

                  const SizedBox(height: 18),

                  const _SignUpLabel('전화번호'),
                  _SignUpTextField(
                    controller: _phoneController,
                    hintText: '예: 01078945612',
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                  ),

                  const SizedBox(height: 18),

                  const _SignUpLabel('생년월일'),
                  TextField(
                    controller: _birthDateController,
                    readOnly: true,
                    onTap: _pickBirthDate,
                    decoration: _inputDecoration(
                      hintText: '예: 1950-01-01',
                      suffixIcon: Icons.calendar_month_outlined,
                    ),
                  ),

                  const SizedBox(height: 18),

                  const _SignUpLabel('성별'),
                  Row(
                    children: [
                      Expanded(
                        child: _GenderButton(
                          label: '여성',
                          selected: _gender == '여성',
                          onTap: () => setState(() => _gender = '여성'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _GenderButton(
                          label: '남성',
                          selected: _gender == '남성',
                          onTap: () => setState(() => _gender = '남성'),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 18),

                  const _SignUpLabel('주소'),
                  _SignUpTextField(
                    controller: _regionController,
                    hintText: '예: 서울 광진구 자양동',
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) {
                      if (!_isLoading) {
                        _signUp();
                      }
                    },
                  ),

                  const SizedBox(height: 18),

                  _OptionSelector(
                    label: '소득 정보',
                    value: _incomeLevel,
                    options: const ['없음', '기초생활수급자', '차상위계층', '중위소득 50% 이하', '중위소득 100% 이하', '일반'],
                    onChanged: (value) => setState(() => _incomeLevel = value),
                  ),

                  const SizedBox(height: 18),

                  _OptionSelector(
                    label: '가구 형태',
                    value: _householdType,
                    options: const ['없음', '독거 가구', '부부 가구', '자녀와 동거', '기타 가구'],
                    onChanged: (value) => setState(() => _householdType = value),
                  ),

                  const SizedBox(height: 18),

                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 24,
                        height: 24,
                        child: Checkbox(
                          value: _agreedToPrivacy,
                          onChanged: (value) {
                            setState(() {
                              _agreedToPrivacy = value ?? false;
                            });
                          },
                          activeColor: const Color(0xFF86A788),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              _agreedToPrivacy = !_agreedToPrivacy;
                            });
                          },
                          child: const Text(
                            '약관 및 개인정보 수집·이용에 동의합니다.',
                            style: TextStyle(
                              color: Color(0xFF1F2A20),
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),

                  if (_errorMessage.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      _errorMessage,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        color: Color(0xFFD94E4E),
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],

                  const SizedBox(height: 16),

                  SizedBox(
                    height: 56,
                    child: FilledButton(
                      onPressed: _isLoading || !_agreedToPrivacy
                          ? null
                          : _signUp,
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF86A788),
                        disabledBackgroundColor: const Color(0xFFD8E3D5),
                        foregroundColor: Colors.white,
                        disabledForegroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: Text(
                        _isLoading ? '등록 중...' : '회원가입',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),

                  const SizedBox(height: 18),

                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text(
                      '이미 계정이 있나요? 로그인',
                      style: TextStyle(
                        color: Color(0xFF86A788),
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SignUpLabel extends StatelessWidget {
  const _SignUpLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          color: Color(0xFF111827),
          fontSize: 17,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }
}

class _SignUpTextField extends StatelessWidget {
  const _SignUpTextField({
    required this.controller,
    required this.hintText,
    this.keyboardType,
    this.textInputAction,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hintText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      onSubmitted: onSubmitted,
      decoration: _inputDecoration(hintText: hintText),
    );
  }
}


class _OptionSelector extends StatelessWidget {
  const _OptionSelector({
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SignUpLabel(label),
        DropdownButtonFormField<String>(
          value: value,
          items: options
              .map((option) => DropdownMenuItem<String>(
                    value: option,
                    child: Text(option),
                  ))
              .toList(),
          onChanged: (next) {
            if (next != null) onChanged(next);
          },
          decoration: _inputDecoration(hintText: label),
        ),
      ],
    );
  }
}

class _GenderButton extends StatelessWidget {
  const _GenderButton({
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
      height: 52,
      child: OutlinedButton(
        onPressed: onTap,
        style: OutlinedButton.styleFrom(
          backgroundColor: selected
              ? const Color(0xFF86A788)
              : const Color(0xFFF7F5E8),
          foregroundColor: selected ? Colors.white : const Color(0xFF1F2A20),
          side: BorderSide(
            color: selected ? const Color(0xFF86A788) : const Color(0xFFF7F5E8),
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
        child: Text(
          label,
          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900),
        ),
      ),
    );
  }
}

InputDecoration _inputDecoration({
  required String hintText,
  IconData? suffixIcon,
}) {
  return InputDecoration(
    hintText: hintText,
    filled: true,
    fillColor: const Color(0xFFF7F5E8),
    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    suffixIcon: suffixIcon == null ? null : Icon(suffixIcon),
    border: OutlineInputBorder(
      borderRadius: BorderRadius.circular(10),
      borderSide: BorderSide.none,
    ),
  );
}
