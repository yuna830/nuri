import 'package:flutter_test/flutter_test.dart';
import 'package:woori_senior_app/main.dart';

void main() {
  testWidgets('앱 smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const WooriSeniorApp());
  });
}
