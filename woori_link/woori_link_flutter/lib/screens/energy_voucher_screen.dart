import 'package:flutter/material.dart';
import '../api/senior_api.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class EnergyVoucherScreen extends StatefulWidget {
  const EnergyVoucherScreen({super.key});

  @override
  State<EnergyVoucherScreen> createState() => _EnergyVoucherScreenState();
}

class _EnergyVoucherScreenState extends State<EnergyVoucherScreen> {
  Map<String, dynamic>? _senior;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) return;
      final data = await SeniorApi.getSenior(seniorId);
      setState(() { _senior = data; _loading = false; });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _apply(String field) async {
    final seniorId = await AuthService.getUserId();
    if (seniorId == null) return;
    await SeniorApi.updateSenior(seniorId, {field: true});
    await _load();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('신청 완료되었습니다.'), backgroundColor: kPrimary),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final s = _senior;
    return Scaffold(
      appBar: AppBar(title: const Text('에너지 복지 서비스')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _voucherCard(
              title: '에너지바우처',
              icon: Icons.card_giftcard,
              description: '저소득층 님에게 에너지 사용 비용을 지원하는 바우처입니다.',
              applied: s?['energyVoucherApplied'] == true,
              onApply: () => _apply('energyVoucherApplied'),
            ),
            _voucherCard(
              title: '전기요금 할인',
              icon: Icons.bolt,
              description: '장애인·기초생활수급자 대상 전기요금 할인 혜택입니다.',
              applied: s?['electricityDiscountApplied'] == true,
              onApply: () => _apply('electricityDiscountApplied'),
            ),
            _voucherCard(
              title: '가스요금 할인',
              icon: Icons.local_fire_department,
              description: '도시가스 요금 경감 혜택 대상자 지원 서비스입니다.',
              applied: s?['gasDiscountApplied'] == true,
              onApply: () => _apply('gasDiscountApplied'),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kPrimaryLight),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text('신청 안내',
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                  SizedBox(height: 8),
                  Text('• 에너지바우처: 읍면동 주민센터 방문 또는 복지로(www.bokjiro.go.kr)',
                      style: TextStyle(fontSize: 12, color: kTextMuted)),
                  SizedBox(height: 4),
                  Text('• 전기/가스 할인: 해당 공사 고객센터 또는 담당 복지사를 통해 신청',
                      style: TextStyle(fontSize: 12, color: kTextMuted)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _voucherCard({
    required String title,
    required IconData icon,
    required String description,
    required bool applied,
    required VoidCallback onApply,
  }) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: kPrimary, size: 22),
                const SizedBox(width: 10),
                Text(title,
                    style: const TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
                const Spacer(),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: applied
                        ? kPrimary.withOpacity(0.1)
                        : kDanger.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    applied ? '신청완료' : '미신청',
                    style: TextStyle(
                        color: applied ? kPrimary : kDanger,
                        fontSize: 12,
                        fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(description,
                style: const TextStyle(fontSize: 13, color: kTextMuted)),
            if (!applied) ...[
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: onApply,
                  child: const Text('신청 완료로 표시'),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
