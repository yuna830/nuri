import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:mime/mime.dart';

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';
import '../../core/config/secrets.dart';

// Gemini API 설정
const _geminiApiKey = geminiApiKey;
const _geminiModel = 'gemini-2.5-flash-lite';
const _geminiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/$_geminiModel:generateContent';

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
      final bytes = await picked.readAsBytes();
      final mime = lookupMimeType(picked.path) ?? 'image/jpeg';
      final name = picked.name;
      final dataUrl = 'data:$mime;base64,${base64Encode(bytes)}';
      await _send(attachUrl: dataUrl, attachName: name, attachType: mime);
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
  final _picker = ImagePicker();

  final List<_AiMsg> _history = [];
  bool _sending = false;
  Map<String, dynamic> _senior = {};
  Map<String, dynamic> _healthInfo = {};
  String? _pendingImageBase64;
  String? _pendingImageMime;
  int? _conversationId;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _initConversation();
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
      if (mounted) setState(() { _senior = s; _healthInfo = h; });
    } catch (_) {}
  }

  // 가장 최근 대화 불러오거나 없으면 새로 생성
  Future<void> _initConversation() async {
    try {
      final baseUrl = '$apiBaseUrl/api/assistant-conversations';
      // 최근 대화 목록 조회
      final listRes = await http.get(
        Uri.parse('$baseUrl/senior/${widget.seniorId}'),
      ).timeout(const Duration(seconds: 6));

      if (listRes.statusCode == 200) {
        final list = jsonDecode(utf8.decode(listRes.bodyBytes)) as List;
        if (list.isNotEmpty) {
          final conv = list.first as Map<String, dynamic>;
          _conversationId = conv['id'] as int?;
          await _loadMessages();
          return;
        }
      }
      // 대화 없으면 새로 생성
      await _createConversation();
    } catch (_) {
      _addWelcome();
    }
  }

  Future<void> _createConversation() async {
    try {
      final res = await http.post(
        Uri.parse('$apiBaseUrl/api/assistant-conversations/senior/${widget.seniorId}'),
      ).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200 || res.statusCode == 201) {
        final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
        _conversationId = data['id'] as int?;
      }
      _addWelcome();
    } catch (_) {
      _addWelcome();
    }
  }

  Future<void> _loadMessages() async {
    if (_conversationId == null) { _addWelcome(); return; }
    try {
      final res = await http.get(
        Uri.parse('$apiBaseUrl/api/assistant-conversations/$_conversationId/messages?seniorId=${widget.seniorId}'),
      ).timeout(const Duration(seconds: 6));
      if (res.statusCode == 200) {
        final list = jsonDecode(utf8.decode(res.bodyBytes)) as List;
        if (list.isNotEmpty && mounted) {
          final msgs = list.map((m) => _AiMsg(
            role: (m['role'] as String).toLowerCase() == 'user' ? 'user' : 'assistant',
            text: m['content'] as String? ?? '',
          )).toList();
          setState(() => _history.addAll(msgs));
          _scrollToBottom();
          return;
        }
      }
      _addWelcome();
    } catch (_) {
      _addWelcome();
    }
  }

  void _addWelcome() {
    if (mounted && _history.isEmpty) {
      setState(() => _history.add(const _AiMsg(
        role: 'assistant',
        text: '안녕하세요! 복지 정보나 건강에 대해 궁금한 것을 물어보세요. 😊',
      )));
    }
  }

  Future<void> _saveMessage(String role, String content) async {
    if (_conversationId == null) return;
    try {
      await http.post(
        Uri.parse('$apiBaseUrl/api/assistant-conversations/$_conversationId/messages?seniorId=${widget.seniorId}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'role': role.toUpperCase(), 'content': content}),
      ).timeout(const Duration(seconds: 6));
    } catch (_) {}
  }

  Future<void> _pickAiImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    final mime = lookupMimeType(picked.path) ?? 'image/jpeg';
    setState(() {
      _pendingImageBase64 = base64Encode(bytes);
      _pendingImageMime = mime;
    });
  }

  String _buildSystemPrompt() {
    String sv(String key) {
      final val = _senior[key];
      if (val == null) return '';
      final s = '$val'.trim();
      return (s.isEmpty || s == 'null') ? '' : s;
    }

    String hv(String key) {
      final val = _healthInfo[key];
      if (val == null) return '';
      final s = '$val'.trim();
      return (s.isEmpty || s == 'null') ? '' : s;
    }

    final name = sv('name').isNotEmpty ? sv('name') : '사용자';

    // 기본 정보
    final basicParts = <String>[];
    if (sv('age').isNotEmpty) basicParts.add('나이: ${sv('age')}세');
    if (sv('gender').isNotEmpty) basicParts.add('성별: ${sv('gender')}');
    if (sv('region').isNotEmpty) basicParts.add('지역: ${sv('region')}');

    // 건강 정보 (health_info 테이블 전체)
    final healthParts = <String>[];
    final fieldLabels = {
      'healthStatus': '건강상태',
      'diabetes': '당뇨',
      'hypertension': '고혈압',
      'heartDisease': '심장질환',
      'stroke': '뇌졸중',
      'dementia': '치매',
      'jointDisease': '관절질환',
      'kidneyDisease': '신장질환',
      'lungDisease': '폐질환',
      'liverDisease': '간질환',
      'cancer': '암',
      'bloodPressure': '혈압',
      'allergies': '알레르기',
      'walkingAid': '보행보조도구',
      'recentFall': '최근낙상',
      'vision': '시력',
      'hearing': '청력',
      'smoking': '흡연',
      'drinking': '음주',
      'hasSurgery': '수술이력',
      'surgeryDetail': '수술상세',
      'otherDisease': '기타질환',
      'height': '신장',
      'weight': '체중',
      'medicineCount': '복용약수',
      'householdType': '가구형태',
      'housingType': '주거형태',
      'livingCostStatus': '생활비상태',
      'incomeLevel': '소득수준',
      'pensionStatus': '연금수급',
      'currentBenefits': '현재수급',
      'welfareDecision': '복지결정',
    };

    for (final entry in fieldLabels.entries) {
      final val = hv(entry.key);
      if (val.isNotEmpty && val != '없음' && val != '정상' && val != '비해당') {
        healthParts.add('${entry.value}: $val');
      }
    }

    // 복약 정보 (medicationsJson)
    final medsRaw = _healthInfo['medicationsJson'];
    if (medsRaw != null && '$medsRaw'.trim().isNotEmpty && '$medsRaw' != '[]') {
      try {
        final meds = jsonDecode('$medsRaw') as List;
        if (meds.isNotEmpty) {
          final medNames = meds.map((m) => m is Map ? (m['name'] ?? m['약명'] ?? '$m') : '$m').join(', ');
          healthParts.add('복용중인약: $medNames');
        }
      } catch (_) {
        healthParts.add('복용중인약: $medsRaw');
      }
    }

    final basicContext = basicParts.isEmpty ? '' : basicParts.join(' / ');
    final healthContext = healthParts.isEmpty ? '(건강 정보 없음)' : healthParts.join('\n');

    return '너는 $name님($basicContext)의 일상을 돕는 한국어 돌봄 챗봇이다.\n\n'
        '[${name}님 건강·복지 정보 - DB 기준]\n$healthContext\n\n'
        '규칙:\n'
        '- 모든 답변은 자연스러운 한국어 존댓말로 한다.\n'
        '- 위 건강·복지 정보를 반드시 참고하여 개인 상황에 맞게 답변한다.\n'
        '- 이미 알고 있는 정보는 다시 묻지 않는다.\n'
        '- 복지 정책, 건강, 일자리에 대해 간결하게 답변한다.\n'
        '- 이미지가 첨부되면 이미지 내용을 분석하여 답변한다.\n'
        '- 모르면 지어내지 말고 다시 말해 달라고 한다.\n'
        '- 반말, 외국어 섞어 쓰기는 하지 않는다.';
  }

  Future<void> _ask() async {
    final q = _inputCtrl.text.trim();
    final hasImage = _pendingImageBase64 != null;
    if (q.isEmpty && !hasImage || _sending) return;

    _inputCtrl.clear();
    final sentImageBase64 = _pendingImageBase64;
    final sentImageMime = _pendingImageMime;
    if (q.isNotEmpty) _saveMessage('USER', q);
    setState(() {
      _history.add(_AiMsg(role: 'user', text: q, imageBase64: sentImageBase64, imageMime: sentImageMime));
      _pendingImageBase64 = null;
      _pendingImageMime = null;
      _sending = true;
    });
    _scrollToBottom();

    // 프로필 아직 안 불러왔으면 먼저 로드
    if (_healthInfo.isEmpty && _senior.isEmpty) await _loadProfile();

    try {
      final systemPrompt = _buildSystemPrompt();

      // 이전 대화 히스토리 (이미지 없는 텍스트만)
      final prevContents = _history
          .where((m) => !(m.role == 'user' && m.text == q && m.imageBase64 == sentImageBase64))
          .map((m) => {
                'role': m.role == 'assistant' ? 'model' : 'user',
                'parts': [{'text': m.text}],
              })
          .toList();

      // 현재 메시지 파트 (텍스트 + 이미지)
      final userParts = <Map<String, dynamic>>[];
      if (q.isNotEmpty) userParts.add({'text': q});
      if (sentImageBase64 != null) {
        userParts.add({'inlineData': {'mimeType': sentImageMime ?? 'image/jpeg', 'data': sentImageBase64}});
      }

      final contents = [...prevContents, {'role': 'user', 'parts': userParts}];

      final res = await http.post(
        Uri.parse('$_geminiUrl?key=$_geminiApiKey'),
        headers: {'Content-Type': 'application/json; charset=utf-8'},
        body: jsonEncode({
          'system_instruction': {'parts': [{'text': systemPrompt}]},
          'contents': contents,
          'generationConfig': {
            'maxOutputTokens': 400,
            'temperature': 0.5,
          },
        }),
      ).timeout(const Duration(seconds: 30));

      if (!mounted) return;

      if (res.statusCode == 200) {
        final data = jsonDecode(utf8.decode(res.bodyBytes)) as Map<String, dynamic>;
        final answer = (data['candidates'] as List?)
                ?.first['content']['parts']?.first['text']
                ?.toString()
                .trim() ??
            '답변을 가져오지 못했습니다.';
        setState(() => _history.add(_AiMsg(role: 'assistant', text: answer)));
        _saveMessage('ASSISTANT', answer);
      } else {
        // ignore: avoid_print
        print('[Gemini] status=${res.statusCode} body=${res.body}');
        setState(() => _history.add(const _AiMsg(
            role: 'assistant', text: 'AI 서비스에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.')));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _history.add(const _AiMsg(
            role: 'assistant', text: '응답을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.')));
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
                    child: Column(
                      crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                      children: [
                        if (m.imageBase64 != null) ...[
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.memory(
                              base64Decode(m.imageBase64!),
                              width: 200,
                              fit: BoxFit.cover,
                            ),
                          ),
                          const SizedBox(height: 4),
                        ],
                        if (m.text.isNotEmpty)
                          Container(
                            constraints: BoxConstraints(
                              maxWidth: MediaQuery.of(context).size.width * 0.75,
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
                              m.text,
                              style: TextStyle(
                                color: isMine ? Colors.white : const Color(0xFF1F2A20),
                                fontSize: 14,
                                height: 1.5,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
      if (_pendingImageBase64 != null)
        Stack(
          children: [
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              height: 80,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                image: DecorationImage(
                  image: MemoryImage(base64Decode(_pendingImageBase64!)),
                  fit: BoxFit.cover,
                ),
              ),
            ),
            Positioned(
              top: 0,
              right: 8,
              child: GestureDetector(
                onTap: () => setState(() { _pendingImageBase64 = null; _pendingImageMime = null; }),
                child: const CircleAvatar(
                  radius: 12,
                  backgroundColor: Colors.black54,
                  child: Icon(Icons.close, size: 14, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      _InputBar(
        controller: _inputCtrl,
        sending: _sending,
        onSend: _ask,
        onAttach: _pickAiImage,
        hintText: '복지 · 건강 · 일자리에 대해 질문하세요',
      ),
    ]);
  }
}

class _AiMsg {
  const _AiMsg({required this.role, required this.text, this.imageBase64, this.imageMime});
  final String role;
  final String text;
  final String? imageBase64;
  final String? imageMime;
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
      if (url.startsWith('data:')) {
        // Base64 data URL 처리
        final base64Str = url.contains(',') ? url.split(',').last : url;
        return ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.memory(
            base64Decode(base64Str),
            width: 200,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _fileTile(),
          ),
        );
      }
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
