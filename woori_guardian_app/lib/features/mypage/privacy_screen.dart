import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

const _kGreen = AppColors.green;
const _kBg = Colors.white;
const _kDivider = AppColors.divider;
const _kTextMain = AppColors.textMain;
const _kTextSub = AppColors.textSub;

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        title: const Text('개인정보 처리 안내'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: const [
          Text(
            '우리는 이용자의 개인정보를 소중하게 다루며, 안전한 돌봄 서비스 제공에 필요한 최소한의 정보만 수집합니다.',
            style: TextStyle(fontSize: 13, color: _kTextSub, height: 1.6),
          ),
          SizedBox(height: 20),

          _Section(
            icon: Icons.folder_shared_outlined,
            title: '수집하는 개인정보',
            body: '보호자 이름, 이메일, 전화번호\n보호 대상자 이름, 전화번호, 위치 정보, 건강 정보',
          ),
          _Section(
            icon: Icons.flag_outlined,
            title: '수집 및 이용 목적',
            body: '보호 대상자 위치 확인 및 안전 모니터링\n긴급 상황 신고 및 복지 서비스 연계\n보호자-대상자 간 연락 지원',
          ),
          _Section(
            icon: Icons.schedule_outlined,
            title: '보유 및 이용 기간',
            body:
                '서비스 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다.\n단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.',
          ),
          _Section(
            icon: Icons.share_outlined,
            title: '제3자 제공',
            body:
                '수집된 개인정보는 원칙적으로 제3자에게 제공하지 않습니다.\n단, 긴급 구조 요청 시 관계 기관에 최소한의 정보가 제공될 수 있습니다.',
          ),
          _Section(
            icon: Icons.verified_user_outlined,
            title: '이용자 권리',
            body: '개인정보 열람, 수정, 삭제를 요청할 수 있습니다.\n앱 설정 또는 고객센터를 통해 신청해주세요.',
          ),
          _Section(
            icon: Icons.headset_mic_outlined,
            title: '문의',
            body: '개인정보 관련 문의는 앱 내 고객센터를 이용해주세요.',
            showDivider: false,
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final IconData icon;
  final String title;
  final String body;
  final bool showDivider;

  const _Section({
    required this.icon,
    required this.title,
    required this.body,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 16, color: AppColors.safe),
            const SizedBox(width: 7),
            Text(
              title,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: _kTextMain,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Padding(
          padding: const EdgeInsets.only(left: 23),
          child: Text(
            body,
            style: const TextStyle(
              fontSize: 13,
              color: _kTextSub,
              height: 1.65,
            ),
          ),
        ),
        if (showDivider) ...[
          const SizedBox(height: 16),
          const Divider(height: 1, color: _kDivider),
          const SizedBox(height: 16),
        ],
      ],
    );
  }
}
