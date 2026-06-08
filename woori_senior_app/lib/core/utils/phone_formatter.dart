import 'package:flutter/services.dart';

/// 한국 전화번호 자동 하이픈 포매터
/// 010-XXXX-XXXX / 02-XXXX-XXXX 등
class PhoneNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final digits = newValue.text.replaceAll(RegExp(r'[^0-9]'), '');
    final formatted = _format(digits);
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }

  String _format(String digits) {
    if (digits.isEmpty) { return ''; }

    // 서울 지역번호 02
    if (digits.startsWith('02')) {
      if (digits.length <= 2) { return digits; }
      if (digits.length <= 5) { return '${digits.substring(0, 2)}-${digits.substring(2)}'; }
      if (digits.length <= 9) {
        return '${digits.substring(0, 2)}-${digits.substring(2, 5)}-${digits.substring(5)}';
      }
      return '${digits.substring(0, 2)}-${digits.substring(2, 6)}-${digits.substring(6, digits.length.clamp(0, 10))}';
    }

    // 휴대폰 010 (11자리: 010-XXXX-XXXX)
    if (digits.startsWith('010')) {
      if (digits.length <= 3) { return digits; }
      if (digits.length <= 7) { return '${digits.substring(0, 3)}-${digits.substring(3)}'; }
      return '${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7, digits.length.clamp(0, 11))}';
    }

    // 그 외 (011/016 등 구형 및 지역번호: 0XX-XXX-XXXX)
    if (digits.length <= 3) { return digits; }
    if (digits.length <= 6) { return '${digits.substring(0, 3)}-${digits.substring(3)}'; }
    if (digits.length <= 9) {
      return '${digits.substring(0, 3)}-${digits.substring(3, 6)}-${digits.substring(6)}';
    }
    return '${digits.substring(0, 3)}-${digits.substring(3, 7)}-${digits.substring(7, digits.length.clamp(0, 11))}';
  }
}
