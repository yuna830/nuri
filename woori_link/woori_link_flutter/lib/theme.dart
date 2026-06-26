import 'package:flutter/material.dart';

const kPrimary = Color(0xFF86A788);
const kPrimaryDark = Color(0xFF6E8F70);
const kPrimaryLight = Color(0xFFEEF6EF);
const kDanger = Color(0xFFC93A32);
const kWarning = Color(0xFFD97706);
const kBg = Color(0xFFF1F5F9);
const kTextPrimary = Color(0xFF1E2A1F);
const kTextMuted = Color(0xFF94A3B8);
const kBorder = Color(0xFFE2E8F0);

ThemeData appTheme() {
  return ThemeData(
    colorScheme: ColorScheme.fromSeed(
      seedColor: kPrimary,
      primary: kPrimary,
      surface: Colors.white,
    ),
    scaffoldBackgroundColor: kBg,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: kTextPrimary,
      elevation: 0,
      titleTextStyle: TextStyle(
        color: kTextPrimary,
        fontSize: 17,
        fontWeight: FontWeight.w800,
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Colors.white,
      selectedItemColor: kPrimary,
      unselectedItemColor: kTextMuted,
      type: BottomNavigationBarType.fixed,
      elevation: 8,
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
      ),
    ),
    cardTheme: CardTheme(
      color: Colors.white,
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.only(bottom: 12),
    ),
    useMaterial3: true,
  );
}
