class AlertModel {
  final int id;
  final int? seniorId;
  final int? guardianId;
  final String type;
  final String title;
  final String message;
  final bool isRead;
  final DateTime? createdAt;
  final double? latitude;
  final double? longitude;

  AlertModel({
    required this.id,
    this.seniorId,
    this.guardianId,
    required this.type,
    required this.title,
    required this.message,
    required this.isRead,
    this.createdAt,
    this.latitude,
    this.longitude,
  });

  factory AlertModel.fromJson(Map<String, dynamic> json) {
    return AlertModel(
      id: json['id'] as int,
      seniorId: json['seniorId'] as int?,
      guardianId: json['guardianId'] as int?,
      type: json['type'] as String? ?? 'UNKNOWN',
      title: json['title'] as String? ?? '알림',
      message: json['message'] as String? ?? '',
      isRead: json['isRead'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
    );
  }

  AlertModel copyWith({bool? isRead}) {
    return AlertModel(
      id: id,
      seniorId: seniorId,
      guardianId: guardianId,
      type: type,
      title: title,
      message: message,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
      latitude: latitude,
      longitude: longitude,
    );
  }
}
