import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../core/api/guardian_api.dart';
import '../../core/config/app_config.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';

enum _GuardianChatTarget {
  senior,
  socialWorker,
}

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
        return '아직 어르신과의 대화가 없습니다.';
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
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showSeniorPicker() {
    if (_seniors.length <= 1) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(16),
        ),
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
                      backgroundColor:
                          const Color(0xFF86A788).withValues(alpha: 0.16),
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
                    trailing: _selectedSenior?.id == senior.id
                        ? const Icon(
                            Icons.check,
                            size: 18,
                            color: Color(0xFF86A788),
                          )
                        : null,
                    onTap: () {
                      setState(() => _selectedSenior = senior);
                      Navigator.pop(ctx);
                    },
                  ),
                  if (senior != _seniors.last)
                    const Divider(
                      height: 1,
                      color: Color(0xFFE5E5EA),
                    ),
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
                    const Icon(
                      Icons.keyboard_arrow_down,
                      size: 18,
                      color: Color(0xFF6D766A),
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
              child: CircularProgressIndicator(
                color: Color(0xFF86A788),
              ),
            )
          : _seniors.isEmpty
              ? const Center(
                  child: Text(
                    '연결된 어르신이 없습니다.',
                    style: TextStyle(
                      color: Color(0xFF6D766A),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
              : selected == null || _guardianId == null
                  ? const SizedBox.shrink()
                  : _GuardianHumanChatRoom(
                      key: ValueKey(
                        '${selected.id}-${_selectedTarget.roomType}',
                      ),
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
            label: '어르신',
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
            color: selected
                ? const Color(0xFF4A7A4C)
                : const Color(0xFF6D766A),
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
    _pollTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _load(),
    );
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
        child: CircularProgressIndicator(
          color: Color(0xFF86A788),
        ),
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

                    return _MessageBubble(
                      message: message,
                      isMine: message['senderRole'] == 'GUARDIAN',
                      profileImageUrl: _profileImageFor(message),
                    );
                  },
                ),
        ),
        _InputBar(
          controller: _inputCtrl,
          sending: _sending,
          onSend: _send,
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
  });

  final Map<String, dynamic> message;
  final bool isMine;
  final String profileImageUrl;

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

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            _ChatAvatar(
              name: senderName,
              imageUrl: profileImageUrl,
            ),
            const SizedBox(width: 8),
          ],
          Column(
            crossAxisAlignment:
                isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
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
                  color: isMine ? const Color(0xFF86A788) : Colors.white,
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
                child: Text(
                  text,
                  style: TextStyle(
                    color: isMine ? Colors.white : const Color(0xFF1F2A20),
                    fontSize: 14,
                    height: 1.4,
                  ),
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
    );
  }
}

class _ChatAvatar extends StatelessWidget {
  const _ChatAvatar({
    required this.name,
    required this.imageUrl,
  });

  final String name;
  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    final resolvedUrl = _resolveProfileImageUrl(imageUrl);

    return CircleAvatar(
      radius: 16,
      backgroundColor: const Color(0xFF86A788).withValues(alpha: 0.2),
      child: ClipOval(
        child: resolvedUrl.isEmpty
            ? Center(
                child: Text(
                  name.isNotEmpty ? name[0] : '?',
                  style: const TextStyle(
                    color: Color(0xFF86A788),
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
                        color: Color(0xFF86A788),
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
      .replace(
        path: '',
        queryParameters: null,
        fragment: null,
      )
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
  });

  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;

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
                color: sending
                    ? const Color(0xFFD1D5DB)
                    : const Color(0xFF86A788),
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
                  : const Icon(
                      Icons.send,
                      color: Colors.white,
                      size: 20,
                    ),
            ),
          ),
        ],
      ),
    );
  }
}