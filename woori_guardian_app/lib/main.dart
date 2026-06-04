import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:kakao_map_sdk/kakao_map_sdk.dart';

import 'features/auth/guardian_login_screen.dart';
import 'features/home/guardian_home_screen.dart';
import 'core/storage/guardian_session_storage.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // .env 로드 (.env가 없으면 경고만 출력하고 계속 진행)
  await dotenv.load(fileName: '.env').catchError((_) {
    debugPrint(
      '[AppConfig] .env 파일을 찾을 수 없습니다. .env.example을 복사해 .env를 만들어주세요.',
    );
  });

  // 카카오 맵 SDK 초기화
  await KakaoMapSdk.instance.initialize(
    dotenv.env['KAKAO_NATIVE_APP_KEY'] ?? '',
  );

  // final kakaoHashKey = await KakaoMapSdk.instance.hashKey();
  // debugPrint('[KAKAO] hashKey: $kakaoHashKey');

  final sessionStorage = GuardianSessionStorage();
  final userInfo = await sessionStorage.getGuardianInfo();
  final hasSession = userInfo['guardianId'] != null;

  runApp(WooriGuardianApp(hasSession: hasSession));
}

class WooriGuardianApp extends StatelessWidget {
  final bool hasSession;

  const WooriGuardianApp({super.key, required this.hasSession});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '우리 보호자 앱',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF86A788)),
        useMaterial3: true,
        // 배경: 아주 연한 웜그레이 — 카드(흰색)와 대비를 주면서 눈이 편한 색
        scaffoldBackgroundColor: const Color(0xFFF6F5F3),
      ),
      home: hasSession
          ? const GuardianHomeScreen()
          : const GuardianLoginScreen(),
    );
  }
}
