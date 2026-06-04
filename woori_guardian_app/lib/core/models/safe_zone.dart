class SafeZone {
  final int    id;
  final String name;
  final String address;
  final double centerLatitude;
  final double centerLongitude;
  final int    radiusMeters;

  const SafeZone({
    required this.id,
    required this.name,
    required this.address,
    required this.centerLatitude,
    required this.centerLongitude,
    required this.radiusMeters,
  });

  factory SafeZone.fromJson(Map<String, dynamic> j) => SafeZone(
    id:               j['id']              as int,
    name:             j['name']            as String? ?? '',
    address:          j['address']         as String? ?? '',
    centerLatitude:   (j['centerLatitude']  as num).toDouble(),
    centerLongitude:  (j['centerLongitude'] as num).toDouble(),
    radiusMeters:     (j['radiusMeters']    as num).toInt(),
  );

  Map<String, dynamic> toJson() => {
    'name':             name,
    'address':          address,
    'centerLatitude':   centerLatitude,
    'centerLongitude':  centerLongitude,
    'radiusMeters':     radiusMeters,
  };

  SafeZone copyWith({
    String? name,
    String? address,
    double? centerLatitude,
    double? centerLongitude,
    int?    radiusMeters,
  }) => SafeZone(
    id:               id,
    name:             name             ?? this.name,
    address:          address          ?? this.address,
    centerLatitude:   centerLatitude   ?? this.centerLatitude,
    centerLongitude:  centerLongitude  ?? this.centerLongitude,
    radiusMeters:     radiusMeters     ?? this.radiusMeters,
  );
}
