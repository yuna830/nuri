import 'package:flutter/material.dart';

import 'core/storage/senior_session_storage.dart';
import 'features/auth/login_screen.dart';
import 'features/shell/app_shell.dart';

void main() {
  runApp(const WooriSeniorApp());
}

class WooriSeniorApp extends StatelessWidget {
  const WooriSeniorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '우리 woori',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFFFFDEC),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF86A788),
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