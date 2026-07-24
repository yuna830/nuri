import 'package:flutter/material.dart';
import '../api/care_monitoring_api.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class SosScreen extends StatefulWidget {
  const SosScreen({super.key});

  @override
  State<SosScreen> createState() => _SosScreenState();
}

class _SosScreenState extends State<SosScreen> {
  bool _sending = false;

  Future<void> _sendSos(String type, String description) async {
    setState(() => _sending = true);
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) throw Exception('No senior session');
      await CareMonitoringApi.reportSos(seniorId, description);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$type 신고가 접수되었습니다. 담당자에게 연락됩니다.'),
          backgroundColor: kDanger,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('신고 접수에 실패했습니다. 다시 시도해주세요.')),
      );
    } finally {
      setState(() => _sending = false);
    }
  }

  Future<void> _confirmSos(String type, String description) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.sos, color: kDanger),
            const SizedBox(width: 8),
            Text(type),
          ],
        ),
        content: Text('$type 신고를 접수하시겠습니까?\n\n담당 복지사와 보호자에게 즉시 알림이 전송됩니다.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('취소')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: kDanger),
            child: const Text('신고하기'),
          ),
        ],
      ),
    );
    if (yes == true) await _sendSos(type, description);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('SOS 신고')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: kDanger.withOpacity(0.06),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: kDanger.withOpacity(0.2)),
              ),
              child: const Column(
                children: [
                  Icon(Icons.sos, color: kDanger, size: 48),
                  SizedBox(height: 12),
                  Text(
                    '긴급 상황 신고',
                    style: TextStyle(
                        color: kDanger,
                        fontSize: 20,
                        fontWeight: FontWeight.w800),
                  ),
                  SizedBox(height: 8),
                  Text(
                    '아래 버튼을 눌러 담당 복지사와 보호자에게 즉시 알릴 수 있습니다.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: kTextMuted),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // SOS 버튼들
            _sosButton(
              icon: Icons.monitor_heart,
              label: '건강 이상',
              subtitle: '몸이 갑자기 불편할 때',
              color: const Color(0xFFDC2626),
              onTap: () => _confirmSos('건강 이상 신고', '님 건강 이상 신고'),
            ),
            _sosButton(
              icon: Icons.fire_truck,
              label: '화재 / 가스 누출',
              subtitle: '불이나 가스 냄새가 날 때',
              color: kWarning,
              onTap: () => _confirmSos('화재/가스 신고', '화재 또는 가스 누출 신고'),
            ),
            _sosButton(
              icon: Icons.help_outline,
              label: '기타 도움 요청',
              subtitle: '그 외 도움이 필요할 때',
              color: kPrimary,
              onTap: () => _confirmSos('도움 요청', '기타 도움 요청'),
            ),

            if (_sending) ...[
              const SizedBox(height: 24),
              const Center(child: CircularProgressIndicator(color: kDanger)),
            ],

            const Spacer(),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: kBg,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, color: kTextMuted, size: 18),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '신고 내용은 담당 복지사와 보호자에게 즉시 전달됩니다. 실제 응급 상황에서는 119에도 전화해 주세요.',
                      style: TextStyle(fontSize: 12, color: kTextMuted),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sosButton({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: _sending ? null : onTap,
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: color.withOpacity(0.2)),
            ),
            child: Row(
              children: [
                Icon(icon, color: color, size: 28),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: TextStyle(
                            color: color,
                            fontSize: 16,
                            fontWeight: FontWeight.w700)),
                    Text(subtitle,
                        style:
                            const TextStyle(fontSize: 12, color: kTextMuted)),
                  ],
                ),
                const Spacer(),
                Icon(Icons.chevron_right, color: color.withOpacity(0.5)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
