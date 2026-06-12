import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:kakao_map_sdk/kakao_map_sdk.dart';

import 'core/storage/guardian_session_storage.dart';
import 'core/theme/app_colors.dart';
import 'features/auth/guardian_login_screen.dart';
import 'features/home/guardian_home_screen.dart';

const _disableKakaoMap = bool.fromEnvironment('DISABLE_KAKAO_MAP');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await dotenv.load(fileName: '.env').catchError((_) {
    debugPrint('[AppConfig] .env file not found. Continuing with defaults.');
  });

  if (!_disableKakaoMap) {
    await KakaoMapSdk.instance.initialize(
      dotenv.env['KAKAO_NATIVE_APP_KEY'] ?? '',
    );
  }

  final sessionStorage = GuardianSessionStorage();
  final userInfo = await sessionStorage.getGuardianInfo();
  final guardianId = userInfo['guardianId'];
  final hasSession = guardianId != null && guardianId.trim().isNotEmpty;

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
        colorScheme: ColorScheme.fromSeed(seedColor: AppColors.green),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF6F5F3),
      ),
      locale: const Locale('ko', 'KR'),
      supportedLocales: const [Locale('ko', 'KR'), Locale('en', 'US')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      home: hasSession
          ? const GuardianHomeScreen()
          : const GuardianLoginScreen(),
    );
  }
}
