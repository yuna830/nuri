class Senior {
  final int id;
  final String name;
  final String phone;
  final String emergencyPhone;
  final String region;
  final String status;
  final String lastLocationAddress;
  final String lastLocationTime;

  // 기본 정보
  final int? age;
  final String? gender;
  final String? disabilityType;

  // 건강 정보 (healthInfo)
  final String? healthStatus;
  final String? medicineCount;
  final List<String> keyDiseases; // 주요 질환 목록

  Senior({
    required this.id,
    required this.name,
    required this.phone,
    this.emergencyPhone = '',
    required this.region,
    required this.status,
    required this.lastLocationAddress,
    required this.lastLocationTime,
    this.age,
    this.gender,
    this.disabilityType,
    this.healthStatus,
    this.medicineCount,
    this.keyDiseases = const [],
  });

  factory Senior.fromJson(Map<String, dynamic> json) {
    final seniorObj = json['senior'] ?? {};
    final lastGpsObj = json['lastGps'];
    final healthObj = json['healthInfo'];

    // ── 기본 상태 ──────────────────────────────────────
    final name = seniorObj['name'] as String? ?? '알 수 없음';
    final active = seniorObj['active'] == true;
    final status = active ? '안전' : '주의';

    // ── 마지막 위치 ────────────────────────────────────
    String lastAddr = '위치 정보 없음';
    String lastTime = '-';

    if (lastGpsObj != null) {
      lastAddr = lastGpsObj['address'] as String? ?? '위치 정보 없음';
      final receivedAt = lastGpsObj['receivedAt'];
      if (receivedAt != null) {
        lastTime = receivedAt.toString().replaceAll('T', ' ');
        if (lastTime.length > 16) lastTime = lastTime.substring(0, 16);
      }
    }

    // ── 건강 정보 (healthInfo) ─────────────────────────
    String? healthStatus;
    String? medicineCount;
    final diseases = <String>[];

    if (healthObj != null) {
      healthStatus = healthObj['healthStatus'] as String?;
      medicineCount = healthObj['medicineCount'] as String?;

      // "예" 값이 있는 질환만 표시
      if (_isYes(healthObj['diabetes'])) diseases.add('당뇨');
      if (_isYes(healthObj['hypertension'])) diseases.add('고혈압');
      if (_isYes(healthObj['heartDisease'])) diseases.add('심장질환');
      if (_isYes(healthObj['dementia'])) diseases.add('치매');
      if (_isYes(healthObj['stroke'])) diseases.add('뇌졸중');
      if (_isYes(healthObj['kidneyDisease'])) diseases.add('신장질환');
      if (_isYes(healthObj['lungDisease'])) diseases.add('폐질환');
      if (_isYes(healthObj['cancer'])) diseases.add('암');
    }

    return Senior(
      id: seniorObj['id'] as int? ?? 0,
      name: name,
      phone: seniorObj['phone'] as String? ?? '',
      emergencyPhone: seniorObj['emergencyPhone'] as String? ?? '',
      region: seniorObj['region'] as String? ?? seniorObj['address'] as String? ?? '',
      status: status,
      lastLocationAddress: lastAddr,
      lastLocationTime: lastTime,
      age: seniorObj['age'] as int?,
      gender: seniorObj['gender'] as String?,
      disabilityType: seniorObj['disabilityType'] as String?,
      healthStatus: healthStatus,
      medicineCount: medicineCount,
      keyDiseases: diseases,
    );
  }

  static bool _isYes(dynamic value) {
    if (value == null) return false;
    final s = value.toString().trim();
    return s == '예' || s == 'true' || s == '1' || s == 'yes';
  }
}
