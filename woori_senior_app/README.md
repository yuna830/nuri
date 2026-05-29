flutter pub get
flutter run

그리고 API 주소는 코드에 고정하지 말고 지금처럼 --dart-define으로 주는 게 좋음
flutter run -d emulator-5554 --dart-define=API_BASE_URL=http://10.0.2.2:8080


실제 휴대폰 테스트면 PC IP로:
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:8080