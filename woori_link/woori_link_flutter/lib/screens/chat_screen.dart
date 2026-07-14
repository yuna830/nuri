import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:intl/intl.dart';
import '../api/assistant_conversation_api.dart';
import '../api/schedule_api.dart';
import '../api/senior_api.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  int? _seniorId;
  dynamic _activeConversationId;
  List<dynamic> _conversations = [];
  List<dynamic> _todaySchedules = [];
  Map<String, dynamic>? _senior;
  List<_ChatMessage> _messages = [];
  ChatSession? _chat;
  bool _loading = true;
  bool _sending = false;
  bool _apiKeyMissing = false;

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) {
        setState(() {
          _messages = _welcomeMessages();
          _loading = false;
        });
        return;
      }

      final results = await Future.wait([
        SeniorApi.getSenior(seniorId).catchError((_) => <String, dynamic>{}),
        ScheduleApi.fetchTodaySchedules(seniorId).catchError((_) => <dynamic>[]),
        AssistantConversationApi.fetchConversations(seniorId)
            .catchError((_) => <dynamic>[]),
      ]);

      _seniorId = seniorId;
      _senior = results[0] as Map<String, dynamic>;
      _todaySchedules = results[1] as List<dynamic>;
      _conversations = results[2] as List<dynamic>;
      _initGemini();

      if (_conversations.isNotEmpty) {
        await _openConversation(_conversations.first['id']);
      } else {
        await _createConversation();
      }
    } catch (_) {
      setState(() {
        _messages = _welcomeMessages();
        _loading = false;
      });
    }
  }

  void _initGemini() {
    final apiKey = dotenv.env['VITE_GEMINI_API_KEY'] ??
        dotenv.env['GEMINI_API_KEY'] ??
        dotenv.env['GOOGLE_API_KEY'];
    if (apiKey == null || apiKey.trim().isEmpty) {
      _apiKeyMissing = true;
      return;
    }

    final model = GenerativeModel(
      model: dotenv.env['VITE_GEMINI_MODEL'] ?? 'gemini-2.5-flash-lite',
      apiKey: apiKey,
      systemInstruction: Content.system(_systemPrompt()),
      generationConfig: GenerationConfig(
        maxOutputTokens: 180,
        temperature: 0.5,
      ),
    );
    _chat = model.startChat();
  }

  String _systemPrompt() {
    final name = (_senior?['name'] ?? '').toString().trim();
    final userLabel = name.isNotEmpty ? '$name님' : '사용자님';
    return '''
너는 $userLabel의 일상을 돕는 한국어 돌봄 챗봇이다.

규칙:
- 모든 답변은 자연스러운 한국어 존댓말로 한다.
- 사용자를 부를 때 "보호대상자"라고 하지 말고 "$userLabel"이라고 부른다.
- 일반 답변은 1~3문장으로 짧고 확실하게 말한다.
- 일정, 날짜, 시간, 날씨는 앱에서 먼저 처리하므로 추측하지 않는다.
- 리콜 제품 확인을 물으면 외부 사이트보다 우리 앱 하단의 리콜 탭을 먼저 안내한다.
- 리콜 탭에서는 제품 사진 OCR, 바코드/QR 스캔, 직접 입력으로 보유 제품을 등록하고 제품안전정보센터 리콜 데이터와 자동 매칭할 수 있다고 설명한다.
- 리콜 대상이면 앱에서 리콜 조치 요청을 보낼 수 있고 보호자/복지사에게 미조치 대상으로 전달된다고 안내한다.
- 모르면 지어내지 말고 다시 말해 달라고 한다.
- 응급 상황이면 즉시 119 또는 보호자/복지사에게 연락하라고 안내한다.
- 반말, 과한 농담, 외국어 섞어 쓰기는 하지 않는다.
''';
  }

  List<_ChatMessage> _welcomeMessages() {
    final messages = [
      _ChatMessage.assistant(
        _withUserGreeting('안녕하세요. 무엇을 도와드릴까요? 일정 확인, 리콜 제품 확인, 긴급 도움을 물어볼 수 있어요.'),
      ),
    ];

    final briefs = _todaySchedules.where(_isRemainingTodaySchedule).map(_formatScheduleBrief).toList();
    if (briefs.isNotEmpty) {
      messages.add(_ChatMessage.assistant('남은 오늘 일정은 ${briefs.join(', ')}입니다.'));
    }
    if (_apiKeyMissing) {
      messages.add(_ChatMessage.assistant(
        '.env에 VITE_GEMINI_API_KEY 또는 GEMINI_API_KEY를 설정하면 AI 답변을 사용할 수 있습니다.',
      ));
    }
    return messages;
  }

  String _withUserGreeting(String text) {
    final name = (_senior?['name'] ?? '').toString().trim();
    if (name.isEmpty) return text;
    return '$name님, $text';
  }

  Future<void> _openConversation(dynamic conversationId) async {
    final seniorId = _seniorId;
    if (seniorId == null) return;
    try {
      final savedMessages =
          await AssistantConversationApi.fetchMessages(seniorId, conversationId);
      setState(() {
        _activeConversationId = conversationId;
        _messages = savedMessages.isEmpty
            ? _welcomeMessages()
            : savedMessages
                .where((message) => message['hidden'] != true)
                .map((message) => _ChatMessage(
                      role: '${message['role'] ?? 'assistant'}'.toLowerCase(),
                      content: '${message['content'] ?? ''}',
                      createdAt: _parseDate(message['createdAt']),
                    ))
                .toList();
        _loading = false;
      });
      _scrollToBottom();
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _createConversation() async {
    final seniorId = _seniorId;
    if (seniorId == null) return;
    try {
      final conversation =
          await AssistantConversationApi.createConversation(seniorId);
      final nextMessages = _welcomeMessages();
      setState(() {
        _activeConversationId = conversation['id'];
        _conversations = [conversation, ..._conversations];
        _messages = nextMessages;
        _loading = false;
      });
      for (final message in nextMessages) {
        await _saveMessage(message);
      }
      _scrollToBottom();
    } catch (_) {
      setState(() {
        _messages = _welcomeMessages();
        _loading = false;
      });
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    final userMessage = _ChatMessage.user(text);
    setState(() {
      _messages.add(userMessage);
      _sending = true;
    });
    _controller.clear();
    _scrollToBottom();
    await _saveMessage(userMessage);

    final localAnswer = _answerLocally(text);
    if (localAnswer != null) {
      await _addAssistantAnswer(localAnswer);
      return;
    }

    if (_apiKeyMissing || _chat == null) {
      await _addAssistantAnswer('Gemini API 키가 설정되지 않았어요. .env에 키를 넣고 다시 실행해 주세요.');
      return;
    }

    try {
      final historyText = _messages
          .where((message) => message.content.trim().isNotEmpty)
          .take(12)
          .map((message) => '${message.role == 'user' ? '사용자' : '챗봇'}: ${message.content}')
          .join('\n');
      final scheduleText = _todaySchedules.isEmpty
          ? '오늘 등록된 일정 없음'
          : _todaySchedules.map(_scheduleToText).join('\n');
      final response = await _chat!.sendMessage(
        Content.text('''
최근 대화:
$historyText

오늘 일정:
$scheduleText

사용자 질문:
$text
'''),
      );
      final answer = response.text?.trim();
      await _addAssistantAnswer(
        answer?.isNotEmpty == true ? answer! : '답변을 만들지 못했어요. 다시 말씀해 주세요.',
      );
      await _maybeUpdateTitle(text);
    } catch (_) {
      await _addAssistantAnswer('답변을 가져오지 못했어요. 잠시 후 다시 말씀해 주세요.');
    }
  }

  String? _answerLocally(String text) {
    final normalized = text.replaceAll(' ', '');
    if (normalized.contains('오늘') && normalized.contains('일정')) {
      final briefs =
          _todaySchedules.where(_isRemainingTodaySchedule).map(_formatScheduleBrief).toList();
      if (briefs.isEmpty) return '남은 오늘 일정은 없어요.';
      return '남은 오늘 일정은 ${briefs.join(', ')}입니다.';
    }
    if (normalized.contains('리콜')) {
      return '하단의 리콜 탭에서 보유 제품을 등록하면 제품안전정보센터 리콜 데이터와 자동으로 비교해 드려요. 제품 사진 OCR, 바코드/QR 스캔, 직접 입력으로 등록할 수 있고, 리콜 대상이면 리콜 조치 요청을 눌러 보호자와 복지사에게 미조치 대상으로 알릴 수 있어요.';
    }
    if (normalized.contains('119') ||
        normalized.contains('응급') ||
        normalized.contains('긴급') ||
        normalized.contains('SOS')) {
      return '응급 상황이면 즉시 119에 전화해 주세요. 가능하면 보호자나 담당 복지사에게도 바로 알려주세요.';
    }
    return null;
  }

  Future<void> _addAssistantAnswer(String text) async {
    final assistantMessage = _ChatMessage.assistant(text);
    setState(() {
      _messages.add(assistantMessage);
      _sending = false;
    });
    await _saveMessage(assistantMessage);
    _scrollToBottom();
  }

  Future<void> _saveMessage(_ChatMessage message) async {
    final seniorId = _seniorId;
    final conversationId = _activeConversationId;
    if (seniorId == null || conversationId == null) return;
    try {
      await AssistantConversationApi.saveMessage(
        seniorId,
        conversationId,
        {
          'role': message.role,
          'content': message.content,
        },
      );
    } catch (_) {
      // Chat should continue even if persistence is temporarily unavailable.
    }
  }

  Future<void> _maybeUpdateTitle(String text) async {
    final seniorId = _seniorId;
    final conversationId = _activeConversationId;
    if (seniorId == null || conversationId == null || _messages.length > 4) return;
    final title = text.length > 18 ? '${text.substring(0, 18)}...' : text;
    try {
      await AssistantConversationApi.updateTitle(seniorId, conversationId, title);
      setState(() {
        _conversations = _conversations
            .map((conversation) => conversation['id'] == conversationId
                ? {...conversation, 'title': title}
                : conversation)
            .toList();
      });
    } catch (_) {
      // Title updates are cosmetic.
    }
  }

  Future<void> _deleteConversation(dynamic conversationId) async {
    final seniorId = _seniorId;
    if (seniorId == null) return;
    try {
      await AssistantConversationApi.deleteConversation(seniorId, conversationId);
      setState(() {
        _conversations =
            _conversations.where((conversation) => conversation['id'] != conversationId).toList();
      });
      if (_activeConversationId == conversationId) {
        if (_conversations.isEmpty) {
          await _createConversation();
        } else {
          await _openConversation(_conversations.first['id']);
        }
      }
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('대화를 삭제하지 못했습니다.')),
      );
    }
  }

  DateTime _parseDate(dynamic value) {
    if (value == null) return DateTime.now();
    return DateTime.tryParse('$value') ?? DateTime.now();
  }

  bool _isRemainingTodaySchedule(dynamic schedule) {
    final date = '${schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    if (date.isNotEmpty && date != today) return false;
    final time = '${schedule['scheduleTime'] ?? schedule['time'] ?? ''}';
    if (time.isEmpty) return true;
    final parts = time.split(':');
    if (parts.length < 2) return true;
    final scheduledAt = DateTime(
      DateTime.now().year,
      DateTime.now().month,
      DateTime.now().day,
      int.tryParse(parts[0]) ?? 0,
      int.tryParse(parts[1]) ?? 0,
    );
    return scheduledAt.isAfter(DateTime.now());
  }

  String _formatScheduleBrief(dynamic schedule) {
    final title = '${schedule['title'] ?? schedule['content'] ?? schedule['memo'] ?? '일정'}';
    final time = '${schedule['scheduleTime'] ?? schedule['time'] ?? ''}';
    if (time.isEmpty) return title;
    return '${_formatTime(time)} $title';
  }

  String _scheduleToText(dynamic schedule) {
    final date = '${schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
    return '$date ${_formatScheduleBrief(schedule)}'.trim();
  }

  String _formatTime(String time) {
    final parts = time.split(':');
    if (parts.length < 2) return time;
    final hour = int.tryParse(parts[0]) ?? 0;
    final minute = int.tryParse(parts[1]) ?? 0;
    final period = hour < 12 ? '오전' : '오후';
    final displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    return '$period $displayHour:${minute.toString().padLeft(2, '0')}';
  }

  void _sendQuickQuestion(String text) {
    _controller.text = text;
    _send();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('상담 챗봇'),
        actions: [
          IconButton(
            tooltip: '대화 목록',
            onPressed: _openConversationSheet,
            icon: const Icon(Icons.menu),
          ),
          IconButton(
            tooltip: '새 대화',
            onPressed: () => _createConversation(),
            icon: const Icon(Icons.add_comment_outlined),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _TodaySchedulePanel(
              schedules: _todaySchedules,
              formatScheduleBrief: _formatScheduleBrief,
            ),
            _QuickQuestions(onTap: _sendQuickQuestion),
            Expanded(
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                itemCount: _messages.length + (_sending ? 1 : 0),
                itemBuilder: (context, index) {
                  if (_sending && index == _messages.length) {
                    return const _TypingBubble();
                  }
                  return _MessageBubble(message: _messages[index]);
                },
              ),
            ),
            _ChatInput(
              controller: _controller,
              sending: _sending,
              onSend: _send,
            ),
          ],
        ),
      ),
    );
  }

  void _openConversationSheet() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: [
            Row(
              children: [
                const Text(
                  '대화 목록',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _createConversation();
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('새 대화'),
                ),
              ],
            ),
            if (_conversations.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Text('저장된 대화가 없습니다.', style: TextStyle(color: kTextMuted)),
              ),
            ..._conversations.map((conversation) {
              final id = conversation['id'];
              final title = '${conversation['title'] ?? '새 대화'}';
              final selected = id == _activeConversationId;
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(
                  selected ? Icons.chat_bubble : Icons.chat_bubble_outline,
                  color: selected ? kPrimary : kTextMuted,
                ),
                title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () {
                    Navigator.pop(context);
                    _deleteConversation(id);
                  },
                ),
                onTap: () {
                  Navigator.pop(context);
                  _openConversation(id);
                },
              );
            }),
          ],
        ),
      ),
    );
  }
}

class _TodaySchedulePanel extends StatelessWidget {
  const _TodaySchedulePanel({
    required this.schedules,
    required this.formatScheduleBrief,
  });

  final List<dynamic> schedules;
  final String Function(dynamic schedule) formatScheduleBrief;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('오늘 일정', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          if (schedules.isEmpty)
            const Text('등록된 일정이 없습니다.', style: TextStyle(color: kTextMuted, fontSize: 12))
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: schedules
                  .take(4)
                  .map((schedule) => Chip(
                        label: Text(formatScheduleBrief(schedule)),
                        labelStyle: const TextStyle(fontSize: 12),
                        backgroundColor: kPrimaryLight,
                        side: BorderSide(color: kPrimary.withOpacity(0.2)),
                      ))
                  .toList(),
            ),
        ],
      ),
    );
  }
}

class _QuickQuestions extends StatelessWidget {
  const _QuickQuestions({required this.onTap});

  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    const questions = [
      '오늘 일정 알려줘',
      '리콜 제품은 어떻게 확인해?',
      '긴급 상황이면 어떻게 해?',
    ];

    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: questions
              .map(
                (question) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    label: Text(question),
                    labelStyle: const TextStyle(fontSize: 12),
                    backgroundColor: Colors.white,
                    side: const BorderSide(color: kBorder),
                    onPressed: () => onTap(question),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message});

  final _ChatMessage message;

  @override
  Widget build(BuildContext context) {
    final fromUser = message.role == 'user';
    final alignment = fromUser ? CrossAxisAlignment.end : CrossAxisAlignment.start;
    final color = fromUser ? kPrimary : Colors.white;
    final textColor = fromUser ? Colors.white : kTextPrimary;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: alignment,
        children: [
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.76,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(fromUser ? 16 : 4),
                bottomRight: Radius.circular(fromUser ? 4 : 16),
              ),
              border: fromUser ? null : Border.all(color: kBorder),
            ),
            child: Text(
              message.content,
              style: TextStyle(
                color: textColor,
                fontSize: 14,
                height: 1.45,
                fontWeight: fromUser ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(height: 3),
          Text(
            _formatMessageTime(message.createdAt),
            style: const TextStyle(color: kTextMuted, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

String _formatMessageTime(DateTime value) {
  final period = value.hour < 12 ? '오전' : '오후';
  final hour = value.hour == 0 ? 12 : (value.hour > 12 ? value.hour - 12 : value.hour);
  return '$period $hour:${value.minute.toString().padLeft(2, '0')}';
}

class _TypingBubble extends StatelessWidget {
  const _TypingBubble();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 6),
      child: Align(
        alignment: Alignment.centerLeft,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.all(Radius.circular(16)),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            child: Text(
              '답변을 작성 중입니다...',
              style: TextStyle(color: kTextMuted, fontSize: 13),
            ),
          ),
        ),
      ),
    );
  }
}

class _ChatInput extends StatelessWidget {
  const _ChatInput({
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
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: kBorder)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              minLines: 1,
              maxLines: 4,
              textInputAction: TextInputAction.send,
              onSubmitted: (_) => onSend(),
              decoration: InputDecoration(
                hintText: '궁금한 내용을 입력하세요',
                filled: true,
                fillColor: kBg,
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          IconButton.filled(
            onPressed: sending ? null : onSend,
            style: IconButton.styleFrom(
              backgroundColor: kPrimary,
              foregroundColor: Colors.white,
              disabledBackgroundColor: kTextMuted.withOpacity(0.35),
            ),
            icon: const Icon(Icons.send),
          ),
        ],
      ),
    );
  }
}

class _ChatMessage {
  const _ChatMessage({
    required this.role,
    required this.content,
    required this.createdAt,
  });

  factory _ChatMessage.user(String content) {
    return _ChatMessage(role: 'user', content: content, createdAt: DateTime.now());
  }

  factory _ChatMessage.assistant(String content) {
    return _ChatMessage(role: 'assistant', content: content, createdAt: DateTime.now());
  }

  final String role;
  final String content;
  final DateTime createdAt;
}
