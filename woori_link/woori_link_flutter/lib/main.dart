import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'firebase_options.dart';
import 'screens/login_screen.dart';
import 'screens/main_screen.dart';
import 'services/auth_service.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (error) {
    // Keep the existing app available even when Firebase configuration fails.
    debugPrint('Firebase initialization failed: $error');
  }

  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    // The chat screen will show a friendly setup message if no API key exists.
  }
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
