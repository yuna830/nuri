import 'package:flutter/material.dart';
import '../api/auth_api.dart';
import '../theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _birthDateController = TextEditingController();
  final _addressController = TextEditingController();
  final _detailAddressController = TextEditingController();
  final _inviteCodeController = TextEditingController();
  String? _gender;
  bool _loading = false;
  String? _error;

  Future<void> _register() async {
    if (_gender == null) {
      setState(() => _error = '성별을 선택해 주세요.');
      return;
    }
    if (_birthDateController.text.trim().isEmpty) {
      setState(() => _error = '생년월일을 입력해 주세요.');
      return;
    }
    if (_addressController.text.trim().isEmpty) {
      setState(() => _error = '주소를 입력해 주세요.');
      return;
    }
    final birthDate = _normalizeDate(_birthDateController.text);
    if (birthDate == null) {
      setState(() => _error = '생년월일은 19450301처럼 숫자 8자리로 입력해 주세요.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await AuthApi.register(
        _nameController.text.trim(),
        _phoneController.text.trim(),
        _inviteCodeController.text.trim().toUpperCase(),
        _gender ?? '',
        birthDate,
        _addressController.text.trim(),
        _detailAddressController.text.trim(),
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('회원가입이 완료되었습니다.')),
      );
      Navigator.of(context).pop();
    } catch (error) {
      setState(() {
        _error = error.toString().replaceFirst('Exception: ', '');
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _normalizeDate(String value) {
    final cleaned = value.trim().replaceAll('.', '-').replaceAll('/', '-');
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

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _birthDateController.dispose();
    _addressController.dispose();
    _detailAddressController.dispose();
    _inviteCodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('사용자 회원가입')),
      backgroundColor: kBg,
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          TextField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: '이름',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: '전화번호',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          DropdownButtonFormField<String>(
            value: _gender,
            items: const [
              DropdownMenuItem(value: 'M', child: Text('남성')),
              DropdownMenuItem(value: 'F', child: Text('여성')),
            ],
            onChanged: (value) => setState(() => _gender = value),
            decoration: const InputDecoration(
              labelText: '성별',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _birthDateController,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: '생년월일',
              hintText: '예: 19450301',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _addressController,
            decoration: const InputDecoration(
              labelText: '주소',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _detailAddressController,
            decoration: const InputDecoration(
              labelText: '상세주소',
              hintText: '동/호수 등',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _inviteCodeController,
            textCapitalization: TextCapitalization.characters,
            maxLength: 8,
            decoration: const InputDecoration(
              labelText: '보호자 초대 코드',
              hintText: '예: AB12CD34',
              border: OutlineInputBorder(),
            ),
          ),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: kDanger)),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _loading ? null : _register,
            child: Text(_loading ? '가입 중...' : '회원가입'),
          ),
        ],
      ),
    );
  }
}
