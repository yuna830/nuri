import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../face/face_check_camera_screen.dart';

const _kGreen = AppColors.green;
const _kRed = AppColors.red;
const _kTextMain = AppColors.textMain;
const _kTextSub = AppColors.textSub;
const _kTextHint = AppColors.textHint;
const _kDivider = AppColors.divider;

/// 현재 실종 신고가 접수된 사람들의 공개 목록.
/// 발견자가 여기서 실종자를 확인하고, 얼굴 확인 카메라로 제보할 수 있다.
class MissingPersonsScreen extends StatefulWidget {
  const MissingPersonsScreen({super.key});

  @override
  State<MissingPersonsScreen> createState() => _MissingPersonsScreenState();
}

class _MissingPersonsScreenState extends State<MissingPersonsScreen> {
  List<Map<String, dynamic>> _reports = [];
  bool _loading = true;
  String? _error;

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
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final response = await http
          .get(Uri.parse('${AppConfig.apiBaseUrl}/missing-reports/active'))
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception('목록을 불러오지 못했습니다. (${response.statusCode})');
      }

      final data = jsonDecode(utf8.decode(response.bodyBytes));
      if (!mounted) return;

      setState(() {
        _reports = data is List
            ? data
                  .whereType<Map>()
                  .map((item) => Map<String, dynamic>.from(item))
                  .toList()
            : [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _loading = false;
      });
    }
  }

  String _displayName(Map<String, dynamic> report) {
    final name = report['seniorName']?.toString();
    if (name != null && name.isNotEmpty) return name;

    // 직접 입력 신고는 description에 "대상자 이름: ..." 형식으로 들어 있다.
    final description = report['description']?.toString() ?? '';
    for (final line in description.split('\n')) {
      final trimmed = line.trim();
      if (trimmed.startsWith('대상자 이름:')) {
        final value = trimmed.substring('대상자 이름:'.length).trim();
        if (value.isNotEmpty) return value;
      }
    }
    return '이름 미상';
  }

  String _formatTime(dynamic value) {
    if (value == null) return '-';
    try {
      final dt = DateTime.parse('$value');
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} '
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '$value';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7F5),
      appBar: AppBar(
        title: const Text('실종자 목록'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kGreen))
          : _error != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, size: 44, color: _kRed),
                    const SizedBox(height: 10),
                    Text(
                      _error!,
                      style: const TextStyle(fontSize: 14, color: _kTextSub),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 14),
                    FilledButton(
                      onPressed: _load,
                      style: FilledButton.styleFrom(backgroundColor: _kGreen),
                      child: const Text('다시 시도'),
                    ),
                  ],
                ),
              ),
            )
          : _reports.isEmpty
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.person_search_outlined, size: 52, color: _kTextHint),
                  SizedBox(height: 10),
                  Text(
                    '현재 신고된 실종자가 없습니다.',
                    style: TextStyle(fontSize: 15, color: _kTextSub),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              color: _kGreen,
              child: ListView.separated(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 24),
                itemCount: _reports.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (_, index) => _buildCard(_reports[index]),
              ),
            ),
    );
  }

  Widget _buildCard(Map<String, dynamic> report) {
    final imageUrls = (report['imageUrls'] as List?)
            ?.map((e) => e.toString())
            .where((e) => e.isNotEmpty)
            .toList() ??
        [];
    final thumbnail = imageUrls.isNotEmpty
        ? imageUrls.first
        : (report['imageUrl']?.toString() ?? '');
    final address = report['lastSeenAddress']?.toString() ?? '';
    final description = report['description']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _kDivider),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 사진
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 72,
                  height: 84,
                  color: const Color(0xFFF2F2F2),
                  child: thumbnail.isEmpty
                      ? const Icon(Icons.person_outline,
                          size: 32, color: _kTextHint)
                      : Image.network(
                          _resolveUrl(thumbnail),
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.broken_image_outlined,
                            color: _kTextHint,
                          ),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            _displayName(report),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                              color: _kTextMain,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.redBg,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            '실종',
                            style: TextStyle(
                              fontSize: 11,
                              height: 1.0,
                              fontWeight: FontWeight.w700,
                              color: _kRed,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    if (address.isNotEmpty)
                      _infoLine(Icons.location_on_outlined, address),
                    _infoLine(
                      Icons.schedule_outlined,
                      '신고 ${_formatTime(report['reportedAt'])}',
                    ),
                    if (description.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          color: _kTextSub,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => const FaceCheckCameraScreen(),
                  ),
                );
              },
              icon: const Icon(Icons.camera_alt_outlined, size: 16),
              label: const Text(
                '비슷한 사람을 봤다면 얼굴 확인하기',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: _kGreen,
                backgroundColor: Colors.white,
                side: BorderSide(color: _kGreen.withValues(alpha: 0.5)),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoLine(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 1),
            child: Icon(icon, size: 13, color: _kTextHint),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12, color: _kTextSub),
            ),
          ),
        ],
      ),
    );
  }
}
