import 'dart:convert';

class Senior {
  final int id;
  final String name;
  final String phone;
  final String emergencyPhone;
  final String region;
  final String status;
  final String lastLocationAddress;
  final String lastLocationTime;

  // 마지막 GPS 수신 시각 원본 — 위치 신선도(미접속) 판단에 사용합니다.
  final DateTime? lastLocationAt;

  // 프로필/담당자 정보: 상세 화면 상단과 기본 정보 영역에 표시합니다.
  final String profileImageUrl;
  final String socialWorkerName;
  final String socialWorkerPhone;

  // 기본 정보: 보호 대상자의 인적 정보를 표시합니다.
  final int? age;
  final String? gender;
  final String? disabilityType;
  final String disabilityGrade;

  // 복약 정보: DB에서 내려온 복약 수와 복용 약 목록을 표시합니다.
  final String? medicineCount;
  final List<String> medications;

  // 복지 정보: 보호 대상자가 신청한 일자리와 복지사 상담 요청 상태를 표시합니다.
  final String jobApplicationStatus;
  final String counselRequestStatus;
  final String incomeLevel;
  final String householdType;
  final String hopeJobType;
  final String hopeCondition;
  final String hopeDays;

  // 건강/돌봄 참고 정보: 복지사 화면에서 필요한 주의 항목과 활동 조건을 표시합니다.
  final String? healthStatus;
  final List<String> keyDiseases;
  final List<String> cautionItems;
  final String activityCondition;

  Senior({
    required this.id,
    required this.name,
    required this.phone,
    this.emergencyPhone = '',
    required this.region,
    required this.status,
    required this.lastLocationAddress,
    required this.lastLocationTime,
    this.lastLocationAt,
    this.profileImageUrl = '',
    this.socialWorkerName = '-',
    this.socialWorkerPhone = '-',
    this.age,
    this.gender,
    this.disabilityType,
    this.disabilityGrade = '-',
    this.medicineCount,
    this.medications = const [],
    this.jobApplicationStatus = '-',
    this.counselRequestStatus = '-',
    this.healthStatus,
    this.keyDiseases = const [],
    this.cautionItems = const [],
    this.activityCondition = '-',
    this.incomeLevel = '-',
    this.householdType = '-',
    this.hopeJobType = '-',
    this.hopeCondition = '-',
    this.hopeDays = '-',
  });

  factory Senior.fromJson(Map<String, dynamic> json) {
    final seniorObj = _asMap(json['senior']);
    final lastGpsObj = _asMap(json['lastGps']);
    final healthObj = _asMap(json['healthInfo']);
    final welfareObj = _asMap(json['welfareInfo']);
    final socialWorkerObj = _asMap(json['socialWorker']);

    // 기본 상태: 백엔드 active 값으로 홈/상세 화면의 상태 배지를 만듭니다.
    final name = _readString(seniorObj, ['name'], fallback: '이름 없음');
    final active = seniorObj['active'] == true;
    final locationStatus = _readString(json, ['locationStatus']);
    final status = locationStatus.contains('이탈')
        ? '이탈'
        : active
        ? '안전'
        : '주의';

    // 위치 정보: 마지막 GPS가 없을 때도 화면이 깨지지 않도록 기본 문구를 둡니다.
    var lastAddress = '위치 정보 없음';
    var lastTime = '-';
    DateTime? lastAt;

    if (lastGpsObj.isNotEmpty) {
      lastAddress = _readString(lastGpsObj, [
        'address',
        'roadAddress',
      ], fallback: '위치 정보 없음');

      final receivedAt = lastGpsObj['receivedAt'];
      if (receivedAt != null) {
        lastTime = receivedAt.toString().replaceAll('T', ' ');
        if (lastTime.length > 16) lastTime = lastTime.substring(0, 16);
        lastAt = DateTime.tryParse(receivedAt.toString());
      }
    }

    // 질환 정보: 기존 카드/연락 화면에서 쓰는 주요 질환 목록을 유지합니다.
    final diseases = <String>[];
    if (healthObj.isNotEmpty) {
      if (_isYes(healthObj['diabetes'])) diseases.add('당뇨');
      if (_isYes(healthObj['hypertension'])) diseases.add('고혈압');
      if (_isYes(healthObj['heartDisease'])) diseases.add('심장질환');
      if (_isYes(healthObj['dementia'])) diseases.add('치매');
      if (_isYes(healthObj['stroke'])) diseases.add('뇌졸중');
      if (_isYes(healthObj['kidneyDisease'])) diseases.add('신장질환');
      if (_isYes(healthObj['lungDisease'])) diseases.add('폐질환');
      if (_isYes(healthObj['cancer'])) diseases.add('암');
    }

    // 복지
    final jobPreferenceObj = _asMap(json['jobPreference']);

    return Senior(
      id: _readInt(seniorObj, ['id']),
      name: name,
      phone: _readString(seniorObj, ['phone']),
      emergencyPhone: _readString(seniorObj, ['emergencyPhone']),
      region: _readString(seniorObj, ['region', 'address']),
      status: status,
      lastLocationAddress: lastAddress,
      lastLocationTime: lastTime,
      lastLocationAt: lastAt,
      profileImageUrl: _readString(
        seniorObj,
        [
          'profileImageUrl',
          'profileImage',
          'photoUrl',
          'imageUrl',
          'imagePath',
        ],
        fallback: _readString(json, [
          'profileImageUrl',
          'profileImage',
          'photoUrl',
          'imageUrl',
          'imagePath',
        ]),
      ),
      socialWorkerName: _readString(
        socialWorkerObj,
        ['name'],
        fallback: _readString(
          seniorObj,
          ['socialWorkerName', 'workerName', 'managerName'],
          fallback: _readString(json, [
            'socialWorkerName',
            'workerName',
            'managerName',
          ], fallback: '-'),
        ),
      ),
      socialWorkerPhone: _readString(
        socialWorkerObj,
        ['phone', 'phoneNumber'],
        fallback: _readString(
          seniorObj,
          ['socialWorkerPhone', 'workerPhone', 'managerPhone'],
          fallback: _readString(json, [
            'socialWorkerPhone',
            'workerPhone',
            'managerPhone',
          ], fallback: '-'),
        ),
      ),
      age: _readNullableInt(seniorObj, ['age']),
      gender: _readNullableString(seniorObj, ['gender']),
      disabilityType: _readNullableString(seniorObj, [
        'disabilityType',
      ], fallback: _readNullableString(healthObj, ['disabilityType'])),
      disabilityGrade: _readString(healthObj, [
        'disabilityGrade',
      ], fallback: _readString(seniorObj, ['disabilityGrade'], fallback: '-')),
      healthStatus: _readNullableString(healthObj, ['healthStatus']),
      medicineCount: _readNullableString(healthObj, ['medicineCount']),
      medications: _parseStringList(
        healthObj['medicationsJson'] ??
            healthObj['medications'] ??
            healthObj['medicineList'] ??
            healthObj['medicineNames'] ??
            json['medicationsJson'] ??
            json['medications'],
      ),
      jobApplicationStatus: _readString(
        welfareObj,
        ['jobApplicationStatus', 'jobStatus'],
        fallback: _readString(json, [
          'jobApplicationStatus',
          'jobStatus',
        ], fallback: '-'),
      ),
      counselRequestStatus: _readString(
        welfareObj,
        ['counselRequestStatus', 'counselStatus', 'consultationStatus'],
        fallback: _readString(json, [
          'counselRequestStatus',
          'counselStatus',
          'consultationStatus',
        ], fallback: '-'),
      ),
      incomeLevel: _readString(healthObj, ['incomeLevel'], fallback: '-'),
      householdType: _readString(healthObj, ['householdType'], fallback: '-'),
      hopeJobType: _readString(jobPreferenceObj, [
        'hopeJobType',
      ], fallback: '-'),
      hopeCondition: _readString(jobPreferenceObj, [
        'hopeCondition',
      ], fallback: '-'),
      hopeDays: _readString(jobPreferenceObj, ['hopeDays'], fallback: '-'),
      keyDiseases: diseases,
      cautionItems: _buildCautionItems(healthObj),
      activityCondition: _buildActivityCondition(healthObj),
    );
  }

  /// 마지막 GPS가 기준 시간보다 오래됐거나 아예 없으면 '미접속'으로 본다.
  bool isLocationStale(int staleHours) {
    if (lastLocationAt == null) return true;
    return DateTime.now().difference(lastLocationAt!) >=
        Duration(hours: staleHours);
  }

  /// "3시간 전" 같은 상대 시간 문구. GPS 기록이 없으면 '기록 없음'.
  String get lastLocationAgoText {
    if (lastLocationAt == null) return '기록 없음';
    final diff = DateTime.now().difference(lastLocationAt!);
    if (diff.inMinutes < 1) return '방금 전';
    if (diff.inMinutes < 60) return '${diff.inMinutes}분 전';
    if (diff.inHours < 24) return '${diff.inHours}시간 전';
    return '${diff.inDays}일 전';
  }

  static Map<String, dynamic> _asMap(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  static String _readString(
    Map<String, dynamic> source,
    List<String> keys, {
    String fallback = '',
  }) {
    for (final key in keys) {
      final value = source[key];
      if (value == null) continue;
      final text = value.toString().trim();
      if (text.isNotEmpty) return text;
    }
    return fallback;
  }

  static String? _readNullableString(
    Map<String, dynamic> source,
    List<String> keys, {
    String? fallback,
  }) {
    final value = _readString(source, keys);
    if (value.isNotEmpty) return value;
    return fallback;
  }

  static int _readInt(Map<String, dynamic> source, List<String> keys) {
    return _readNullableInt(source, keys) ?? 0;
  }

  static int? _readNullableInt(Map<String, dynamic> source, List<String> keys) {
    for (final key in keys) {
      final value = source[key];
      if (value is int) return value;
      if (value is num) return value.toInt();
      if (value is String) {
        final parsed = int.tryParse(value.trim());
        if (parsed != null) return parsed;
      }
    }
    return null;
  }

  static bool _isYes(dynamic value) {
    if (value == null) return false;
    final text = value.toString().trim().toLowerCase();
    return text == '예' ||
        text == 'true' ||
        text == '1' ||
        text == 'yes' ||
        text == 'y';
  }

  static bool _hasHealthValue(dynamic value) {
    if (value == null) return false;
    final text = value.toString().trim();
    if (text.isEmpty) return false;
    return text != '없음' && text != '미입력' && text != '-';
  }

  static List<String> _buildCautionItems(Map<String, dynamic> healthObj) {
    final items = <String>[];

    void addIfPresent(String label, String key) {
      if (_hasHealthValue(healthObj[key])) items.add(label);
    }

    addIfPresent('당뇨', 'diabetes');
    addIfPresent('고혈압', 'hypertension');
    addIfPresent('심장질환', 'heartDisease');
    addIfPresent('관절질환', 'jointDisease');
    addIfPresent('뇌졸중', 'stroke');
    addIfPresent('신장질환', 'kidneyDisease');
    addIfPresent('호흡기질환', 'lungDisease');
    addIfPresent('간질환', 'liverDisease');
    addIfPresent('암', 'cancer');
    addIfPresent('보행 보조기구', 'walkingAid');
    addIfPresent('기억/판단', 'dementia');
    addIfPresent('시야', 'vision');
    addIfPresent('청각', 'hearing');
    addIfPresent('최근 낙상', 'recentFall');
    addIfPresent('수술 이력', 'hasSurgery');
    addIfPresent('수술 내용', 'surgeryDetail');
    addIfPresent('기타 참고사항', 'otherDisease');

    return items;
  }

  static String _buildActivityCondition(Map<String, dynamic> healthObj) {
    final maxHours = _readString(healthObj, ['maxHours']);
    final maxDistance = _readString(healthObj, ['maxDistance']);

    final lines = [
      if (_hasHealthValue(maxHours)) '하루 $maxHours시간 이내',
      if (_hasHealthValue(maxDistance)) maxDistance,
    ];

    return lines.isEmpty ? '-' : lines.join('\n');
  }

  static List<String> _parseStringList(dynamic value) {
    if (value == null) return [];

    String formatMedicine(dynamic item) {
      if (item is Map) {
        final name =
            (item['name'] ?? item['medicineName'] ?? item['title'] ?? '')
                .toString()
                .trim();
        final startDate = (item['startDate'] ?? '').toString().trim();

        if (name.isEmpty && startDate.isEmpty) return '';
        if (startDate.isEmpty) return name;
        if (name.isEmpty) return '$startDate부터';

        return '$name / $startDate부터';
      }

      return item.toString().trim();
    }

    if (value is List) {
      return value
          .map(formatMedicine)
          .where((item) => item.isNotEmpty)
          .toList();
    }

    final text = value.toString().trim();
    if (text.isEmpty) return [];

    if (text.startsWith('[')) {
      try {
        final parsed = jsonDecode(text);
        if (parsed is List) {
          return parsed
              .map(formatMedicine)
              .where((item) => item.isNotEmpty)
              .toList();
        }
      } catch (_) {}
    }

    return text
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }
}
