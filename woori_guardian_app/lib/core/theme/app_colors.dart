import 'package:flutter/material.dart';

/// 보호자 앱 공통 색상 팔레트.
/// 색상 값은 이 파일에서만 정의하고, 각 화면은 이 값을 참조한다.
/// 여기서 값을 바꾸면 앱 전체에 일괄 반영된다.
abstract final class AppColors {
  // ── 브랜드 ──────────────────────────────────────────────
  /// 브랜드 그린 — AppBar·메인 버튼·포인트 색
  static const green = Color(0xFF86A788);
  static const greenBg = Color(0xFFEBF8EE);

  // ── 텍스트 ──────────────────────────────────────────────
  static const textMain = Color(0xFF1C1C1E);
  static const textSub = Color(0xFF6C6C70);
  static const textHint = Color(0xFFAEAEB2);
  static const iconGray = Color(0xFF8E8E93);
  static const iconBg = Color(0xFFF0F0F2);

  // ── 상태 ────────────────────────────────────────────────
  static const safe = Color(0xFF4A7A4C);
  static const safeBg = Color(0xFFEEF5EE);
  static const warn = Color(0xFFC47F25);
  static const warnBg = Color(0xFFFFF4E5);
  static const red = Color(0xFFB85252);
  static const redBg = Color(0xFFF5EAEA);
  static const neutral = Color(0xFF6C6C70);
  static const neutralBg = Color(0xFFF2F2F7);
  static const blue = Color(0xFF1565C0);
  static const blueBg = Color(0xFFE3F2FD);

  // ── 면 / 구분선 ─────────────────────────────────────────
  static const divider = Color(0xFFE5E5EA);
  static const modalBg = Color(0xFFF5F5F5);

  /// 모달 취소 버튼 등에 쓰는 베이지 면 색
  static const surfaceBeige = Color(0xFFF6F5F3);
}
