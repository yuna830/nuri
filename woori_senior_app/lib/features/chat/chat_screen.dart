import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:mime/mime.dart';

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';

// AI 백엔드 주소 (에뮬레이터에서 호스트 PC 접근)
const _aiBaseUrl = 'http://10.0.2.2:8001';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.seniorId});
  final int seniorId;

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  static const _tabs = [
    _Tab('보호자', 'SENIOR_GUARDIAN'),
    _Tab('복지사', 'SENIOR_WELFARE'),
    _Tab('AI 도우미', 'AI'),
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.white,
        elevation: 0,
        title: const Text('채팅',
            style: TextStyle(
                color: Color(0xFF1F2A20), fontWeight: FontWeight.w900)),
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF86A788),
          unselectedLabelColor: const Color(0xFF6D766A),
          indicatorColor: const Color(0xFF86A788),
          labelStyle:
              const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
          tabs: _tabs
              .map((t) => Tab(
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(
                        t.roomType == 'AI'
                            ? Icons.smart_toy_outlined
                            : Icons.chat_bubble_outline,
                        size: 16,
                      ),
                      const SizedBox(width: 4),
                      Text(t.label),
                    ]),
                  ))
              .toList(),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: _tabs.map((t) {
          if (t.roomType == 'AI') {
            return _AiChatRoom(seniorId: widget.seniorId);
          }
          return _HumanChatRoom(
            seniorId: widget.seniorId,
            roomType: t.roomType,
          );
        }).toList(),
      ),
    );
  }
}

class _Tab {
  const _Tab(this.label, this.roomType);
  final String label;
  final String roomType;
}

// ─── 인간 채팅방 (보호자/복지사) ─────────────────────────────────────────────

class _HumanChatRoom extends StatefulWidget {
  const _HumanChatRoom({required this.seniorId, required this.roomType});
  final int seniorId;
  final String roomType;

  @override
  State<_HumanChatRoom> createState() => _HumanChatRoomState();
}

class _HumanChatRoomState extends State<_HumanChatRoom> {
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _picker = ImagePicker();
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
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await http.get(Uri.parse(
          '$apiBaseUrl/api/chat/senior/${widget.seniorId}'
          '?roomType=${widget.roomType}&viewerRole=SENIOR&size=100'));
      if (!mounted) return;
      if (res.statusCode == 200) {
        final list = jsonDecode(utf8.decode(res.bodyBytes));
        if (list is List) {
          setState(() {
            _messages = list.whereType<Map<String, dynamic>>().toList();
            _loading = false;
          });
          _scrollToBottom();
        }
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _send({String text = '', String? attachUrl, String? attachName, String? attachType}) async {
    final msg = text.trim();
    if (msg.isEmpty && attachUrl == null) return;
    if (_sending) return;
    setState(() => _sending = true);
    _inputCtrl.clear();

    try {
      await http.post(
        Uri.parse('$apiBaseUrl/api/chat/senior/${widget.seniorId}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'roomType': widget.roomType,
          'senderRole': 'SENIOR',
          'senderId': widget.seniorId,
          'senderName': '어르신',
          'message': msg,
          if (attachUrl != null) 'attachmentUrl': attachUrl,
          if (attachType != null) 'attachmentType': attachType,
          if (attachName != null) 'attachmentName': attachName,
        }),
      );
      await _load();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('전송 실패'), backgroundColor: Color(0xFFD94E4E)),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickAndSendImage() async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 80,
    );
    if (picked == null) return;

    setState(() => _sending = true);
    try {
      final file = File(picked.path);
      final bytes = await file.readAsBytes();
      final mime = lookupMimeType(picked.path) ?? 'image/jpeg';
      final name = picked.name;

      final req = http.MultipartRequest(
        'POST',
        Uri.parse('$apiBaseUrl/api/uploads/chat'),
      );
      req.files.add(http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: name,
      ));

      final streamed = await req.send();
      final res = await http.Response.fromStream(streamed);

      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final url = '${data['fileUrl'] ?? data['imageUrl'] ?? ''}';
        await _send(attachUrl: url, attachName: name, attachType: mime);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('파일 전송 실패'), backgroundColor: Color(0xFFD94E4E)),
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(
          child: CircularProgressIndicator(color: Color(0xFF86A788)));
    }
    return Column(children: [
      Expanded(
        child: _messages.isEmpty
            ? Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Text('💬', style: TextStyle(fontSize: 40)),
                const SizedBox(height: 12),
                Text(
                  widget.roomType == 'SENIOR_GUARDIAN'
                      ? '보호자와의 대화가 없습니다'
                      : '복지사와의 대화가 없습니다',
                  style: const TextStyle(
                      color: Color(0xFF6D766A),
                      fontSize: 15,
                      fontWeight: FontWeight.w700),
                ),
              ]))
            : ListView.builder(
                controller: _scrollCtrl,
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 12),
                itemCount: _messages.length,
                itemBuilder: (_, i) =>
                    _MessageBubble(msg: _messages[i], isMine: _messages[i]['senderRole'] == 'SENIOR'),
              ),
      ),
      _InputBar(
        controller: _inputCtrl,
        sending: _sending,
        onSend: () => _send(text: _inputCtrl.text),
        onAttach: _pickAndSendImage,
      ),
    ]);
  }
}

// ─── AI 채팅방 ────────────────────────────────────────────────────────────────

class _AiChatRoom extends StatefulWidget {
  const _AiChatRoom({required this.seniorId});
  final int seniorId;

  @override
  State<_AiChatRoom> createState() => _AiChatRoomState();
}

class _AiChatRoomState extends State<_AiChatRoom> {
  final _api = const SeniorApi();
  final _inputCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();

  final List<_AiMsg> _history = [];
  bool _sending = false;
  Map<String, dynamic> _profile = {};

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _history.add(const _AiMsg(
      role: 'assistant',
      text: '안녕하세요! 복지 정보나 건강에 대해 궁금한 것을 물어보세요. 😊',
    ));
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final raw = await _api.fetchProfile(widget.seniorId);
      final s = raw['senior'] as Map<String, dynamic>? ?? {};
      final h = raw['healthInfo'] as Map<String, dynamic>? ?? {};
      if (mounted) setState(() => _profile = {...s, ...h});
    } catch (_) {}
  }

  Future<void> _ask() async {
    final q = _inputCtrl.text.trim();
    if (q.isEmpty || _sending) return;

    _inputCtrl.clear();
    setState(() {
      _history.add(_AiMsg(role: 'user', text: q));
      _sending = true;
    });
    _scrollToBottom();

    try {
      final historyForApi = _history
          .where((m) => m.role != 'user' || m.text != q)
          .take(_history.length - 1)
          .map((m) => {'role': m.role, 'text': m.text})
          .toList();

      final res = await http.post(
        Uri.parse('$_aiBaseUrl/api/chat'),
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: jsonEncode({
          'question': q,
          'mode': 'qa',
          'audience': 'worker',
          'history': historyForApi,
          'profile': {
            'name': _profile['name'] ?? '',
            'age': _profile['age'],
            'gender': _profile['gender'] ?? '',
            'region': _profile['region'] ?? _profile['address'] ?? '',
            'incomeLevel': _profile['incomeLevel'] ?? '',
            'householdType': _profile['householdType'] ?? '',
          },
        }),
      ).timeout(const Duration(seconds: 30));

      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
        final answer = data['answer']?.toString() ?? '답변을 가져오지 못했습니다.';
        setState(() => _history.add(_AiMsg(role: 'assistant', text: answer)));
      } else {
        setState(() => _history.add(const _AiMsg(
            role: 'assistant', text: 'AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _history.add(const _AiMsg(
            role: 'assistant',
            text: 'AI 서버에 연결할 수 없습니다.\n(AI 백엔드 서버가 실행 중인지 확인하세요)')));
      }
    } finally {
      if (mounted) {
        setState(() => _sending = false);
        _scrollToBottom();
      }
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

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // AI 안내 배너
      Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        color: const Color(0xFF86A788).withValues(alpha: 0.1),
        child: const Text(
          '🤖 복지 정책 · 건강 · 일자리에 대해 질문해보세요',
          style: TextStyle(
              color: Color(0xFF2D5A2E),
              fontSize: 12,
              fontWeight: FontWeight.w700),
          textAlign: TextAlign.center,
        ),
      ),
      Expanded(
        child: ListView.builder(
          controller: _scrollCtrl,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          itemCount: _history.length + (_sending ? 1 : 0),
          itemBuilder: (_, i) {
            if (i == _history.length) {
              // 로딩 버블
              return const Padding(
                padding: EdgeInsets.only(bottom: 10),
                child: Row(children: [
                  _AiAvatar(),
                  SizedBox(width: 8),
                  _TypingIndicator(),
                ]),
              );
            }
            final m = _history[i];
            final isMine = m.role == 'user';
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                mainAxisAlignment: isMine
                    ? MainAxisAlignment.end
                    : MainAxisAlignment.start,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!isMine) ...[
                    const _AiAvatar(),
                    const SizedBox(width: 8),
                  ],
                  Flexible(
                    child: Container(
                      constraints: BoxConstraints(
                        maxWidth: MediaQuery.of(context).size.width * 0.75,
                      ),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: isMine
                            ? const Color(0xFF86A788)
                            : Colors.white,
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
                        m.text,
                        style: TextStyle(
                          color: isMine ? Colors.white : const Color(0xFF1F2A20),
                          fontSize: 14,
                          height: 1.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
      _InputBar(
        controller: _inputCtrl,
        sending: _sending,
        onSend: _ask,
        onAttach: null, // AI는 파일 첨부 불필요
        hintText: '복지 · 건강 · 일자리에 대해 질문하세요',
      ),
    ]);
  }
}

class _AiMsg {
  const _AiMsg({required this.role, required this.text});
  final String role;
  final String text;
}

// ─── 공통 위젯 ────────────────────────────────────────────────────────────────

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.msg, required this.isMine});
  final Map<String, dynamic> msg;
  final bool isMine;

  String _fmtTime(dynamic v) {
    if (v == null) return '';
    try {
      final dt = DateTime.parse('$v').toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = msg['message']?.toString() ?? '';
    final time = _fmtTime(msg['createdAt']);
    final name = msg['senderName']?.toString() ?? '';
    final attachUrl = msg['attachmentUrl']?.toString() ?? '';
    final attachType = msg['attachmentType']?.toString() ?? '';
    final attachName = msg['attachmentName']?.toString() ?? '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment:
            isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor:
                  const Color(0xFF86A788).withValues(alpha: 0.2),
              child: Text(
                name.isNotEmpty ? name[0] : '?',
                style: const TextStyle(
                    color: Color(0xFF86A788),
                    fontSize: 12,
                    fontWeight: FontWeight.w800),
              ),
            ),
            const SizedBox(width: 8),
          ],
          Column(
            crossAxisAlignment: isMine
                ? CrossAxisAlignment.end
                : CrossAxisAlignment.start,
            children: [
              if (!isMine)
                Padding(
                  padding: const EdgeInsets.only(bottom: 3),
                  child: Text(name,
                      style: const TextStyle(
                          color: Color(0xFF6D766A),
                          fontSize: 11,
                          fontWeight: FontWeight.w700)),
                ),
              if (text.isNotEmpty)
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.of(context).size.width * 0.65,
                  ),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 10),
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
              // 파일 첨부
              if (attachUrl.isNotEmpty) ...[
                const SizedBox(height: 4),
                _AttachmentBubble(
                  url: attachUrl,
                  name: attachName,
                  mimeType: attachType,
                  isMine: isMine,
                ),
              ],
              if (time.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 3),
                  child: Text(time,
                      style: const TextStyle(
                          color: Color(0xFFD1D5DB), fontSize: 10)),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AttachmentBubble extends StatelessWidget {
  const _AttachmentBubble({
    required this.url,
    required this.name,
    required this.mimeType,
    required this.isMine,
  });
  final String url;
  final String name;
  final String mimeType;
  final bool isMine;

  bool get _isImage => mimeType.startsWith('image/');

  @override
  Widget build(BuildContext context) {
    final fullUrl = url.startsWith('http') ? url : '$apiBaseUrl$url';

    if (_isImage) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: Image.network(
          fullUrl,
          width: 200,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _fileTile(),
        ),
      );
    }
    return _fileTile();
  }

  Widget _fileTile() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: isMine
            ? const Color(0xFF5C8C5E)
            : const Color(0xFFF0F7F0),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.attach_file,
            size: 16,
            color: isMine ? Colors.white : const Color(0xFF86A788)),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            name.isNotEmpty ? name : '첨부파일',
            style: TextStyle(
              color: isMine ? Colors.white : const Color(0xFF1F2A20),
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ]),
    );
  }
}

class _InputBar extends StatelessWidget {
  const _InputBar({
    required this.controller,
    required this.sending,
    required this.onSend,
    required this.onAttach,
    this.hintText = '메시지를 입력하세요...',
  });
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback? onAttach;
  final String hintText;

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
      child: Row(children: [
        if (onAttach != null) ...[
          IconButton(
            icon: const Icon(Icons.attach_file, color: Color(0xFF86A788)),
            onPressed: sending ? null : onAttach,
            tooltip: '파일 첨부',
          ),
        ],
        Expanded(
          child: TextField(
            controller: controller,
            maxLines: null,
            textInputAction: TextInputAction.send,
            onSubmitted: (_) => onSend(),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: const TextStyle(fontSize: 14, color: Color(0xFFBDBDBD)),
              filled: true,
              fillColor: const Color(0xFFF7F5E8),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
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
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.send, color: Colors.white, size: 20),
          ),
        ),
      ]),
    );
  }
}

class _AiAvatar extends StatelessWidget {
  const _AiAvatar();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: const BoxDecoration(
        color: Color(0xFF86A788),
        shape: BoxShape.circle,
      ),
      child: const Icon(Icons.smart_toy, color: Colors.white, size: 18),
    );
  }
}

class _TypingIndicator extends StatelessWidget {
  const _TypingIndicator();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 4,
              offset: const Offset(0, 1)),
        ],
      ),
      child: const Row(mainAxisSize: MainAxisSize.min, children: [
        _Dot(delay: 0),
        SizedBox(width: 4),
        _Dot(delay: 200),
        SizedBox(width: 4),
        _Dot(delay: 400),
      ]),
    );
  }
}

class _Dot extends StatefulWidget {
  const _Dot({required this.delay});
  final int delay;

  @override
  State<_Dot> createState() => _DotState();
}

class _DotState extends State<_Dot> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    Future.delayed(Duration(milliseconds: widget.delay), () {
      if (mounted) _ctrl.repeat(reverse: true);
    });
    _anim = Tween<double>(begin: 0, end: 1).animate(_ctrl);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _anim,
      child: Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(
          color: Color(0xFF86A788),
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
