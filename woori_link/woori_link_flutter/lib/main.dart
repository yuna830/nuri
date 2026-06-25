import 'package:flutter/material.dart';
import 'screens/login_screen.dart';
import 'screens/main_screen.dart';
import 'services/auth_service.dart';
import 'theme.dart';

void main() {
  runApp(const WooriLinkApp());
}

class WooriLinkApp extends StatelessWidget {
  const WooriLinkApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '우리 LINK',
      theme: appTheme(),
      home: const SplashRouter(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class SplashRouter extends StatefulWidget {
  const SplashRouter({super.key});

  @override
  State<SplashRouter> createState() => _SplashRouterState();
}

class _SplashRouterState extends State<SplashRouter> {
  @override
  void initState() {
    super.initState();
    _route();
  }

  Future<void> _route() async {
    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    final loggedIn = await AuthService.isLoggedIn();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(
        builder: (_) => loggedIn ? const MainScreen() : const LoginScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
