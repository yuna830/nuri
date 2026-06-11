import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:kakao_map_plugin/kakao_map_plugin.dart';

import 'core/config/app_config.dart';
import 'core/push/fcm_service.dart';
import 'core/storage/senior_session_storage.dart';
import 'features/auth/login_screen.dart';
import 'features/shell/app_shell.dart';

const _disableKakaoMap = bool.fromEnvironment('DISABLE_KAKAO_MAP');

Future<void> main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

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

class LoginGate extends StatefulWidget {
  const LoginGate({super.key});

  @override
  State<LoginGate> createState() => _LoginGateState();
}

class _LoginGateState extends State<LoginGate> {
  late final Future<int?> _sessionFuture;

  @override
  void initState() {
    super.initState();
    _sessionFuture = _loadSession();
  }

  Future<int?> _loadSession() async {
    final seniorId = await SeniorSessionStorage.getSeniorId();
    if (seniorId != null) {
      await FcmService.init(role: 'SENIOR', userId: seniorId);
    }
    return seniorId;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<int?>(
      future: _sessionFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
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
