import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';

import '../../core/api/guardian_api.dart';
import '../../core/config/app_config.dart';
import '../../core/models/alert.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';
import '../../core/theme/app_colors.dart';

const _kGreen = AppColors.green;
const _kTextTitle = AppColors.textMain;
const _kTextSub = AppColors.textSub;
const _kDivider = AppColors.divider;

class SeniorDetailScreen extends StatefulWidget {
  final Senior senior;

  const SeniorDetailScreen({super.key, required this.senior});

  @override
  State<SeniorDetailScreen> createState() => _SeniorDetailScreenState();
}

class _SeniorDetailScreenState extends State<SeniorDetailScreen> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();

  bool _isLoadingExtra = true;
  List<Map<String, dynamic>> _jobApplications = [];
  List<AlertModel> _consultRequests = [];
  int? _guardianId;

  Senior get senior => widget.senior;

  @override
  void initState() {
    super.initState();
    _loadExtraWelfareInfo();
  }

  Future<void> _loadExtraWelfareInfo() async {
    try {
      final session = await _sessionStorage.getGuardianInfo();
      final guardianId = int.tryParse(session['guardianId'] ?? '');

      final jobs = await _api.fetchSeniorJobApplications(senior.id);

      var consults = <AlertModel>[];
      if (guardianId != null) {
        final alerts = await _api.fetchGuardianAlerts(guardianId);
        consults = alerts
            .where(
              (alert) =>
                  alert.seniorId == senior.id &&
                  alert.type == 'WELFARE_CONSULT_REQUEST',
            )
            .toList();
      }

      if (!mounted) return;
      setState(() {
        _guardianId = guardianId; // ← 추가
        _jobApplications = jobs;
        _consultRequests = consults;
        _isLoadingExtra = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _isLoadingExtra = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text('${senior.name} 상세 정보'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          _ProfileHeader(senior: senior),
          const SizedBox(height: 20),

          // 얼굴 사전 등록 — 실종 신고 시 이 사진들이 얼굴 인식 비교 대상이 된다.
          _FacePhotoSection(seniorId: senior.id),
          const SizedBox(height: 14),

          _InfoSection(
            title: '기본 정보',
            children: [
              _InfoTile(label: '성별', value: senior.gender ?? '-'),
              _InfoTile(
                label: '지역',
                value: senior.region.isEmpty ? '-' : senior.region,
              ),
              _InfoTile(label: '담당 복지사', value: senior.socialWorkerName),
              _InfoTile(label: '복지사 연락처', value: senior.socialWorkerPhone),
            ],
          ),
          const SizedBox(height: 14),

          _InfoSection(
            title: '복약 정보',
            trailing: _MedicationAlertIconButton(senior: senior),
            children: [
              _InfoTile(label: '복약 수', value: senior.medicineCount ?? '-'),
              _InfoTile(
                label: '복용 약',
                value: senior.medications.isEmpty
                    ? '-'
                    : senior.medications.join('\n'),
              ),
            ],
          ),
          const SizedBox(height: 14),

          _InfoSection(
            title: '복지 정보',
            children: [
              _InfoTile(label: '소득 구분', value: _display(senior.incomeLevel)),
              _InfoTile(label: '가구 형태', value: _display(senior.householdType)),
              _InfoTile(label: '희망 일자리', value: _display(senior.hopeJobType)),
              _InfoTile(label: '희망 조건', value: _display(senior.hopeCondition)),
              _InfoTile(label: '희망 요일', value: _display(senior.hopeDays)),
            ],
          ),
          const SizedBox(height: 14),

          _InfoSection(title: '신청 일자리', children: _buildJobApplicationTiles()),
          const SizedBox(height: 14),

          _InfoSection(
            title: '상담 요청 내역',
            children: _buildConsultRequestTiles(),
          ),
          const SizedBox(height: 14),

          _InfoSection(
            title: '건강 정보',
            children: [
              _InfoTile(
                label: '주의 항목',
                value: senior.cautionItems.isEmpty
                    ? '-'
                    : senior.cautionItems.join(', '),
              ),
              _InfoTile(label: '활동 조건', value: senior.activityCondition),
              _InfoTile(label: '장애 등급', value: senior.disabilityGrade),
              _InfoTile(label: '장애 유형', value: senior.disabilityType ?? '-'),
            ],
          ),
          const SizedBox(height: 14),

          _InfoSection(
            title: '위치 정보',
            children: [
              _InfoTile(label: '마지막 위치', value: senior.lastLocationAddress),
              _InfoTile(label: '마지막 확인', value: senior.lastLocationTime),
            ],
          ),
        ],
      ),
    );
  }

  List<Widget> _buildJobApplicationTiles() {
    if (_isLoadingExtra) {
      return const [_InfoTile(label: '조회', value: '불러오는 중')];
    }

    if (_jobApplications.isEmpty) {
      return const [_InfoTile(label: '내역', value: '-')];
    }

    return _jobApplications.asMap().entries.map((entry) {
      final index = entry.key;
      final job = entry.value;

      final rawTitle = _readJobText(job, ['jobTitle'], fallback: '일자리명 없음');
      final title = _jobTitleWithoutParentheses(rawTitle);
      final subtitle = _jobTitleParenthesesText(rawTitle);
      final organization = _readJobText(job, ['organization', 'company']);
      final status = _readJobText(job, ['status']);
      final requestedAt = _readJobText(job, ['requestedAt']);
      final location = _readJobText(job, ['location']);
      final workTime = _readJobText(job, ['workTime']);
      final wage = _readJobText(job, ['wage']);

      final details = [
        if (organization.isNotEmpty) organization,
        if (requestedAt.isNotEmpty) requestedAt,
        if (location.isNotEmpty) location,
        if (workTime.isNotEmpty) workTime,
        if (wage.isNotEmpty) wage,
      ].join(' / ');

      return _JobApplicationTile(
        title: title,
        subtitle: subtitle,
        status: status,
        details: details.isEmpty ? '-' : details,
        showDivider: index < _jobApplications.length - 1,
      );
    }).toList();
  }

  Future<void> _respondConsult(AlertModel alert) async {
    if (_guardianId == null) return;

    final result =
        await showModalBottomSheet<({DateTime date, TimeOfDay time})>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (_) => const _ConsultScheduleSheet(),
        );
    if (result == null || !mounted) return;

    final scheduleAt =
        '${result.date.year}-${_pad(result.date.month)}-${_pad(result.date.day)} '
        '${_pad(result.time.hour)}:${_pad(result.time.minute)}';

    try {
      await _api.respondWelfareConsult(
        alertId: alert.id,
        responseType: '예약',
        scheduleAt: scheduleAt,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$scheduleAt 상담 일정을 복지사에게 전달했습니다.')),
        );
        _loadExtraWelfareInfo(); // 목록 새로고침
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
        );
      }
    }
  }

  String _pad(int n) => n.toString().padLeft(2, '0');

  List<Widget> _buildConsultRequestTiles() {
    if (_isLoadingExtra) {
      return const [_InfoTile(label: '조회', value: '불러오는 중')];
    }

    if (_consultRequests.isEmpty) {
      return const [_InfoTile(label: '내역', value: '-')];
    }

    return _consultRequests.asMap().entries.map((entry) {
      final index = entry.key;
      final alert = entry.value;
      final createdAt = alert.createdAt == null
          ? ''
          : alert.createdAt.toString().substring(0, 16);
      final message = alert.message.isEmpty ? alert.title : alert.message;

      // 응답 유형에 따라 상태 결정
      final responseType = alert.guardianResponseType;
      final scheduleAt = alert.guardianScheduleAt;

      String status;
      bool canSchedule = false;

      if (responseType == '즉시') {
        status = '즉시 상담 가능';
      } else if (responseType == '예약' && scheduleAt != null) {
        status = '$scheduleAt 예약';
      } else if (responseType == '예약') {
        status = '일정 예약 완료';
      } else {
        status = '응답 대기';
        canSchedule = true;
      }

      return _ConsultRequestTile(
        message: message,
        status: status,
        createdAt: createdAt,
        canSchedule: canSchedule, // ← 추가
        onSchedule:
            canSchedule // ← 추가
            ? () => _respondConsult(alert)
            : null,
        showDivider: index < _consultRequests.length - 1,
      );
    }).toList();
  }

  String _readJobText(
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

  String _display(String value) {
    final text = value.trim();
    return text.isEmpty ? '-' : text;
  }

  String _jobTitleWithoutParentheses(String title) {
    final text = title.trim();
    final withoutParentheses = text
        .replaceAll(RegExp(r'\s*\([^)]*\)\s*'), ' ')
        .trim();
    return withoutParentheses.replaceAll(RegExp(r'\s+'), ' ').trim();
  }

  String _jobTitleParenthesesText(String title) {
    final matches = RegExp(r'\(([^)]*)\)').allMatches(title);
    return matches
        .map((match) => (match.group(1) ?? '').trim())
        .where((text) => text.isNotEmpty)
        .join(' / ');
  }
}

class _ProfileHeader extends StatelessWidget {
  final Senior senior;

  const _ProfileHeader({required this.senior});

  @override
  Widget build(BuildContext context) {
    final isSafe = senior.status == '안전';
    final ageText = senior.age == null ? '' : ' (${senior.age}세)';

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFFF6FAF6),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE0E8E0)),
      ),
      child: Row(
        children: [
          _ProfilePhoto(senior: senior),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${senior.name}$ageText',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _kTextTitle,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  senior.phone.isEmpty ? '전화번호 없음' : senior.phone,
                  style: const TextStyle(
                    fontSize: 13,
                    color: _kTextSub,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: isSafe ? const Color(0xFFEEF5EE) : const Color(0xFFF5EAEA),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              senior.status,
              style: TextStyle(
                color: isSafe
                    ? const Color(0xFF4A7A4C)
                    : const Color(0xFFB85252),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfilePhoto extends StatelessWidget {
  final Senior senior;

  const _ProfilePhoto({required this.senior});

  @override
  Widget build(BuildContext context) {
    final imageUrl = _resolveProfileImageUrl(senior.profileImageUrl);

    return CircleAvatar(
      radius: 32,
      backgroundColor: const Color(0xFFEBF8EE),
      child: ClipOval(
        child: imageUrl.isEmpty
            ? _FallbackProfileInitial(name: senior.name)
            : Image.network(
                imageUrl,
                width: 64,
                height: 64,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) {
                  return _FallbackProfileInitial(name: senior.name);
                },
              ),
      ),
    );
  }
}

String _resolveProfileImageUrl(String rawUrl) {
  final imageUrl = rawUrl.trim();
  if (imageUrl.isEmpty) return '';

  final parsedImageUrl = Uri.tryParse(imageUrl);
  if (parsedImageUrl != null && parsedImageUrl.hasScheme) {
    return imageUrl;
  }

  final apiUri = Uri.tryParse(AppConfig.apiBaseUrl);
  if (apiUri == null) return imageUrl;

  final serverOrigin = apiUri
      .replace(path: '', queryParameters: null, fragment: null)
      .toString()
      .replaceFirst(RegExp(r'/$'), '');

  if (imageUrl.startsWith('/')) {
    return '$serverOrigin$imageUrl';
  }

  return '$serverOrigin/$imageUrl';
}

class _FallbackProfileInitial extends StatelessWidget {
  final String name;

  const _FallbackProfileInitial({required this.name});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 64,
      height: 64,
      child: Center(
        child: Text(
          name.isNotEmpty ? name[0] : '?',
          style: const TextStyle(
            color: _kGreen,
            fontSize: 22,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}

class _InfoSection extends StatelessWidget {
  final String title;
  final List<Widget> children;
  final Widget? trailing;

  const _InfoSection({
    required this.title,
    required this.children,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
      decoration: BoxDecoration(
        border: Border.all(color: _kDivider),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: _kTextTitle,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          const SizedBox(height: 8),
          ...children,
        ],
      ),
    );
  }
}

// ── 얼굴 사진 관리 ───────────────────────────────────────────────────────────
// 보호자가 평소에 사용자 얼굴 사진을 등록해두는 섹션.
// 실종 신고가 접수되면 face_api가 이 사진들을 비교 대상으로 사용한다.
class _FacePhotoSection extends StatefulWidget {
  final int seniorId;

  const _FacePhotoSection({required this.seniorId});

  @override
  State<_FacePhotoSection> createState() => _FacePhotoSectionState();
}

class _FacePhotoSectionState extends State<_FacePhotoSection> {
  final _picker = ImagePicker();

  List<Map<String, dynamic>> _photos = [];
  bool _loading = true;
  bool _busy = false;

  static String get _serverBase =>
      AppConfig.apiBaseUrl.replaceAll(RegExp(r'/api$'), '');

  String _resolveUrl(String url) =>
      url.startsWith('http') ? url : '$_serverBase$url';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final response = await http
          .get(
            Uri.parse(
              '${AppConfig.apiBaseUrl}/seniors/${widget.seniorId}/face-photos',
            ),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(utf8.decode(response.bodyBytes));
        if (data is List) {
          _photos = data
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList();
        }
      }
    } catch (_) {}

    if (mounted) setState(() => _loading = false);
  }

  void _snack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  static const _maxPhotos = 4;

  Future<void> _addPhoto() async {
    if (_busy) return;

    if (_photos.length >= _maxPhotos) {
      _snack('얼굴 사진은 최대 $_maxPhotos장까지 등록할 수 있습니다.');
      return;
    }

    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined, color: _kGreen),
              title: const Text('카메라로 촬영'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_outlined, color: _kGreen),
              title: const Text('갤러리에서 선택'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
    if (source == null) return;

    final picked = await _picker.pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 1280,
    );
    if (picked == null) return;

    setState(() => _busy = true);

    try {
      // ① 사진 업로드
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${AppConfig.apiBaseUrl}/uploads/senior-faces'),
      );
      request.files.add(
        await http.MultipartFile.fromPath('image', picked.path),
      );
      final uploadResponse = await request.send().timeout(
        const Duration(seconds: 15),
      );
      final uploadBody = await uploadResponse.stream.bytesToString();

      if (uploadResponse.statusCode != 200) {
        throw Exception('upload failed');
      }

      final imageUrl = (jsonDecode(uploadBody)
              as Map<String, dynamic>)['imageUrl']
          ?.toString();

      if (imageUrl == null || imageUrl.isEmpty) {
        throw Exception('no imageUrl');
      }

      // ② 얼굴 사진으로 등록 (서버가 face_api reload까지 수행)
      final saveResponse = await http
          .post(
            Uri.parse(
              '${AppConfig.apiBaseUrl}/seniors/${widget.seniorId}/face-photos',
            ),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'imageUrl': imageUrl}),
          )
          .timeout(const Duration(seconds: 10));

      if (saveResponse.statusCode != 200) {
        throw Exception('save failed');
      }

      await _load();
      _snack('얼굴 사진이 등록되었습니다.');
    } catch (_) {
      // 응답 지연 등으로 실패 처리됐어도 실제로는 저장됐을 수 있으므로 목록을 다시 확인
      await _load();
      _snack('얼굴 사진 등록에 실패했습니다. 목록을 확인해주세요.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _deletePhoto(Map<String, dynamic> photo) async {
    final photoId = photo['id'];
    if (photoId == null || _busy) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                '얼굴 사진 삭제',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: _kTextTitle,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '이 사진을 삭제하시겠습니까?',
                style: TextStyle(fontSize: 13, color: _kTextSub),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surfaceBeige,
                        foregroundColor: _kTextSub,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('닫기', style: TextStyle(fontSize: 13)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.red,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('삭제', style: TextStyle(fontSize: 13)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);

    try {
      final response = await http
          .delete(
            Uri.parse('${AppConfig.apiBaseUrl}/seniors/face-photos/$photoId'),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception('delete failed');
      }

      await _load();
      _snack('얼굴 사진이 삭제되었습니다.');
    } catch (_) {
      _snack('얼굴 사진 삭제에 실패했습니다.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isFull = _photos.length >= _maxPhotos;

    return _InfoSection(
      title: '얼굴 사진 관리 (${_photos.length}/$_maxPhotos)',
      trailing: TextButton.icon(
        onPressed: _busy || isFull ? null : _addPhoto,
        icon: const Icon(Icons.add_a_photo_outlined, size: 16),
        label: const Text('추가', style: TextStyle(fontSize: 13)),
        style: TextButton.styleFrom(foregroundColor: _kGreen),
      ),
      children: [
        const Text(
          '등록한 사진은 실종 신고 시 얼굴 인식 비교에 사용됩니다. \n 정면 사진을 여러 장 등록할수록 정확도가 올라갑니다.',
          style: TextStyle(fontSize: 12, color: _kTextSub, height: 1.4),
        ),
        const SizedBox(height: 10),
        if (_loading)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(
              child: CircularProgressIndicator(color: _kGreen, strokeWidth: 2),
            ),
          )
        else if (_photos.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Text(
              '등록된 얼굴 사진이 없습니다.',
              style: TextStyle(fontSize: 13, color: _kTextSub),
            ),
          )
        else
          SizedBox(
            height: 86,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _photos.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) {
                final photo = _photos[i];
                final url = photo['imageUrl']?.toString() ?? '';

                return Stack(
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        width: 78,
                        height: 78,
                        color: const Color(0xFFF2F2F2),
                        child: url.isEmpty
                            ? const Icon(
                                Icons.broken_image_outlined,
                                color: _kTextSub,
                              )
                            : Image.network(
                                _resolveUrl(url),
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => const Icon(
                                  Icons.broken_image_outlined,
                                  color: _kTextSub,
                                ),
                              ),
                      ),
                    ),
                    Positioned(
                      top: 2,
                      right: 2,
                      child: GestureDetector(
                        onTap: () => _deletePhoto(photo),
                        child: Container(
                          width: 20,
                          height: 20,
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.55),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close,
                            size: 13,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        const SizedBox(height: 6),
      ],
    );
  }
}

class _JobApplicationTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final String status;
  final String details;
  final bool showDivider;

  const _JobApplicationTile({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.details,
    this.showDivider = true,
  });

  @override
  Widget build(BuildContext context) {
    final hasStatus = status.trim().isNotEmpty;

    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    color: _kTextTitle,
                    fontWeight: FontWeight.w800,
                    height: 1.35,
                  ),
                ),
              ),
              if (hasStatus) ...[
                const SizedBox(width: 8),
                _StatusPill(text: status),
              ],
            ],
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              subtitle,
              style: const TextStyle(
                fontSize: 12.5,
                color: _kTextSub,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ],
          const SizedBox(height: 5),
          Text(
            details,
            style: const TextStyle(
              fontSize: 12.5,
              color: _kTextSub,
              fontWeight: FontWeight.w600,
              height: 1.45,
            ),
          ),
          if (showDivider) ...[
            const SizedBox(height: 10),
            const Divider(color: _kDivider, height: 1),
          ],
        ],
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  final String text;

  const _StatusPill({required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 82),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFEEF5EE),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 11,
          color: Color(0xFF4A7A4C),
          fontWeight: FontWeight.w800,
          height: 1.1,
        ),
      ),
    );
  }
}

// ── 상담 일정 선택 바텀시트 ──────────────────────────────────────────────
class _ConsultScheduleSheet extends StatefulWidget {
  const _ConsultScheduleSheet();

  @override
  State<_ConsultScheduleSheet> createState() => _ConsultScheduleSheetState();
}

class _ConsultScheduleSheetState extends State<_ConsultScheduleSheet> {
  late DateTime _date;
  int _hour = 10;
  int _minute = 0;

  @override
  void initState() {
    super.initState();
    _date = DateTime.now().add(const Duration(days: 1));
  }

  String get _dateLabel => '${_date.year}년 ${_date.month}월 ${_date.day}일';

  String get _timeLabel =>
      '${_hour.toString().padLeft(2, '0')}:${_minute.toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: EdgeInsets.fromLTRB(
        0,
        12,
        0,
        MediaQuery.of(context).padding.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 36,
            height: 4,
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text(
                '상담 일정 선택',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          SizedBox(
            height: 260,
            child: Theme(
              data: Theme.of(context).copyWith(
                colorScheme: const ColorScheme.light(primary: _kGreen),
              ),
              child: CalendarDatePicker(
                initialDate: _date,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(const Duration(days: 60)),
                onDateChanged: (date) => setState(() => _date = date),
              ),
            ),
          ),
          const Divider(height: 1),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              children: [
                const Text(
                  '시간',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: _kTextTitle,
                  ),
                ),
                const Spacer(),
                _PickerDropdown(
                  value: _hour,
                  items: List.generate(24, (i) => i),
                  label: (v) => '${v}시',
                  onChanged: (v) => setState(() => _hour = v),
                ),
                const SizedBox(width: 8),
                _PickerDropdown(
                  value: _minute,
                  items: [0, 10, 20, 30, 40, 50],
                  label: (v) => '${v.toString().padLeft(2, '0')}분',
                  onChanged: (v) => setState(() => _minute = v),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: FilledButton(
              onPressed: () => Navigator.pop(context, (
                date: _date,
                time: TimeOfDay(hour: _hour, minute: _minute),
              )),
              style: FilledButton.styleFrom(
                backgroundColor: _kGreen,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                '$_dateLabel  $_timeLabel 확정',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PickerDropdown extends StatelessWidget {
  final int value;
  final List<int> items;
  final String Function(int) label;
  final ValueChanged<int> onChanged;

  const _PickerDropdown({
    required this.value,
    required this.items,
    required this.label,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFE5E5EA)),
        borderRadius: BorderRadius.circular(8),
        color: const Color(0xFFF9F9F9),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: value,
          isDense: true,
          items: items
              .map(
                (v) => DropdownMenuItem(
                  value: v,
                  child: Text(
                    label(v),
                    style: const TextStyle(fontSize: 14, color: _kTextTitle),
                  ),
                ),
              )
              .toList(),
          onChanged: (v) {
            if (v != null) onChanged(v);
          },
        ),
      ),
    );
  }
}

class _ConsultRequestTile extends StatelessWidget {
  final String message;
  final String status;
  final String createdAt;
  final bool showDivider;
  final bool canSchedule;
  final VoidCallback? onSchedule;

  const _ConsultRequestTile({
    required this.message,
    required this.status,
    required this.createdAt,
    this.showDivider = true,
    this.canSchedule = false,
    this.onSchedule,
  });

  Color get _statusColor => switch (status) {
    String s when s.contains('즉시') => const Color(0xFF4A7A4C),
    String s when s.contains('예약') => const Color(0xFF7A6800),
    _ => const Color(0xFF9A6060),
  };

  Color get _statusBg => switch (status) {
    String s when s.contains('즉시') => const Color(0xFFEEF5EE),
    String s when s.contains('예약') => const Color(0xFFFFF8E1),
    _ => const Color(0xFFF5EEEE),
  };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 메시지 텍스트 — 날짜 선택 가능하면 클릭 가능
              Expanded(
                child: GestureDetector(
                  onTap: canSchedule ? onSchedule : null,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Text(
                          message,
                          style: const TextStyle(
                            fontSize: 14,
                            color: _kTextTitle,
                            fontWeight: FontWeight.w800,
                            height: 1.35,
                          ),
                        ),
                      ),
                      if (canSchedule) ...[
                        const SizedBox(width: 4),
                        const Icon(
                          Icons.calendar_today_outlined,
                          size: 15,
                          color: AppColors.green,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // 상태 배지
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: _statusBg,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: _statusColor,
                  ),
                ),
              ),
            ],
          ),
          if (createdAt.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              createdAt,
              style: const TextStyle(
                fontSize: 12.5,
                color: _kTextSub,
                fontWeight: FontWeight.w600,
                height: 1.35,
              ),
            ),
          ],
          if (showDivider) ...[
            const SizedBox(height: 10),
            const Divider(color: _kDivider, height: 1),
          ],
        ],
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  final String label;
  final String value;

  const _InfoTile({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 104,
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: _kTextSub),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                color: _kTextTitle,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MedicationAlertIconButton extends StatelessWidget {
  final Senior senior;

  const _MedicationAlertIconButton({required this.senior});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.notifications_outlined, color: _kGreen),
      tooltip: '복약 알림 보내기',
      onPressed: () => _showModal(context),
    );
  }

  void _showModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _MedicationAlertModal(senior: senior),
    );
  }
}

class _MedicationAlertModal extends StatefulWidget {
  final Senior senior;

  const _MedicationAlertModal({required this.senior});

  @override
  State<_MedicationAlertModal> createState() => _MedicationAlertModalState();
}

class _MedicationAlertModalState extends State<_MedicationAlertModal> {
  final _api = GuardianApi();
  final _session = GuardianSessionStorage();
  final _customMsgCtrl = TextEditingController();

  String? _selectedMed;
  int _selectedMsgIdx = 0;
  bool _isSending = false;
  String _medName(String med) => med.split(' / ').first.trim();

  static const _kModalGreen = AppColors.green;
  static const _kModalBg = AppColors.modalBg;
  static const _kModalSub = AppColors.textSub;
  static const _kModalHint = AppColors.textHint;
  static const _kModalDivider = AppColors.divider;
  static const _kModalRed = AppColors.red;

  List<String> get _presets {
    final name = _selectedMed ?? '약';
    return [
      '$name 복용 시간입니다. 꼭 챙겨드세요 💊',
      '지금 $name 드실 시간이에요!',
      '오늘 $name 드셨나요? 확인해주세요.',
      '직접 입력',
    ];
  }

  String get _finalMessage {
    if (_selectedMsgIdx == _presets.length - 1) {
      return _customMsgCtrl.text.trim();
    }
    return _presets[_selectedMsgIdx];
  }

  Future<void> _send() async {
    final info = await _session.getGuardianInfo();
    final guardianId = int.tryParse(info['guardianId'] ?? '');
    if (guardianId == null) return;

    if (_finalMessage.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('메시지를 입력해주세요.')));
      return;
    }

    setState(() => _isSending = true);
    try {
      await _api.sendMedicationReminder(
        seniorId: widget.senior.id,
        guardianId: guardianId,
        message: _finalMessage,
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${widget.senior.name}님께 복약 알림을 전송했습니다.'),
          backgroundColor: _kModalGreen,
          duration: const Duration(seconds: 2),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSending = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: _kModalRed,
        ),
      );
    }
  }

  @override
  void dispose() {
    _customMsgCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final meds = widget.senior.medications;

    return Padding(
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.of(context).viewInsets.bottom + 32,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 핸들
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: _kModalDivider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              '${widget.senior.name}님께 복약 알림 보내기',
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1C1C1E),
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              '알림은 앱 푸시와 앱 내 알림함으로 동시에 전송됩니다.',
              style: TextStyle(fontSize: 12, color: _kModalSub),
            ),
            const SizedBox(height: 24),

            // 약 선택
            const Text(
              '약 선택',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _kModalSub,
              ),
            ),
            const SizedBox(height: 8),
            if (meds.isEmpty)
              TextField(
                decoration: InputDecoration(
                  hintText: '약 이름을 직접 입력하세요',
                  hintStyle: const TextStyle(color: _kModalHint),
                  filled: true,
                  fillColor: _kModalBg,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                ),
                onChanged: (v) => setState(() => _selectedMed = v.trim()),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: meds.map((med) {
                  final name = _medName(med);
                  final selected = _selectedMed == name;
                  return GestureDetector(
                    onTap: () => setState(() {
                      _selectedMed = selected ? null : name;
                      _selectedMsgIdx = 0;
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: selected ? _kModalGreen : _kModalBg,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: selected ? _kModalGreen : _kModalDivider,
                        ),
                      ),
                      child: Text(
                        name,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: selected
                              ? Colors.white
                              : const Color(0xFF1C1C1E),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            const SizedBox(height: 24),

            // 메시지 선택
            const Text(
              '메시지',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _kModalSub,
              ),
            ),
            const SizedBox(height: 8),
            ..._presets.asMap().entries.map((e) {
              final idx = e.key;
              final isCustom = idx == _presets.length - 1;
              final selected = _selectedMsgIdx == idx;
              return Column(
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _selectedMsgIdx = idx),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: selected ? const Color(0xFFEBF8EE) : _kModalBg,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: selected ? _kModalGreen : _kModalDivider,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            selected
                                ? Icons.radio_button_checked
                                : Icons.radio_button_unchecked,
                            color: selected ? _kModalGreen : _kModalHint,
                            size: 18,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              isCustom ? '직접 입력' : e.value,
                              style: TextStyle(
                                fontSize: 13,
                                color: selected
                                    ? const Color(0xFF1C1C1E)
                                    : _kModalSub,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (isCustom && selected)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: TextField(
                        controller: _customMsgCtrl,
                        maxLines: 2,
                        decoration: InputDecoration(
                          hintText: '보낼 메시지를 입력하세요',
                          hintStyle: const TextStyle(color: _kModalHint),
                          filled: true,
                          fillColor: _kModalBg,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: BorderSide.none,
                          ),
                          contentPadding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 12,
                          ),
                        ),
                      ),
                    ),
                ],
              );
            }),
            const SizedBox(height: 8),

            // 전송 버튼
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kModalGreen,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                onPressed: _isSending ? null : _send,
                child: _isSending
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : const Text(
                        '알림 보내기',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
