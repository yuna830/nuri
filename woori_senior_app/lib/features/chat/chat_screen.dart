import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:mime/mime.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../core/api/senior_api.dart';
import '../../core/config/app_config.dart';
import '../../core/config/secrets.dart';
import '../job/job_screen.dart';

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
  TabController? _tabController;
  final Set<int> _unreadTabIndices = {};
  Timer? _unreadTimer;

  bool _hasGuardian = true;   // 프로필 로드 전 기본값
  bool _profileLoaded = false;

  // 보호자 유무에 따라 탭 목록이 달라짐
  List<_Tab> get _tabs => [
    if (_hasGuardian) const _Tab('보호자', 'SENIOR_GUARDIAN'),
    const _Tab('복지사', 'SENIOR_WELFARE'),
    const _Tab('AI 도우미', 'AI'),
  ];

  @override
  void initState() {
    super.initState();
    _loadProfileAndInit();
    _unreadTimer = Timer.periodic(
        const Duration(seconds: 10), (_) => _checkUnread());
  }

  /// 프로필에서 hasGuardian 읽어온 뒤 TabController 생성
  Future<void> _loadProfileAndInit() async {
    try {
      final raw = await const SeniorApi().fetchProfile(widget.seniorId);
      final senior = raw['senior'] as Map<String, dynamic>? ?? {};
      _hasGuardian = senior['hasGuardian'] != false; // null/true → true
    } catch (_) {
      _hasGuardian = true; // 오류 시 보수적으로 탭 유지
    }
    if (!mounted) return;
    setState(() {
      _profileLoaded = true;
      _tabController = TabController(length: _tabs.length, vsync: this)
        ..addListener(_onTabChanged);
    });
    _checkUnread();
  }

  void _onTabChanged() {
    if (!(_tabController?.indexIsChanging ?? true)) {
      setState(() => _unreadTabIndices.remove(_tabController!.index));
    }
  }

  Future<void> _checkUnread() async {
    final ctrl = _tabController;
    if (ctrl == null) return;
    final humanTabs = _tabs.where((t) => t.roomType != 'AI').toList();
    for (int i = 0; i < humanTabs.length; i++) {
      if (ctrl.index == i) continue;
      final roomType = humanTabs[i].roomType;
      try {
        final res = await http.get(Uri.parse(
          '$apiBaseUrl/api/chat/senior/${widget.seniorId}?roomType=$roomType&size=10',
        )).timeout(const Duration(seconds: 5));
        if (res.statusCode == 200) {
          final list = jsonDecode(utf8.decode(res.bodyBytes));
          if (list is List && mounted) {
            final hasUnread = list.any((m) =>
                m is Map && m['unreadForSenior'] == true);
            setState(() {
              if (hasUnread) {
                _unreadTabIndices.add(i);
              } else {
                _unreadTabIndices.remove(i);
              }
            });
          }
        }
      } catch (_) {}
    }
  }

  @override
  void dispose() {
    _unreadTimer?.cancel();
    _tabController?.removeListener(_onTabChanged);
    _tabController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 프로필 로드 완료 전 로딩 표시
    if (!_profileLoaded || _tabController == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF5F7F5),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF86A788)),
        ),
      );
    }

    final tabs = _tabs;
    final ctrl = _tabController!;

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
          controller: ctrl,
          labelColor: const Color(0xFF86A788),
          unselectedLabelColor: const Color(0xFF6D766A),
          indicatorColor: const Color(0xFF86A788),
          labelStyle:
              const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
          tabs: List.generate(tabs.length, (i) {
            final t = tabs[i];
            final hasUnread = _unreadTabIndices.contains(i);
            return Tab(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(
                      t.roomType == 'AI'
                          ? Icons.smart_toy_outlined
                          : Icons.chat_bubble_outline,
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(t.label),
                  ]),
                  if (hasUnread)
                    Positioned(
                      top: -4,
                      right: -8,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFFD94E4E),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),
            );
          }),
        ),
      ),
      body: TabBarView(
        controller: ctrl,
        children: List.generate(tabs.length, (i) {
          final t = tabs[i];
          if (t.roomType == 'AI') return _AiChatRoom(seniorId: widget.seniorId);
          return _HumanChatRoom(
            seniorId: widget.seniorId,
            roomType: t.roomType,
            isActive: ctrl.index == i,
            onRead: () {
              if (mounted) setState(() => _unreadTabIndices.remove(i));
            },
          );
        }),
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
  const _HumanChatRoom({
    required this.seniorId,
    required this.roomType,
    required this.isActive,
    required this.onRead,
  });
  final int seniorId;
  final String roomType;
  final bool isActive;
  final VoidCallback onRead;

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
    _load(markRead: widget.isActive);
    if (widget.isActive) {
      _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _load(markRead: true));
    }
  }

  @override
  void didUpdateWidget(_HumanChatRoom old) {
    super.didUpdateWidget(old);
    if (widget.isActive && !old.isActive) {
      _load(markRead: true);
      _pollTimer?.cancel();
      _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _load(markRead: true));
    } else if (!widget.isActive && old.isActive) {
      _pollTimer?.cancel();
      _pollTimer = null;
    }
  }

  @override
  void dispose() {
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool markRead = false}) async {
    try {
      final viewerParam = markRead ? '&viewerRole=SENIOR' : '';
      final res = await http.get(Uri.parse(
          '$apiBaseUrl/api/chat/senior/${widget.seniorId}'
          '?roomType=${widget.roomType}$viewerParam&size=100'));
      if (!mounted) return;
      if (res.statusCode == 200) {
        final list = jsonDecode(utf8.decode(res.bodyBytes));
        if (list is List) {
          setState(() {
            _messages = list.whereType<Map<String, dynamic>>().toList();
            _loading = false;
          });
          _scrollToBottom();
          if (markRead) widget.onRead();
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
      await _load(markRead: true);
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

      // 서버에 업로드 후 URL 받아서 전송
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$apiBaseUrl/api/uploads/chat'),
      )..files.add(http.MultipartFile.fromBytes(
          'image',
          bytes,
          filename: name,
        ));
      final streamed = await request.send().timeout(const Duration(seconds: 15));
      final body = await streamed.stream.bytesToString();

      if (streamed.statusCode < 200 || streamed.statusCode >= 300) {
        throw Exception('업로드 실패');
      }

      final data = jsonDecode(body) as Map<String, dynamic>;
      final fileUrl = data['fileUrl'] as String? ?? data['imageUrl'] as String? ?? '';
      final fileName = data['fileName'] as String? ?? name;

      await _send(attachUrl: fileUrl, attachName: fileName, attachType: mime);
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
  final FlutterTts _tts = FlutterTts();
  final SpeechToText _stt = SpeechToText();

  final List<_AiMsg> _history = [];
  bool _sending = false;
  bool _ttsEnabled = true;
  bool _isListening = false;
  bool _sttAvailable = false;
  String _sttLocaleId = 'ko_KR';
  Map<String, dynamic> _senior = {};
  Map<String, dynamic> _healthInfo = {};
  // 전화 연결용 연락처
  String _guardianPhone = '';
  String _guardianName = '';
  String _guardianRelation = '';   // 아들, 딸 등 프로필에 저장된 관계
  String _welfarePhone = '';
  String _welfareName = '';
  String? _pendingImageBase64;
  String? _pendingImageMime;
  String? _pendingOcrContext;
  int? _conversationId;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _initConversation();
    _initTts();
    _initStt();
  }

  Future<void> _initTts() async {
    await _tts.setLanguage('ko-KR');
    await _tts.setSpeechRate(0.45);
    await _tts.setVolume(1.0);
  }

  Future<void> _initStt() async {
    _sttAvailable = await _stt.initialize(
      onError: (error) {
        debugPrint('[STT] 에러: ${error.errorMsg} (permanent: ${error.permanent})');
        if (mounted) setState(() => _isListening = false);
      },
      onStatus: (status) {
        debugPrint('[STT] 상태: $status');
        if (mounted &&
            (status == SpeechToText.doneStatus ||
                status == SpeechToText.notListeningStatus)) {
          setState(() => _isListening = false);
        }
      },
    );
    debugPrint('[STT] 초기화 결과: $_sttAvailable');
    if (_sttAvailable) {
      final locales = await _stt.locales();
      debugPrint('[STT] 사용 가능한 locale: ${locales.map((l) => l.localeId).join(', ')}');
      final koLocale = locales.firstWhere(
        (l) => l.localeId.toLowerCase().startsWith('ko'),
        orElse: () => LocaleName('ko-KR', '한국어'),
      );
      _sttLocaleId = koLocale.localeId;
      debugPrint('[STT] 선택된 locale: $_sttLocaleId');
    }
    if (mounted) setState(() {});
  }

  Future<void> _toggleListening() async {
    if (_isListening) {
      await _stt.stop();
      setState(() => _isListening = false);
    } else if (_sttAvailable) {
      debugPrint('[STT] 인식 시작, locale: ${_sttLocaleId.replaceAll('_', '-')}');
      setState(() => _isListening = true);
      await _stt.listen(
        onResult: (result) {
          debugPrint('[STT] 결과: "${result.recognizedWords}" (final: ${result.finalResult})');
          if (mounted) {
            setState(() {
              _inputCtrl.text = result.recognizedWords;
              _inputCtrl.selection = TextSelection.fromPosition(
                TextPosition(offset: _inputCtrl.text.length),
              );
              if (result.finalResult) _isListening = false;
            });
          }
        },
        localeId: _sttLocaleId.replaceAll('_', '-'),
        listenFor: const Duration(seconds: 30),
        pauseFor: const Duration(seconds: 3),
        cancelOnError: true,
        partialResults: true,
      );
    } else {
      debugPrint('[STT] STT 사용 불가 (_sttAvailable: $_sttAvailable)');
    }
  }

  Future<void> _speak(String text) async {
    if (!_ttsEnabled || !mounted) return;
    final clean = text
        .replaceAll(RegExp(r'\[WOORI_ACTION_CARD\][\s\S]*?\[/WOORI_ACTION_CARD\]'), '')
        .replaceAll(RegExp(r'\[.*?\]'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (clean.isEmpty) return;
    await _tts.stop();
    await _tts.speak(clean);
  }

  // OCR: 음식 이미지 → 백엔드 분석 (서버 없으면 null 반환)
  Future<String?> _analyzeFood(List<int> bytes, String mime) async {
    try {
      final ext = mime.contains('png') ? 'png' : 'jpg';
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$chatApiBaseUrl/food/analyze-image'),
      )..files.add(http.MultipartFile.fromBytes(
          'image', bytes, filename: 'food.$ext'));
      final streamed = await request.send().timeout(const Duration(seconds: 15));
      if (streamed.statusCode == 200) {
        final body = await streamed.stream.bytesToString();
        final data = jsonDecode(body) as Map<String, dynamic>;
        final sb = StringBuffer('[식품 분석 결과]\n');
        if (data['product_name'] != null) sb.writeln('제품명: ${data['product_name']}');
        if (data['ocr_text'] != null) sb.writeln('인식 텍스트:\n${data['ocr_text']}');
        if (data['nutrients'] != null) sb.writeln('영양성분: ${data['nutrients']}');
        if (data['allergens'] != null) sb.writeln('알레르기: ${data['allergens']}');
        return sb.toString().trim();
      }
    } catch (_) {}
    return null;
  }

  @override
  void dispose() {
    _tts.stop();
    _inputCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final raw = await _api.fetchProfile(widget.seniorId);
      final s = raw['senior'] as Map<String, dynamic>? ?? {};
      final h = raw['healthInfo'] as Map<String, dynamic>? ?? {};
      if (mounted) {
        setState(() {
          _senior = s;
          _healthInfo = h;
          _guardianPhone    = (raw['guardianPhone']      as String? ?? '').trim();
          _guardianName     = (raw['guardianName']       as String? ?? '').trim();
          _guardianRelation = (raw['relation']           as String? ?? '').trim();
          _welfarePhone     = (raw['socialWorkerPhone']  as String? ?? '').trim();
          _welfareName      = (raw['socialWorkerName']   as String? ?? '').trim();
        });
      }
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
          final msgs = list.map((m) {
            final raw = m['content'] as String? ?? '';
            final (text, urls) = _decodeImgUrls(raw);
            return _AiMsg(
              role: (m['role'] as String).toLowerCase() == 'user' ? 'user' : 'assistant',
              text: text,
              imageUrl: urls.isNotEmpty ? urls.first : null,
            );
          }).toList();
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

  // 이미지를 서버에 업로드하고 URL 반환
  Future<String?> _uploadImage(List<int> bytes, String mime) async {
    try {
      final uri = Uri.parse('$apiBaseUrl/api/uploads/profile');
      final ext = mime.contains('png') ? 'png' : 'jpg';
      final request = http.MultipartRequest('POST', uri)
        ..files.add(http.MultipartFile.fromBytes(
          'image', bytes,
          filename: 'chat_${DateTime.now().millisecondsSinceEpoch}.$ext',
        ));
      final streamed = await request.send().timeout(const Duration(seconds: 15));
      final body = await streamed.stream.bytesToString();
      if (streamed.statusCode >= 200 && streamed.statusCode < 300) {
        final data = jsonDecode(body) as Map<String, dynamic>;
        final url = '${data['fileUrl'] ?? data['imageUrl'] ?? ''}';
        return url.isNotEmpty ? url : null;
      }
    } catch (_) {}
    return null;
  }

  void _addWelcome() {
    if (mounted && _history.isEmpty) {
      setState(() => _history.add(const _AiMsg(
        role: 'assistant',
        text: '안녕하세요! 복지 정보나 건강에 대해 궁금한 것을 물어보세요. 😊',
      )));
    }
  }

  Future<void> _saveMessage(String role, String content, {String? imageUrl}) async {
    if (_conversationId == null) return;
    try {
      final encoded = imageUrl != null
          ? _encodeImgUrls(content, [imageUrl])
          : content;
      await http.post(
        Uri.parse('$apiBaseUrl/api/assistant-conversations/$_conversationId/messages?seniorId=${widget.seniorId}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'role': role.toUpperCase(), 'content': encoded}),
      ).timeout(const Duration(seconds: 6));
    } catch (_) {}
  }

  Future<void> _pickAiImage() async {
    final picked = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 80);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    final mime = lookupMimeType(picked.path) ?? 'image/jpeg';
    // OCR 분석 시도 (백엔드 없으면 null)
    final ocrResult = await _analyzeFood(bytes, mime);
    setState(() {
      _pendingImageBase64 = base64Encode(bytes);
      _pendingImageMime = mime;
      _pendingOcrContext = ocrResult;
    });
  }

  // ──────────────────────────────────────────────
  // 전화 연결 기능
  // ──────────────────────────────────────────────

  /// 메시지에서 전화 요청 의도를 감지한다.
  /// 반환값: 'guardian' | 'welfare' | null
  String? _detectCallIntent(String message) {
    // 전화 관련 동작 키워드
    const callVerbs = ['전화', '통화', '연락', '연결', '불러'];
    if (!callVerbs.any((k) => message.contains(k))) return null;

    // 복지사 키워드 (선생님은 복지사 먼저 매칭)
    final welfareKeywords = <String>[
      '복지사', '사회복지사', '담당자', '선생님', '선생',
      if (_welfareName.isNotEmpty) _welfareName,
    ];

    // 보호자 키워드 (프로필 이름·관계 포함)
    final guardianKeywords = <String>[
      '보호자', '가족',
      // 일반적인 가족 호칭
      '엄마', '아빠', '어머니', '아버지', '아들', '딸',
      '남편', '아내', '오빠', '언니', '형', '누나',
      '할머니', '할아버지', '손자', '손녀',
      '며느리', '사위', '삼촌', '이모', '고모', '조카',
      if (_guardianRelation.isNotEmpty) _guardianRelation,
      if (_guardianName.isNotEmpty) _guardianName,
    ];

    // 복지사 먼저 체크 (선생님 → 복지사 우선)
    if (welfareKeywords.any((k) => k.isNotEmpty && message.contains(k))) {
      return 'welfare';
    }
    if (guardianKeywords.any((k) => k.isNotEmpty && message.contains(k))) {
      return 'guardian';
    }

    // "전화해줘"처럼 대상 불명확 → 보호자를 기본으로
    return 'guardian';
  }

  /// 전화 확인 다이얼로그를 표시하고 확인 시 전화를 건다.
  Future<void> _showCallConfirmDialog(String target) async {
    final isGuardian = target == 'guardian';
    final name  = isGuardian ? _guardianName  : _welfareName;
    final phone = isGuardian ? _guardianPhone : _welfarePhone;
    final label = isGuardian ? '보호자' : '복지사';

    if (phone.isEmpty) {
      final msg = '$label 전화번호가 등록되어 있지 않아요.';
      if (mounted) {
        setState(() => _history.add(_AiMsg(role: 'assistant', text: msg)));
        _speak(msg);
      }
      return;
    }

    final displayName = name.isNotEmpty ? '$name $label' : label;

    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(children: [
          const Icon(Icons.phone, color: Color(0xFF86A788), size: 28),
          const SizedBox(width: 8),
          Expanded(
            child: Text('$displayName\n전화할까요?',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
          ),
        ]),
        content: Text(phone,
            style: const TextStyle(
                fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF2E7D32),
                letterSpacing: 1.5)),
        actionsAlignment: MainAxisAlignment.spaceEvenly,
        actions: [
          OutlinedButton.icon(
            onPressed: () => Navigator.pop(ctx, false),
            icon: const Icon(Icons.close),
            label: const Text('취소', style: TextStyle(fontSize: 16)),
          ),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF86A788)),
            onPressed: () => Navigator.pop(ctx, true),
            icon: const Icon(Icons.phone),
            label: const Text('전화하기', style: TextStyle(fontSize: 16)),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      await _makeCall(phone);
    }
  }

  /// 플랫폼 채널을 통해 전화를 건다.
  Future<void> _makeCall(String phone) async {
    final number = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (number.isEmpty) return;
    try {
      await const MethodChannel('com.woori/phone').invokeMethod('dial', number);
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('전화 앱을 열 수 없어요. ($number)')),
        );
      }
    }
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

    return '너는 $name님($basicContext)의 일상을 돕는 한국어 돌봄 챗봇이다. 대화 상대는 어르신이므로 쉽고 따뜻하게 설명한다.\n\n'
        '[${name}님 건강·복지 정보 - DB 기준]\n$healthContext\n\n'
        '답변 방식:\n'
        '- 어르신이 이해하기 쉽도록 의학 용어 대신 쉬운 말로 풀어서 설명한다. 예) "혈당" → "피 속의 당 수치", "인슐린" → "혈당을 조절하는 주사약"\n'
        '- 단순히 "먹지 마세요"가 아니라 왜 조심해야 하는지 이유를 함께 설명한다.\n'
        '- 대안이나 조언도 함께 제시한다. 예) "대신 ○○은 조금 드셔도 괜찮아요", "드신다면 소량만, 식후 바로 드세요"\n'
        '- 답변은 3~5문장 내외로 핵심만 담되, 건강 경고가 필요한 경우엔 이유·대안을 포함해 충분히 설명한다.\n'
        '- 문장 끝은 "~하세요", "~해요", "~랍니다" 처럼 친근하고 부드럽게 마무리한다.\n\n'
        '규칙:\n'
        '- 음식 질문 시 건강 상태를 반드시 반영한다:\n'
        '  · 당뇨가 있거나 인슐린·혈당 관련 약을 복용/투여 중이면, 당분·탄수화물이 많은 음식(케이크·빵·떡·단음료·과자 등)은 "피 속 당 수치를 갑자기 높일 수 있어서 조심하셔야 해요"처럼 이유와 함께 경고하고, 먹고 싶을 때 어떻게 하면 좋은지 대안도 알려준다.\n'
        '  · 고혈압이 있으면 짠 음식, 신장질환이 있으면 고단백·고칼륨 음식도 같은 방식으로 이유를 설명하며 경고한다.\n'
        '  · 복용 중인 약이 있으면 해당 약과 음식의 상호작용을 쉬운 말로 설명한다.\n'
        '  · 위 조건에 해당하지 않으면 간단히 답변한다.\n'
        '- 알레르기는 질문한 음식에 해당 성분이 실제로 들어가는 경우에만 언급한다.\n'
        '- 건강·복지 정보 중 질문과 무관한 항목은 언급하지 않는다.\n'
        '- 이미 알고 있는 정보는 다시 묻지 않는다.\n'
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
    // 이미지 업로드 → URL 획득
    String? uploadedImageUrl;
    if (sentImageBase64 != null) {
      final bytes = base64Decode(sentImageBase64);
      uploadedImageUrl = await _uploadImage(bytes, sentImageMime ?? 'image/jpeg');
    }

    final ocrContext = _pendingOcrContext;
    _saveMessage('USER', q, imageUrl: uploadedImageUrl);
    setState(() {
      _history.add(_AiMsg(role: 'user', text: q, imageBase64: sentImageBase64, imageMime: sentImageMime, imageUrl: uploadedImageUrl));
      _pendingImageBase64 = null;
      _pendingImageMime = null;
      _pendingOcrContext = null;
      _sending = true;
    });
    _scrollToBottom();

    // 일자리 관련 질문이면 Gemini 대신 액션 카드 바로 반환
    if (_isJobRelated(q) && sentImageBase64 == null) {
      final actionCardJson = jsonEncode({
        'type': 'job_recommendation',
        'title': '맞춤 추천 TOP 5 보기',
        'description': '건강 정보와 희망 조건을 기준으로 계산한 일자리 추천을 확인해요.',
        'href': '/jobs',
        'buttonLabel': '일자리 공고 보러가기',
      });
      const intro = '맞춤 일자리 추천은 공고 화면에서 TOP 5로 크게 볼 수 있어요.';
      final answer = '$intro\n\n[WOORI_ACTION_CARD]\n$actionCardJson\n[/WOORI_ACTION_CARD]';
      _saveMessage('ASSISTANT', answer);
      if (mounted) {
        setState(() {
          _history.add(_AiMsg(role: 'assistant', text: answer));
          _sending = false;
        });
        _scrollToBottom();
      }
      return;
    }

    // 전화 요청 감지 (이미지 없는 텍스트 메시지에만 적용)
    if (sentImageBase64 == null) {
      final callTarget = _detectCallIntent(q);
      if (callTarget != null) {
        if (mounted) setState(() => _sending = false);
        await _showCallConfirmDialog(callTarget);
        return;
      }
    }

    // 매 질문마다 최신 건강·복약 정보로 갱신
    await _loadProfile();

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

      // 현재 메시지 파트 (OCR 컨텍스트 + 텍스트 + 이미지)
      final userParts = <Map<String, dynamic>>[];
      if (ocrContext != null) {
        // OCR 분석 결과를 시스템 컨텍스트로 앞에 추가
        userParts.add({'text': '$ocrContext\n\n위 분석 결과를 참고하여 답해주세요. 사용자 질문: ${q.isEmpty ? '이 음식 먹어도 될까요?' : q}'});
      } else if (q.isNotEmpty) {
        userParts.add({'text': q});
      }
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
        _speak(answer);
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
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        color: const Color(0xFF86A788).withValues(alpha: 0.1),
        child: Row(children: [
          const Expanded(
            child: Text(
              '🤖 건강 · 일자리 · 음식에 대해 질문해보세요',
              textAlign: TextAlign.center,
              style: TextStyle(
                  color: Color(0xFF2D5A2E),
                  fontSize: 12,
                  fontWeight: FontWeight.w700),
            ),
          ),
          GestureDetector(
            onTap: () => setState(() {
              _ttsEnabled = !_ttsEnabled;
              if (!_ttsEnabled) _tts.stop();
            }),
            child: Icon(
              _ttsEnabled ? Icons.volume_up : Icons.volume_off,
              color: const Color(0xFF86A788),
              size: 20,
            ),
          ),
        ]),
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
            final actionCard = !isMine ? _parseActionCard(m.text) : null;
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
                        if (m.imageBase64 != null || m.imageUrl != null) ...[
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: m.imageBase64 != null
                                ? Image.memory(
                                    base64Decode(m.imageBase64!),
                                    width: 200, fit: BoxFit.cover,
                                  )
                                : Image.network(
                                    m.imageUrl!.startsWith('/')
                                        ? '$apiBaseUrl${m.imageUrl}'
                                        : m.imageUrl!,
                                    width: 200, fit: BoxFit.cover,
                                    errorBuilder: (_, __, ___) =>
                                        const Icon(Icons.broken_image, size: 48),
                                  ),
                          ),
                          const SizedBox(height: 4),
                        ],
                        if (m.text.isNotEmpty)
                          actionCard != null
                              ? _ActionCardWidget(
                                  intro: actionCard.intro,
                                  title: actionCard.title,
                                  description: actionCard.description,
                                  buttonLabel: actionCard.buttonLabel,
                                  seniorId: widget.seniorId,
                                )
                              : Container(
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
        onMic: _sttAvailable ? _toggleListening : null,
        isListening: _isListening,
        hintText: '건강 · 일자리 · 음식에 대해 질문하세요',
      ),
    ]);
  }
}

// 웹앱과 동일한 이미지 URL 인코딩 마커
const _imgStart = '[WOORI_IMAGE_URLS]';
const _imgEnd = '[/WOORI_IMAGE_URLS]';

String _encodeImgUrls(String content, List<String> urls) {
  if (urls.isEmpty) return content;
  return '$content\n\n$_imgStart${jsonEncode(urls)}$_imgEnd';
}

(String, List<String>) _decodeImgUrls(String raw) {
  final pattern = RegExp(
    RegExp.escape(_imgStart) + r'([\s\S]*?)' + RegExp.escape(_imgEnd) + r'\s*$',
  );
  final match = pattern.firstMatch(raw);
  if (match == null) return (raw.trim(), []);
  try {
    final urls = (jsonDecode(match.group(1)!) as List).cast<String>();
    final content = raw.replaceFirst(pattern, '').trim();
    return (content, urls);
  } catch (_) {
    return (raw.trim(), []);
  }
}

// ─── 일자리 액션 카드 ─────────────────────────────────────────────────────────

bool _isJobRelated(String text) {
  final normalized = text.replaceAll(RegExp(r'\s+'), '');
  return RegExp(r'일자리공고|일자리|일할곳|구인|공고|채용|알바|근무').hasMatch(normalized);
}

({String intro, String title, String description, String buttonLabel})?
    _parseActionCard(String text) {
  final match = RegExp(r'\[WOORI_ACTION_CARD\]([\s\S]*?)\[\/WOORI_ACTION_CARD\]')
      .firstMatch(text);
  if (match == null) return null;
  try {
    final intro = text.replaceFirst(match.group(0)!, '').trim();
    final data = jsonDecode(match.group(1)!.trim()) as Map<String, dynamic>;
    return (
      intro: intro,
      title: data['title'] as String? ?? '일자리 추천',
      description: data['description'] as String? ?? '',
      buttonLabel: data['buttonLabel'] as String? ?? '바로가기',
    );
  } catch (_) {
    return null;
  }
}

class _AiMsg {
  const _AiMsg({required this.role, required this.text, this.imageBase64, this.imageMime, this.imageUrl});
  final String role;
  final String text;
  final String? imageBase64; // 즉시 표시용 (전송 직후)
  final String? imageMime;
  final String? imageUrl;    // 서버 저장 URL (히스토리 복원용)
}

// ─── 공통 위젯 ────────────────────────────────────────────────────────────────

class _ActionCardWidget extends StatelessWidget {
  const _ActionCardWidget({
    required this.intro,
    required this.title,
    required this.description,
    required this.buttonLabel,
    required this.seniorId,
  });
  final String intro;
  final String title;
  final String description;
  final String buttonLabel;
  final int seniorId;

  @override
  Widget build(BuildContext context) {
    final maxWidth = MediaQuery.of(context).size.width * 0.78;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (intro.isNotEmpty) ...[
          Container(
            constraints: BoxConstraints(maxWidth: maxWidth),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(4),
                bottomRight: Radius.circular(16),
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
              intro,
              style: const TextStyle(
                color: Color(0xFF1F2A20),
                fontSize: 14,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
        Container(
          constraints: BoxConstraints(maxWidth: maxWidth),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF2F5D3A),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.12),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (description.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  description,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ],
              const SizedBox(height: 14),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => JobScreen(
                        seniorId: seniorId,
                        hideAppBar: false,
                      ),
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: const Color(0xFF2F5D3A),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                    ),
                    elevation: 0,
                  ),
                  child: Text(
                    buttonLabel,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

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
    this.onMic,
    this.isListening = false,
    this.hintText = '메시지를 입력하세요...',
  });
  final TextEditingController controller;
  final bool sending;
  final VoidCallback onSend;
  final VoidCallback? onAttach;
  final VoidCallback? onMic;
  final bool isListening;
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
              hintStyle: const TextStyle(fontSize: 14, color: Color(0xFFCECECE)),
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
        if (onMic != null) ...[
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onMic,
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isListening
                    ? const Color(0xFFD94E4E)
                    : const Color(0xFF86A788).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isListening ? Icons.mic : Icons.mic_none,
                color: isListening ? Colors.white : const Color(0xFF86A788),
                size: 20,
              ),
            ),
          ),
        ],
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
