import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:kakao_map_plugin/kakao_map_plugin.dart';

import 'core/config/app_config.dart';
import 'core/storage/senior_session_storage.dart';
import 'features/auth/login_screen.dart';
import 'features/shell/app_shell.dart';

const _disableKakaoMap = bool.fromEnvironment('DISABLE_KAKAO_MAP');

Future<void> main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  await dotenv.load(fileName: '.env');

  if (!_disableKakaoMap) {
    AuthRepository.initialize(
      appKey: kakaoJavaScriptKey,
      baseUrl: 'http://localhost',
    );
  }

  FlutterNativeSplash.remove();
  runApp(const WooriSeniorApp());
}

class WooriSeniorApp extends StatelessWidget {
  const WooriSeniorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '우리 woori',
      debugShowCheckedModeBanner: false,
      locale: const Locale('ko', 'KR'),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('ko', 'KR'),
        Locale('en', 'US'),
      ],
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFFFDEC),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF86A788),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          hintStyle: TextStyle(color: Color(0xFFCECECE)),
        ),
      ),
      home: const LoginGate(),
    );
  }
}

class LoginGate extends StatelessWidget {
  const LoginGate({super.key});

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<int?>(
      future: SeniorSessionStorage.getSeniorId(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        final seniorId = snapshot.data;

        if (seniorId == null) {
          return const SeniorLoginScreen();
        }

        return AppShell(seniorId: seniorId);
      },
    );
  }
}
