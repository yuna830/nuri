import 'package:flutter/material.dart';

const int minJobAccessAge = 18;

int? calculateJobAccessAge(String? birthDate) {
  final value = birthDate?.trim() ?? '';
  if (value.isEmpty) return null;

  final birth = DateTime.tryParse(value);
  if (birth == null) return null;

  final now = DateTime.now();
  var age = now.year - birth.year;
  if (now.month < birth.month ||
      (now.month == birth.month && now.day < birth.day)) {
    age--;
  }
  return age;
}

int? _toAge(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toInt();
  final match = RegExp(r'\d+').firstMatch(value.toString());
  return match == null ? null : int.tryParse(match.group(0)!);
}

int? jobAccessAgeFromProfile(Map<String, dynamic> profile) {
  if (profile.isEmpty) return null;
  final birthDate = profile['birthDate'] ?? profile['birth_date'];
  return calculateJobAccessAge(birthDate?.toString()) ?? _toAge(profile['age']);
}

bool canAccessJobsByAge(int? age) => age == null || age >= minJobAccessAge;

class JobAgeGate extends StatelessWidget {
  const JobAgeGate({
    super.key,
    required this.age,
    this.card = true,
    this.padding = const EdgeInsets.all(24),
  });

  final int? age;
  final bool card;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final content = Padding(
      padding: padding,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🔒', style: TextStyle(fontSize: 54, height: 1)),
          const SizedBox(height: 26),
          const Text(
            '이용 연령 제한',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF1F2A20),
              fontSize: 24,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 18),
          const Text(
            '일자리 정보는 만 18세 이상(생일 기준)부터\n이용할 수 있어요.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Color(0xFF6F8F73),
              fontSize: 16,
              fontWeight: FontWeight.w600,
              height: 1.7,
            ),
          ),
          if (age != null) ...[
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 11),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF7EF),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '현재 만 $age세',
                style: const TextStyle(
                  color: Color(0xFF31563D),
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ],
      ),
    );

    if (!card) {
      return Center(child: content);
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 34),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: const Color(0xFFD4E8D6)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF86A788).withValues(alpha: 0.12),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: content,
          ),
        ),
      ),
    );
  }
}
