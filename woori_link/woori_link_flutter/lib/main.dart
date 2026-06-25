import 'package:flutter/material.dart';
import 'screens/main_screen.dart';
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
      home: const MainScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}
