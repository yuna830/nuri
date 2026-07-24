import 'package:flutter/material.dart';

class AppTextScaleController {
  AppTextScaleController._();

  static final ValueNotifier<double> scale = ValueNotifier<double>(1.0);
  static const List<double> values = [1.0, 19 / 16, 22 / 16];

  static void next() {
    final currentIndex = values.indexOf(scale.value);
    scale.value = values[(currentIndex + 1) % values.length];
  }

  static void setScale(double value) {
    if (!values.contains(value)) return;
    scale.value = value;
  }

  static int get currentIndex {
    final index = values.indexOf(scale.value);
    return index < 0 ? 0 : index;
  }
}
