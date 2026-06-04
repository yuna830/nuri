import 'package:flutter/material.dart';

// TODO: 보호자 정보 수정 API 연동 시 구현
// TODO: 백엔드 Guardian 엔티티에 address 필드 추가 후 수정 폼 완성

const _kGreen = Color(0xFF86A788);

class ProfileEditScreen extends StatelessWidget {
  const ProfileEditScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('정보 수정'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.edit_outlined, size: 48, color: Color(0xFFAEAEB2)),
              SizedBox(height: 16),
              Text(
                '보호자 정보 수정',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1C1C1E)),
              ),
              SizedBox(height: 8),
              Text(
                '해당 기능은 추후 제공될 예정입니다.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Color(0xFF6C6C70)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
