import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:http/http.dart' as http;

import '../../core/api/guardian_api.dart';
import '../../core/config/app_config.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';
import '../../core/theme/app_colors.dart';

enum _GuardianChatTarget { senior, socialWorker }

extension _GuardianChatTargetValue on _GuardianChatTarget {
  String get roomType {
    switch (this) {
      case _GuardianChatTarget.senior:
        return 'SENIOR_GUARDIAN';
      case _GuardianChatTarget.socialWorker:
        return 'GUARDIAN_WELFARE';
    }
  }

  String get emptyText {
    switch (this) {
      case _GuardianChatTarget.senior:
        return '아직 대상자와의 대화가 없습니다.';
      case _GuardianChatTarget.socialWorker:
        return '아직 담당 복지사와의 대화가 없습니다.';
    }
  }
}

class GuardianChatScreen extends StatefulWidget {
  const GuardianChatScreen({super.key});

  @override
  State<GuardianChatScreen> createState() => _GuardianChatScreenState();
}

class _GuardianChatScreenState extends State<GuardianChatScreen> {
  final _api = GuardianApi();
  final _sessionStorage = GuardianSessionStorage();

  List<Senior> _seniors = [];
  Senior? _selectedSenior;
  String _guardianName = '보호자';
  int? _guardianId;
  bool _loading = true;

  _GuardianChatTarget _selectedTarget = _GuardianChatTarget.senior;
  // 보호 대상자별 미확인 채팅 수 — 대상자 선택 바텀시트의 빨간 배지에 사용
  Map<int, int> _unreadBySenior = {};

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    try {
      final session = await _sessionStorage.getGuardianInfo();
      final guardianId = int.tryParse(session['guardianId'] ?? '');

      if (guardianId == null) {
        if (mounted) setState(() => _loading = false);
        return;
      }

      final seniors = await _api.fetchGuardianSeniors(guardianId);

      if (!mounted) return;

      setState(() {
        _guardianId = guardianId;
        _guardianName = session['name']?.trim().isNotEmpty == true
            ? session['name']!
            : '보호자';
        _seniors = seniors;
        _selectedSenior = seniors.isNotEmpty ? seniors.first : null;
        _loading = false;
      });

      // 처음 로드 시에도 한 번 불러오기
      _loadUnreadBySenior();
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  // 보호 대상자별 미확인 수 조회 메서드
  Future<void> _loadUnreadBySenior() async {
    final counts = <int, int>{};

    for (final senior in _seniors) {
      try {
        final url = Uri.parse(
          '${AppConfig.apiBaseUrl}/chat/unread'
          '?viewerRole=GUARDIAN&seniorId=${senior.id}',
        );
        final response = await http
            .get(url)
            .timeout(const Duration(seconds: 5));
        if (response.statusCode != 200) continue;

        final data = jsonDecode(utf8.decode(response.bodyBytes));
        if (data is Map<String, dynamic>) {
          counts[senior.id] = (data['count'] as num?)?.toInt() ?? 0;
        }
      } catch (_) {}
    }

    if (mounted) setState(() => _unreadBySenior = counts);
  }

  // 바텀시트 열기 전에 미확인 수를 새로 가져옴
  Future<void> _showSeniorPicker() async {
    if (_seniors.length <= 1) return;
    await _loadUnreadBySenior();
    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE5E5EA),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 14),
                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    '대상자 선택',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF1F2A20),
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                for (final senior in _seniors) ...[
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: CircleAvatar(
                      radius: 18,
                      backgroundColor: const Color(
                        0xFF86A788,
                      ).withValues(alpha: 0.16),
                      child: const Icon(
                        Icons.person,
                        size: 18,
                        color: Color(0xFF4A7A4C),
                      ),
                    ),
                    title: Text(
                      senior.name,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF1F2A20),
                      ),
                    ),
                    subtitle: Text(
                      senior.lastLocationAddress,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF6D766A),
                      ),
                    ),
                    // 미확인이 있으면 빨간 점+숫자, 선택된 대상자는 체크 표시
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if ((_unreadBySenior[senior.id] ?? 0) > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.red,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '${_unreadBySenior[senior.id]}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        if (_selectedSenior?.id == senior.id) ...[
                          const SizedBox(width: 6),
                          const Icon(
                            Icons.check,
                            size: 18,
                            color: AppColors.green,
                          ),
                        ],
                      ],
                    ),
                    onTap: () {
                      setState(() => _selectedSenior = senior);
                      Navigator.pop(ctx);
                    },
                  ),
                  if (senior != _seniors.last)
                    const Divider(height: 1, color: Color(0xFFE5E5EA)),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildAppBarTitle() {
    final selected = _selectedSenior;

    return Row(
      children: [
        const Text(
          '채팅',
          style: TextStyle(
            color: Color(0xFF1F2A20),
            fontWeight: FontWeight.w900,
            fontSize: 20,
          ),
        ),
        if (selected != null) ...[
          const SizedBox(width: 8),
          Flexible(
            child: GestureDetector(
              onTap: _seniors.length > 1 ? _showSeniorPicker : null,
              behavior: HitTestBehavior.opaque,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Flexible(
                    child: Text(
                      selected.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Color(0xFF6D766A),
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  if (_seniors.length > 1) ...[
                    const SizedBox(width: 2),
                    Stack(
                      clipBehavior: Clip.none,
                      children: [
                        const Icon(
                          Icons.keyboard_arrow_down,
                          size: 18,
                          color: Color(0xFF6D766A),
                        ),
                        // 지금 보고 있는 대상자 외에 미확인이 있으면 빨간 점
                        if (_unreadBySenior.entries.any(
                          (e) => e.key != _selectedSenior?.id && e.value > 0,
                        ))
                          Positioned(
                            top: -1,
                            right: -1,
                            child: Container(
                              width: 7,
                              height: 7,
                              decoration: const BoxDecoration(
                                color: AppColors.red,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final selected = _selectedSenior;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        titleSpacing: 0,
        title: _buildAppBarTitle(),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(
              child: _AppBarTargetToggle(
                selectedTarget: _selectedTarget,
                onChanged: (target) {
                  setState(() => _selectedTarget = target);
                },
              ),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.green),
            )
          : _seniors.isEmpty
          ? const Center(
              child: Text(
                '연결된 대상자가 없습니다.',
                style: TextStyle(
                  color: Color(0xFF6D766A),
                  fontWeight: FontWeight.w700,
                ),
              ),
            )
          : selected == null || _guardianId == null
          ? const SizedBox.shrink()
          : _GuardianHumanChatRoom(
              key: ValueKey('${selected.id}-${_selectedTarget.roomType}'),
              seniorId: selected.id,
              guardianId: _guardianId!,
              guardianName: _guardianName,
              roomType: _selectedTarget.roomType,
              emptyText: _selectedTarget.emptyText,
              seniorProfileImageUrl: selected.profileImageUrl,
            ),
    );
  }
}

class _AppBarTargetToggle extends StatelessWidget {
  const _AppBarTargetToggle({
    required this.selectedTarget,
    required this.onChanged,
  });

  final _GuardianChatTarget selectedTarget;
  final ValueChanged<_GuardianChatTarget> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 32,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: const Color(0xFFF7F5E8),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _AppBarTargetButton(
            label: '사용자',
            selected: selectedTarget == _GuardianChatTarget.senior,
            onTap: () => onChanged(_GuardianChatTarget.senior),
          ),
          const SizedBox(width: 3),
          _AppBarTargetButton(
            label: '복지사',
            selected: selectedTarget == _GuardianChatTarget.socialWorker,
            onTap: () => onChanged(_GuardianChatTarget.socialWorker),
          ),
        ],
      ),
    );
  }
}

class _AppBarTargetButton extends StatelessWidget {
  const _AppBarTargetButton({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        height: 26,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(18),
          boxShadow: selected
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 3,
                    offset: const Offset(0, 1),
                  ),
                ]
              : [],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w900,
            color: selected ? const Color(0xFF4A7A4C) : const Color(0xFF6D766A),
          ),
        ),
      ),
    );
  }
}

class _GuardianHumanChatRoom extends StatefulWidget {
  const _GuardianHumanChatRoom({
    super.key,
    required this.seniorId,
    required this.guardianId,
    required this.guardianName,
    required this.roomType,
    required this.emptyText,
    required this.seniorProfileImageUrl,
  });

  final int seniorId;
  final int guardianId;
  final String guardianName;
  final String roomType;
  final String emptyText;
  final String seniorProfileImageUrl;

  @override
  State<_GuardianHumanChatRoom> createState() => _GuardianHumanChatRoomState();
}

class _GuardianHumanChatRoomState extends State<_GuardianHumanChatRoom> {
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();

  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _load();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _load());
  }

  @override
  void didUpdateWidget(_GuardianHumanChatRoom oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.seniorId != widget.seniorId ||
        oldWidget.roomType != widget.roomType) {
      setState(() {
        _messages = [];
        _loading = true;
      });
      _load();
    }
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final response = await http.get(
        Uri.parse(
          '${AppConfig.apiBaseUrl}/chat/senior/${widget.seniorId}'
          '?roomType=${widget.roomType}&viewerRole=GUARDIAN&size=100',
        ),
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        final list = jsonDecode(utf8.decode(response.bodyBytes));

        if (list is List) {
          setState(() {
            _messages = list.whereType<Map<String, dynamic>>().toList();
            _loading = false;
          });
          _scrollToBottom();
        }
      } else {
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send() async {
    final text = _inputCtrl.text.trim();

    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    _inputCtrl.clear();

    try {
      final response = await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/chat/senior/${widget.seniorId}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'roomType': widget.roomType,
          'senderRole': 'GUARDIAN',
          'senderId': widget.guardianId,
          'senderName': widget.guardianName,
          'message': text,
        }),
      );

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw Exception();
      }

      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('메시지 전송에 실패했습니다.'),
            backgroundColor: Color(0xFFD94E4E),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickAndSendAttachment() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('갤러리에서 사진 선택'),
              onTap: () => Navigator.pop(context, 'gallery'),
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('카메라로 촬영'),
              onTap: () => Navigator.pop(context, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.attach_file_outlined),
              title: const Text('파일 선택'),
              onTap: () => Navigator.pop(context, 'file'),
            ),
          ],
        ),
      ),
    );

    if (choice == null || !mounted) return;

    String? filePath;
    String? fileName;
    String? mimeType;

    if (choice == 'gallery' || choice == 'camera') {
      final picker = ImagePicker();
      final source = choice == 'camera'
          ? ImageSource.camera
          : ImageSource.gallery;
      final picked = await picker.pickImage(source: source, imageQuality: 85);
      if (picked == null) return;
      filePath = picked.path;
      fileName = picked.name;
      mimeType = 'image/${picked.name.split('.').last.toLowerCase()}';
    } else {
      final result = await FilePicker.platform.pickFiles(withData: false);
      if (result == null || result.files.single.path == null) return;
      filePath = result.files.single.path!;
      fileName = result.files.single.name;
      mimeType = result.files.single.extension != null
          ? 'application/${result.files.single.extension}'
          : 'application/octet-stream';
    }

    setState(() => _sending = true);

    try {
      final uploadUri = Uri.parse('${AppConfig.apiBaseUrl}/uploads/chat');
      final request = http.MultipartRequest('POST', uploadUri);
      request.files.add(
        await http.MultipartFile.fromPath('file', filePath, filename: fileName),
      );
      final uploadRes = await request.send();
      final uploadBodyText = await uploadRes.stream.bytesToString();

      if (uploadRes.statusCode < 200 || uploadRes.statusCode >= 300) {
        throw Exception('업로드 실패 (${uploadRes.statusCode})');
      }

      final uploadBody = jsonDecode(uploadBodyText) as Map<String, dynamic>;
      final fileUrl = uploadBody['fileUrl']?.toString() ?? '';

      if (fileUrl.isEmpty) {
        throw Exception('업로드 실패');
      }

      final isImage = mimeType?.startsWith('image/') ?? false;

      await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/chat/senior/${widget.seniorId}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'roomType': widget.roomType,
          'senderRole': 'GUARDIAN',
          'senderId': widget.guardianId,
          'senderName': widget.guardianName,
          'message': '',
          // 상대 경로 그대로 저장 — 서버 IP가 바뀌어도 표시 시점에 현재 주소로 변환된다.
          'attachmentUrl': fileUrl,
          'attachmentType': isImage ? 'image' : 'file',
          'attachmentName': fileName,
        }),
      );

      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('파일 전송에 실패했습니다.'),
            backgroundColor: Color(0xFFD94E4E),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  // 잘못 보낸 메시지 삭제 — 내가 보낸 메시지를 길게 눌렀을 때 호출
  Future<void> _deleteMessage(Map<String, dynamic> message) async {
    final messageId = message['id'];
    if (messageId == null) return;

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
                '메시지 삭제',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textMain,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                '이 메시지를 삭제하시겠습니까?\n상대방 화면에서도 사라집니다.',
                style: TextStyle(fontSize: 13, color: AppColors.textSub),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surfaceBeige,
                        foregroundColor: AppColors.textSub,
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

    try {
      final response = await http
          .delete(
            Uri.parse(
              '${AppConfig.apiBaseUrl}/chat/messages/$messageId'
              '?senderRole=GUARDIAN&senderId=${widget.guardianId}',
            ),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception('delete failed');
      }

      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('메시지 삭제에 실패했습니다.'),
            backgroundColor: Color(0xFFD94E4E),
          ),
        );
      }
    }
  }

  String? _dateKey(dynamic value) {
    if (value == null) return null;
    try {
      final dt = DateTime.parse('$value').toLocal();
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
    } catch (_) {
      return null;
    }
  }

  String _formatDateLabel(String key) {
    final parts = key.split('-');
    if (parts.length < 3) return key;
    final dt = DateTime(
      int.parse(parts[0]),
      int.parse(parts[1]),
      int.parse(parts[2]),
    );
    const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
    return '${dt.year}년 ${dt.month}월 ${dt.day}일 (${weekdays[dt.weekday - 1]})';
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  String _profileImageFor(Map<String, dynamic> message) {
    final senderRole = message['senderRole']?.toString() ?? '';

    if (senderRole == 'SENIOR') {
      return widget.seniorProfileImageUrl;
    }

    return '';
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.green),
      );
    }

    return Column(
      children: [
        Expanded(
          child: _messages.isEmpty
              ? Center(
                  child: Text(
                    widget.emptyText,
                    style: const TextStyle(
                      color: Color(0xFF6D766A),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
              : ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  itemCount: _messages.length,
                  itemBuilder: (_, index) {
                    final message = _messages[index];
                    final currDate = _dateKey(message['createdAt']);
                    final prevDate = index > 0
                        ? _dateKey(_messages[index - 1]['createdAt'])
                        : null;
                    final showSep = currDate != null && currDate != prevDate;

                    return Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (showSep)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            child: Row(
                              children: [
                                const Expanded(
                                  child: Divider(color: Color(0xFFE5E5EA)),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                  ),
                                  child: Text(
                                    _formatDateLabel(currDate!),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Color(0xFFAEAEB2),
                                    ),
                                  ),
                                ),
                                const Expanded(
                                  child: Divider(color: Color(0xFFE5E5EA)),
                                ),
                              ],
                            ),
                          ),
                        _MessageBubble(
                          message: message,
                          isMine: message['senderRole'] == 'GUARDIAN',
                          profileImageUrl: _profileImageFor(message),
                          onLongPress: message['senderRole'] == 'GUARDIAN'
                              ? () => _deleteMessage(message)
                              : null,
                        ),
                      ],
                    );
                  },
                ),
        ),
        _InputBar(
          controller: _inputCtrl,
          sending: _sending,
          onSend: _send,
          onAttach: _pickAndSendAttachment,
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({
    required this.message,
    required this.isMine,
    required this.profileImageUrl,
    this.onLongPress,
  });

  final Map<String, dynamic> message;
  final bool isMine;
  final String profileImageUrl;

  /// 내가 보낸 메시지를 길게 누르면 삭제 — 잘못 보낸 메시지 회수용
  final VoidCallback? onLongPress;

  String _formatTime(dynamic value) {
    if (value == null) return '';

    try {
      final dateTime = DateTime.parse('$value').toLocal();

      return '${dateTime.hour.toString().padLeft(2, '0')}:'
          '${dateTime.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = message['message']?.toString() ?? '';
    final senderName = message['senderName']?.toString() ?? '';
    final time = _formatTime(message['createdAt']);
    final attachmentUrl = message['attachmentUrl']?.toString() ?? '';
    final attachmentType = message['attachmentType']?.toString() ?? '';
    final attachmentName = message['attachmentName']?.toString() ?? '';

    final isImageAttachment =
        attachmentType == 'image' ||
        attachmentType.startsWith('image/') ||
        RegExp(
          r'\.(jpg|jpeg|png|gif|webp|bmp)$',
          caseSensitive: false,
        ).hasMatch(attachmentUrl);

    final isFileAttachment = attachmentUrl.isNotEmpty && !isImageAttachment;

    // 상대 경로면 현재 서버 주소로 변환 — IP가 바뀌어도 항상 현재 설정 기준으로 연다.
    final resolvedUrl =
        attachmentUrl.isEmpty || attachmentUrl.startsWith('http')
        ? attachmentUrl
        : '${AppConfig.apiBaseUrl.replaceAll(RegExp(r'/api$'), '')}$attachmentUrl';

    return GestureDetector(
      onLongPress: onLongPress,
      child: Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          mainAxisAlignment: isMine
              ? MainAxisAlignment.end
              : MainAxisAlignment.start,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (!isMine) ...[
              _ChatAvatar(name: senderName, imageUrl: profileImageUrl),
              const SizedBox(width: 8),
            ],
            Column(
              crossAxisAlignment: isMine
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                if (!isMine && senderName.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 3),
                    child: Text(
                      senderName,
                      style: const TextStyle(
                        color: Color(0xFF6D766A),
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.65,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 10,
                  ),
                  decoration: BoxDecoration(
                    color: isMine ? AppColors.green : Colors.white,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isMine ? 16 : 4),
                      bottomRight: Radius.circular(isMine ? 4 : 16),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.06),
                        blurRadius: 4,
                        offset: const Offset(0, 1),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (attachmentUrl.isNotEmpty && isImageAttachment)
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            resolvedUrl,
                            width: 200,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.broken_image,
                              color: Colors.grey,
                            ),
                          ),
                        ),
                      if (isFileAttachment)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.insert_drive_file_outlined,
                              size: 18,
                              color: isMine ? Colors.white70 : AppColors.green,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                attachmentName.isNotEmpty
                                    ? attachmentName
                                    : '파일',
                                style: TextStyle(
                                  color: isMine
                                      ? Colors.white
                                      : const Color(0xFF1F2A20),
                                  fontSize: 13,
                                  decoration: TextDecoration.underline,
                                ),
                              ),
                            ),
                          ],
                        ),
                      if (text.isNotEmpty)
                        Padding(
                          padding: EdgeInsets.only(
                            top: attachmentUrl.isNotEmpty ? 6 : 0,
                          ),
                          child: Text(
                            text,
                            style: TextStyle(
                              color: isMine
                                  ? Colors.white
                                  : const Color(0xFF1F2A20),
                              fontSize: 14,
                              height: 1.4,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (time.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      time,
                      style: const TextStyle(
                        color: Color(0xFFD1D5DB),
                        fontSize: 10,
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ChatAvatar extends StatelessWidget {
  const _ChatAvatar({required this.name, required this.imageUrl});

  final String name;
  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    final resolvedUrl = _resolveProfileImageUrl(imageUrl);

    return CircleAvatar(
      radius: 16,
      backgroundColor: AppColors.green.withValues(alpha: 0.2),
      child: ClipOval(
        child: resolvedUrl.isEmpty
            ? Center(
                child: Text(
                  name.isNotEmpty ? name[0] : '?',
                  style: const TextStyle(
                    color: AppColors.green,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              )
            : Image.network(
                resolvedUrl,
                width: 32,
                height: 32,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) {
                  return Center(
                    child: Text(
                      name.isNotEmpty ? name[0] : '?',
                      style: const TextStyle(
                        color: AppColors.green,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  );
                },
              ),
      ),
    );
  }
}

String _resolveProfileImageUrl(String rawUrl) {
  final imageUrl = rawUrl.trim();

  if (imageUrl.isEmpty) return '';

  final parsed = Uri.tryParse(imageUrl);

  if (parsed != null && parsed.hasScheme) {
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

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.sending,
    required this.onSend,
    required this.onAttach,
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback onAttach;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: EdgeInsets.only(
        left: 12,
        right: 12,
        top: 8,
        bottom: MediaQuery.of(context).padding.bottom + 8,
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: sending ? null : onAttach,
            child: Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: Color(0xFFF0F0F0),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.attach_file,
                size: 20,
                color: Color(0xFF6C6C70),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: controller,
              maxLines: null,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                hintText: '메시지를 입력하세요',
                hintStyle: const TextStyle(
                  fontSize: 14,
                  color: Color(0xFFBDBDBD),
                ),
                filled: true,
                fillColor: const Color(0xFFF7F5E8),
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(24),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: sending ? null : onSend,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: sending ? const Color(0xFFD1D5DB) : AppColors.green,
                shape: BoxShape.circle,
              ),
              child: sending
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Icon(Icons.send, color: Colors.white, size: 20),
            ),
          ),
        ],
      ),
    );
  }
}
