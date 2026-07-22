import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:google_generative_ai/google_generative_ai.dart';
import 'package:intl/intl.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../api/assistant_conversation_api.dart';
import '../api/product_api.dart';
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
  final FlutterTts _tts = FlutterTts();
  final stt.SpeechToText _speech = stt.SpeechToText();

  int? _seniorId;
  dynamic _activeConversationId;
  List<dynamic> _conversations = [];
  List<dynamic> _todaySchedules = [];
  List<dynamic> _allSchedules = [];
  Map<String, dynamic>? _senior;
  List<_ChatMessage> _messages = [];
  ChatSession? _chat;
  bool _loading = true;
  bool _sending = false;
  bool _apiKeyMissing = false;
  bool _listening = false;
  bool _speechReady = false;
  bool _voiceAnswerEnabled = true;
  bool _voiceSendScheduled = false;
  bool _voiceHadRecognizedText = false;
  _PendingScheduleDraft? _pendingScheduleDraft;

  @override
  void initState() {
    super.initState();
    _initVoice();
    _loadInitialData();
  }

  @override
  void dispose() {
    _speech.stop();
    _tts.stop();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _initVoice() async {
    await _tts.setLanguage('ko-KR');
    await _tts.setSpeechRate(0.45);
    await _tts.setPitch(1.0);
    await _tts.setVolume(1.0);
    await _tts.awaitSpeakCompletion(false);

    final ready = await _speech.initialize(
      onStatus: (status) {
        if (!mounted) return;
        if (status == 'done') {
          _finishVoiceInput();
        } else if (status == 'notListening') {
          _finishVoiceInput();
        }
      },
      onError: (_) {
        if (!mounted) return;
        _voiceSendScheduled = false;
        setState(() => _listening = false);
      },
    );
    if (mounted) {
      setState(() => _speechReady = ready);
    }
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
        ScheduleApi.fetchSeniorSchedules(seniorId).catchError((_) => <dynamic>[]),
        AssistantConversationApi.fetchConversations(seniorId)
            .catchError((_) => <dynamic>[]),
      ]);

      _seniorId = seniorId;
      _senior = results[0] as Map<String, dynamic>;
      _voiceAnswerEnabled = _senior?['chatbotVoiceEnabled'] != false;
      _todaySchedules = _remainingTodaySchedules(results[1] as List<dynamic>);
      _allSchedules = results[2] as List<dynamic>;
      _conversations = results[3] as List<dynamic>;
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

    final briefs = _remainingTodaySchedules(_todaySchedules).map(_formatScheduleBrief).toList();
    if (briefs.isNotEmpty) {
      messages.add(_ChatMessage.assistant(_formatScheduleAnswer('남은 오늘 일정입니다.', briefs)));
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
      await _refreshConversations();
      _scrollToBottom();
    } catch (_) {
      setState(() {
        _messages = _welcomeMessages();
        _loading = false;
      });
    }
  }

  Future<void> _refreshConversations() async {
    final seniorId = _seniorId;
    if (seniorId == null) return;
    try {
      final conversations = await AssistantConversationApi.fetchConversations(seniorId);
      if (!mounted) return;
      if (conversations.isEmpty && _activeConversationId != null && _conversations.isNotEmpty) {
        return;
      }
      setState(() {
        _conversations = conversations;
      });
    } catch (_) {
      // The current chat can continue even if the list refresh fails.
    }
  }

  Future<void> _refreshSchedules() async {
    final seniorId = _seniorId;
    if (seniorId == null) return;
    final todaySchedules = await ScheduleApi.fetchTodaySchedules(seniorId).catchError((_) => <dynamic>[]);
    final allSchedules = await ScheduleApi.fetchSeniorSchedules(seniorId).catchError((_) => <dynamic>[]);
    if (!mounted) return;
    setState(() {
      _todaySchedules = _remainingTodaySchedules(todaySchedules);
      _allSchedules = allSchedules;
    });
  }

  Future<void> _toggleListening() async {
    if (_sending) return;

    if (!_speechReady) {
      final ready = await _speech.initialize(
        onStatus: (status) {
          if (!mounted) return;
          if (status == 'done') {
            _finishVoiceInput();
          } else if (status == 'notListening') {
            _finishVoiceInput();
          }
        },
        onError: (_) {
          if (!mounted) return;
          _voiceSendScheduled = false;
          setState(() => _listening = false);
        },
      );
      if (!mounted) return;
      setState(() => _speechReady = ready);
      if (!ready) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('음성 인식을 시작하지 못했습니다. 마이크 권한을 확인해 주세요.')),
        );
        return;
      }
    }

    if (_listening) {
      await _finishVoiceInput();
      return;
    }

    await _tts.stop();
    _voiceSendScheduled = false;
    _voiceHadRecognizedText = false;
    setState(() => _listening = true);
    await _speech.listen(
      localeId: 'ko_KR',
      listenMode: stt.ListenMode.dictation,
      partialResults: true,
      listenFor: const Duration(seconds: 10),
      pauseFor: const Duration(seconds: 2),
      onResult: (result) {
        if (!mounted) return;
        if (_sending) return;
        final words = result.recognizedWords.trim();
        if (words.isEmpty) return;
        _voiceHadRecognizedText = true;
        setState(() {
          _controller.text = words;
          _controller.selection = TextSelection.collapsed(offset: _controller.text.length);
        });
      },
    );
  }

  Future<void> _finishVoiceInput() async {
    if (_voiceSendScheduled) return;
    _voiceSendScheduled = true;
    await _speech.stop();
    if (!mounted) {
      _voiceSendScheduled = false;
      return;
    }

    setState(() => _listening = false);
    if (!_voiceHadRecognizedText && _controller.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('음성이 인식되지 않았어요. 다시 말씀해 주세요.')),
      );
    }
    _voiceSendScheduled = false;
  }

  Future<void> _speak(String text) async {
    if (!_voiceAnswerEnabled || text.trim().isEmpty) return;
    final speakable = text
        .replaceAll(RegExp(r'[#*_`>~\[\]\(\)]'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (speakable.isEmpty) return;
    try {
      await _tts.stop();
      await _tts.speak(speakable);
    } catch (_) {
      // Korean TTS can be unavailable on some devices.
    }
  }

  Future<void> _setVoiceAnswerEnabled(bool enabled) async {
    final previous = _voiceAnswerEnabled;
    setState(() => _voiceAnswerEnabled = enabled);

    try {
      final seniorId = _seniorId ?? await AuthService.getUserId();
      if (seniorId == null) throw Exception('사용자 정보를 확인할 수 없습니다.');
      final updated = await SeniorApi.updateSenior(seniorId, {
        'chatbotVoiceEnabled': enabled,
      });
      if (!mounted) return;
      setState(() => _senior = updated);
      if (enabled) {
        await _speak('음성 답변을 켰습니다.');
      } else {
        await _tts.stop();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _voiceAnswerEnabled = previous);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('음성 답변 설정을 저장하지 못했습니다.')),
      );
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;
    if (_listening) {
      _voiceSendScheduled = true;
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      _voiceSendScheduled = false;
    }

    final userMessage = _ChatMessage.user(text);
    setState(() {
      _messages.add(userMessage);
      _sending = true;
      _voiceHadRecognizedText = false;
    });
    _controller.clear();
    _scrollToBottom();
    await _saveMessage(userMessage);

    final scheduleDeleteAnswer = await _tryDeleteScheduleFromText(text);
    if (scheduleDeleteAnswer != null) {
      await _addAssistantAnswer(scheduleDeleteAnswer);
      return;
    }

    final scheduleCreateAnswer = await _tryCreateScheduleFromText(text);
    if (scheduleCreateAnswer != null) {
      await _addAssistantAnswer(scheduleCreateAnswer);
      return;
    }

    final localAnswer = await _answerLocally(text);
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
      final recallScheduleText = await _recallSchedulesToText();
      final response = await _chat!.sendMessage(
        Content.text('''
최근 대화:
$historyText

오늘 일정:
$scheduleText

리콜 후속 조치 일정:
$recallScheduleText

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

  Future<String?> _answerLocally(String text) async {
    final normalized = text.replaceAll(' ', '');
    final targetDate = _parseScheduleQueryDate(text);
    if (RegExp(r'(수정|변경|바꿔)').hasMatch(normalized) && _isScheduleQuestion(normalized)) {
      return '일정 수정은 아직 서버 API가 없어서 바로 바꾸지는 못해요. 지금은 달력에서 기존 일정을 삭제한 뒤 새 일정으로 다시 등록해 주세요.';
    }
    if (_isRecallScheduleQuestion(normalized)) {
      final briefs = await _fetchRecallScheduleBriefs(dateText: targetDate);
      if (briefs.isEmpty) {
        final dateLabel = targetDate == null ? '' : '${_formatDateLabel(targetDate)}에 ';
        return '${dateLabel}등록된 리콜 후속 조치 일정은 없어요.';
      }
      return _formatScheduleAnswer(
        targetDate == null ? '리콜 후속 조치 일정입니다.' : '${_formatDateLabel(targetDate)} 리콜 후속 조치 일정입니다.',
        briefs,
      );
    }
    if (_isScheduleQuestion(normalized)) {
      final dateText = targetDate ?? DateFormat('yyyy-MM-dd').format(DateTime.now());
      final briefs = _scheduleBriefsForDate(dateText);
      if (briefs.isEmpty) {
        return dateText == DateFormat('yyyy-MM-dd').format(DateTime.now())
            ? '남은 오늘 일정은 없어요.'
            : '${_formatDateLabel(dateText)} 일정은 없어요.';
      }
      return _formatScheduleAnswer(
        dateText == DateFormat('yyyy-MM-dd').format(DateTime.now())
            ? '남은 오늘 일정입니다.'
            : '${_formatDateLabel(dateText)} 일정입니다.',
        briefs,
      );
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

  Future<String?> _tryDeleteScheduleFromText(String text) async {
    final compact = text.replaceAll(' ', '');
    if (!RegExp(r'(삭제|지워|취소)').hasMatch(compact) ||
        !RegExp(r'(일정|예약|알림|산책|운동|수영|병원|진료|검진|약|복약|방문|전화|약속|식사|아침|점심|저녁)').hasMatch(compact)) {
      return null;
    }

    final targetDate = _parseScheduleDate(text);
    final keyword = _cleanScheduleTitle(text
        .replaceAll(RegExp(r'삭제해줘|삭제|지워줘|지워|취소해줘|취소'), ' ')
        .trim());
    if (keyword.isEmpty) {
      return '어떤 일정을 삭제할까요? 예: 산책 일정 삭제해줘';
    }

    final candidates = _allSchedules.where((schedule) {
      final date = '${schedule['visitDate'] ?? schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
      if (targetDate != null && (date.length < 10 || date.substring(0, 10) != targetDate)) {
        return false;
      }
      final title = '${schedule['purpose'] ?? schedule['title'] ?? schedule['content'] ?? schedule['memo'] ?? ''}';
      return title.isNotEmpty && (title.contains(keyword) || keyword.contains(title));
    }).toList()
      ..sort((a, b) => _scheduleDateTime(a).compareTo(_scheduleDateTime(b)));

    if (candidates.isEmpty) {
      return '$keyword 일정을 찾지 못했어요.';
    }
    if (candidates.length > 1 && targetDate == null) {
      return '$keyword 일정이 여러 개 있어요. 날짜를 같이 말해 주세요. 예: 내일 $keyword 삭제';
    }

    final schedule = candidates.first;
    final id = schedule is Map ? schedule['id'] : null;
    if (id == null) return '일정 ID를 찾지 못해서 삭제할 수 없어요.';

    try {
      await ScheduleApi.deleteSchedule(id);
      await _refreshSchedules();
      return '${_formatScheduleBrief(schedule)} 일정을 삭제했어요.';
    } catch (error) {
      return '일정 삭제에 실패했어요. ${error.toString().replaceFirst('Exception: ', '')}';
    }
  }

  Future<String?> _tryCreateScheduleFromText(String text) async {
    final seniorId = _seniorId;
    if (seniorId == null) return null;

    final pending = _pendingScheduleDraft;
    if (pending != null) {
      final time = _parseScheduleTime(text, pending.date);
      if (time.isEmpty) {
        return '${pending.title} 일정을 몇 시로 등록할까요? 예: 오전 9시';
      }
      final timeMatch = _scheduleTimeMatch(text);
      final hour = int.tryParse(timeMatch?.group(2) ?? '') ?? 0;
      if (pending.needsMeridiem && hour >= 1 && hour <= 11 && !_hasMeridiem(text)) {
        return '${_formatDateLabel(pending.date)} ${pending.title} 일정은 오전인지 오후인지 알려주세요. 예: 오전 6시';
      }
      _pendingScheduleDraft = null;
      return _saveParsedSchedule(
        _ParsedSchedule(date: pending.date, time: time, title: pending.title),
      );
    }

    final parsed = _parseScheduleCreateText(text);
    if (parsed == null) return null;
    if (parsed.needsTime) {
      _pendingScheduleDraft = _PendingScheduleDraft(
        date: parsed.date,
        title: parsed.title,
        needsMeridiem: false,
      );
      return '${_formatDateLabel(parsed.date)} ${parsed.title} 일정을 몇 시로 등록할까요?';
    }
    if (parsed.needsMeridiem) {
      _pendingScheduleDraft = _PendingScheduleDraft(
        date: parsed.date,
        title: parsed.title,
        needsMeridiem: true,
      );
      return '${_formatDateLabel(parsed.date)} ${parsed.title} 일정은 오전인지 오후인지 알려주세요. 예: 오전 6시';
    }

    return _saveParsedSchedule(parsed);
  }

  Future<String> _saveParsedSchedule(_ParsedSchedule parsed) async {
    final seniorId = _seniorId;
    if (seniorId == null) return '로그인 정보를 확인하지 못해서 일정 등록을 할 수 없어요.';
    try {
      final saved = await ScheduleApi.createSchedule({
        'seniorId': seniorId,
        'welfareWorkerId': _senior?['welfareWorkerId'],
        'visitDate': parsed.date,
        'visitTime': parsed.time,
        'purpose': parsed.title,
        'note': '챗봇에서 등록한 일정입니다.',
        'status': 'PLANNED',
      });
      await _refreshSchedules();
      final savedDate = '${saved['visitDate'] ?? parsed.date}';
      final savedTime = '${saved['visitTime'] ?? parsed.time}';
      final timeLabel = savedTime.isEmpty ? '시간 미정' : _formatTime(savedTime);
      return '${_formatDateLabel(savedDate)} $timeLabel에 ${parsed.title} 일정으로 등록했어요.';
    } catch (error) {
      final message = error.toString().replaceFirst('Exception: ', '');
      return '일정 등록에 실패했어요. $message';
    }
  }

  _ParsedSchedule? _parseScheduleCreateText(String text) {
    final normalized = text
        .replaceAll('낼', '내일')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final compact = normalized.replaceAll(' ', '');
    final wantsCreate = RegExp(r'(등록|추가|넣어|넣어줘|기억|챙겨|알림|예약)').hasMatch(compact);
    final hasDateOrTime = _parseScheduleDate(normalized) != null ||
        RegExp(r'(오전|오후|아침|점심|저녁|밤|새벽)?\s*\d{1,2}\s*시').hasMatch(normalized);
    final hasScheduleTopic = RegExp(r'(일정|예약|알림|산책|운동|수영|병원|진료|검진|약|복약|방문|전화|약속|식사|아침|점심|저녁|마트|시장|복지관|주민센터)').hasMatch(compact);
    if (!wantsCreate || (!hasScheduleTopic && !hasDateOrTime)) return null;

    final parsedDate = _parseScheduleDate(normalized);
    final date = parsedDate ?? DateFormat('yyyy-MM-dd').format(DateTime.now());
    final time = _parseScheduleTime(normalized, date);
    final title = _cleanScheduleTitle(normalized);
    if (title.isEmpty) return null;

    final timeMatch = _scheduleTimeMatch(normalized);
    final hasTime = timeMatch != null;
    final parsedHour = int.tryParse(timeMatch?.group(2) ?? '') ?? 0;
    final isToday = date == DateFormat('yyyy-MM-dd').format(DateTime.now());
    final needsMeridiem = hasTime && parsedHour >= 1 && parsedHour <= 11 && !isToday && !_hasMeridiem(normalized);

    return _ParsedSchedule(
      date: date,
      time: time,
      title: title,
      needsTime: !hasTime,
      needsMeridiem: needsMeridiem,
    );
  }

  String? _parseScheduleDate(String text) {
    final now = DateTime.now();
    if (text.contains('오늘')) return DateFormat('yyyy-MM-dd').format(now);
    if (text.contains('글피')) {
      return DateFormat('yyyy-MM-dd').format(now.add(const Duration(days: 3)));
    }
    if (text.contains('내일모레') || text.contains('모레')) {
      return DateFormat('yyyy-MM-dd').format(now.add(const Duration(days: 2)));
    }
    if (text.contains('내일')) {
      return DateFormat('yyyy-MM-dd').format(now.add(const Duration(days: 1)));
    }

    final fullDate = RegExp(r'(20\d{2})[년./-]?\s*(\d{1,2})[월./-]?\s*(\d{1,2})일?').firstMatch(text);
    if (fullDate != null) {
      final year = int.parse(fullDate.group(1)!);
      final month = int.parse(fullDate.group(2)!);
      final day = int.parse(fullDate.group(3)!);
      return DateFormat('yyyy-MM-dd').format(DateTime(year, month, day));
    }

    final monthDay = RegExp(r'(\d{1,2})\s*월\s*(\d{1,2})\s*일?').firstMatch(text);
    if (monthDay != null) {
      final month = int.parse(monthDay.group(1)!);
      final day = int.parse(monthDay.group(2)!);
      return DateFormat('yyyy-MM-dd').format(DateTime(now.year, month, day));
    }

    final dayOnly = RegExp(r'(^|[^\d월])(\d{1,2})\s*일').firstMatch(text);
    if (dayOnly != null) {
      final day = int.parse(dayOnly.group(2)!);
      var date = DateTime(now.year, now.month, day);
      if (date.isBefore(DateTime(now.year, now.month, now.day))) {
        date = DateTime(now.year, now.month + 1, day);
      }
      return DateFormat('yyyy-MM-dd').format(date);
    }

    return null;
  }

  String? _parseScheduleQueryDate(String text) {
    return _parseScheduleDate(text);
  }

  String _parseScheduleTime(String text, String date) {
    final match = _scheduleTimeMatch(text);
    if (match == null) return '';

    final meridiem = match.group(1) ?? '';
    var hour = int.tryParse(match.group(2) ?? '') ?? 0;
    final minuteText = match.group(3) ?? '';
    final minute = minuteText == '반' ? 30 : int.tryParse(match.group(4) ?? '0') ?? 0;

    if (['오후', '저녁', '밤'].contains(meridiem) && hour < 12) hour += 12;
    if (['오전', '아침', '새벽'].contains(meridiem) && hour == 12) hour = 0;
    if (meridiem.isEmpty && hour >= 1 && hour <= 11) {
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final now = DateTime.now();
      final morning = DateTime(now.year, now.month, now.day, hour, minute);
      final eveningHour = hour + 12;
      if (date == today && morning.isBefore(now) && eveningHour < 24) {
        hour = eveningHour;
      }
    }

    return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
  }

  RegExpMatch? _scheduleTimeMatch(String text) {
    return RegExp(r'(오전|오후|아침|점심|저녁|밤|새벽)?\s*(\d{1,2})\s*시\s*(반|(\d{1,2})\s*분?)?').firstMatch(text);
  }

  bool _hasMeridiem(String text) {
    return RegExp(r'(오전|오후|아침|점심|저녁|밤|새벽)').hasMatch(text);
  }

  String _cleanScheduleTitle(String text) {
    return text
        .replaceAll(RegExp(r'20\d{2}[년./-]?\s*\d{1,2}[월./-]?\s*\d{1,2}일?'), ' ')
        .replaceAll(RegExp(r'\d{1,2}\s*월\s*\d{1,2}\s*일?'), ' ')
        .replaceAll(RegExp(r'오늘|내일모레|모레|내일|글피'), ' ')
        .replaceAll(RegExp(r'(오전|오후|아침|점심|저녁|밤|새벽)?\s*\d{1,2}\s*시\s*(반|(\d{1,2})\s*분?)?\s*에?'), ' ')
        .replaceAll(RegExp(r'일정|예약|알림|리마인드|등록해줘|등록|추가해줘|추가|넣어줘|넣어|기억해줘|기억|챙겨줘|챙겨|해줘|줘'), ' ')
        .replaceAll(RegExp(r'[,.:]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  bool _isScheduleQuestion(String normalized) {
    return normalized.contains('일정') ||
        normalized.contains('스케줄') ||
        normalized.contains('예정') ||
        normalized.contains('방문') ||
        normalized.contains('조치일');
  }

  bool _isRecallScheduleQuestion(String normalized) {
    return normalized.contains('리콜') &&
        (normalized.contains('일정') ||
            normalized.contains('조치일') ||
            normalized.contains('후속조치') ||
            normalized.contains('방문') ||
            normalized.contains('예정'));
  }

  Future<void> _addAssistantAnswer(String text) async {
    final assistantMessage = _ChatMessage.assistant(text);
    setState(() {
      _messages.add(assistantMessage);
      _sending = false;
    });
    await _saveMessage(assistantMessage);
    await _speak(text);
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
      await _refreshConversations();
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
    final date = '${schedule['visitDate'] ?? schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    if (date.isNotEmpty && (date.length < 10 || date.substring(0, 10) != today)) return false;
    final time = '${schedule['visitTime'] ?? schedule['scheduleTime'] ?? schedule['time'] ?? ''}';
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

  List<dynamic> _remainingTodaySchedules(List<dynamic> schedules) {
    final remaining = schedules.where(_isRemainingTodaySchedule).toList();
    remaining.sort((a, b) => _scheduleDateTime(a).compareTo(_scheduleDateTime(b)));
    return remaining;
  }

  DateTime _scheduleDateTime(dynamic schedule) {
    final now = DateTime.now();
    final rawDate = '${schedule['visitDate'] ?? schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
    final date = DateTime.tryParse(rawDate.length >= 10 ? rawDate.substring(0, 10) : '') ??
        DateTime(now.year, now.month, now.day);
    final time = '${schedule['visitTime'] ?? schedule['scheduleTime'] ?? schedule['time'] ?? ''}';
    final parts = time.split(':');
    if (parts.length < 2) {
      return DateTime(date.year, date.month, date.day, 23, 59);
    }
    return DateTime(
      date.year,
      date.month,
      date.day,
      int.tryParse(parts[0]) ?? 23,
      int.tryParse(parts[1]) ?? 59,
    );
  }

  String _formatScheduleBrief(dynamic schedule) {
    final title =
        '${schedule['purpose'] ?? schedule['title'] ?? schedule['content'] ?? schedule['memo'] ?? '일정'}';
    final time = '${schedule['visitTime'] ?? schedule['scheduleTime'] ?? schedule['time'] ?? ''}';
    if (time.isEmpty) return title;
    return '${_formatTime(time)} $title';
  }

  String _scheduleToText(dynamic schedule) {
    final date = '${schedule['visitDate'] ?? schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
    return '$date ${_formatScheduleBrief(schedule)}'.trim();
  }

  List<String> _scheduleBriefsForDate(String dateText) {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final schedules = (dateText == today
        ? _remainingTodaySchedules(_allSchedules)
        : _allSchedules.where((schedule) {
            final date = '${schedule['visitDate'] ?? schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
            return date.length >= 10 && date.substring(0, 10) == dateText;
          }).toList());
    schedules.sort((a, b) => _scheduleDateTime(a).compareTo(_scheduleDateTime(b)));
    return schedules.map(_formatScheduleBrief).toList();
  }

  Future<String> _recallSchedulesToText() async {
    final briefs = await _fetchRecallScheduleBriefs();
    if (briefs.isEmpty) return '등록된 리콜 후속 조치 일정 없음';
    return _summarizeBriefs(briefs);
  }

  String _summarizeBriefs(List<String> briefs, {int limit = 2}) {
    if (briefs.length <= limit) return briefs.join(', ');
    final visible = briefs.take(limit).join(', ');
    return '$visible 외 ${briefs.length - limit}건';
  }

  String _formatScheduleAnswer(String title, List<String> briefs, {int limit = 2}) {
    final visible = briefs.take(limit).toList();
    final lines = <String>[
      title,
      for (final brief in visible) '- $brief',
    ];
    if (briefs.length > limit) {
      lines.add('외 ${briefs.length - limit}건이 더 있어요.');
    }
    return lines.join('\n');
  }

  Future<List<String>> _fetchRecallScheduleBriefs({String? dateText}) async {
    final seniorId = _seniorId;
    if (seniorId == null) return [];
    try {
      final products = await ProductApi.getProductsBySenior(seniorId);
      final scheduledProducts = products
          .where((product) => '${product['recallStatus'] ?? ''}' == 'RECALLED')
          .where((product) {
            final date = '${product['nextActionDate'] ?? ''}';
            if (date.isEmpty) return false;
            final shortDate = date.length >= 10 ? date.substring(0, 10) : date;
            return dateText == null || shortDate == dateText;
          })
          .toList()
        ..sort((a, b) {
          final left = _productNextActionDate(a);
          final right = _productNextActionDate(b);
          return left.compareTo(right);
        });
      return scheduledProducts
          .map((product) {
            final date = '${product['nextActionDate'] ?? ''}';
            final shortDate = date.length >= 10 ? date.substring(0, 10) : date;
            final productName = '${product['productName'] ?? '리콜 제품'}';
            final followUpType = '${product['followUpType'] ?? ''}'.trim();
            final label = followUpType.isEmpty ? '리콜 후속 조치' : followUpType;
            return '${_formatDateLabel(shortDate)} $productName $label';
          })
          .toList();
    } catch (_) {
      return [];
    }
  }

  DateTime _productNextActionDate(dynamic product) {
    final raw = product is Map ? '${product['nextActionDate'] ?? ''}' : '';
    final shortDate = raw.length >= 10 ? raw.substring(0, 10) : raw;
    return DateTime.tryParse(shortDate) ?? DateTime(9999, 12, 31);
  }

  String _formatDateLabel(String date) {
    final parsed = DateTime.tryParse(date);
    if (parsed == null) return date;
    return DateFormat('M월 d일').format(parsed);
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
            tooltip: _voiceAnswerEnabled ? '음성 답변 끄기' : '음성 답변 켜기',
            onPressed: () => _setVoiceAnswerEnabled(!_voiceAnswerEnabled),
            icon: Icon(_voiceAnswerEnabled ? Icons.volume_up : Icons.volume_off),
          ),
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
              onOpenCalendar: _openScheduleCalendar,
            ),
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
            _QuickQuestions(onTap: _sendQuickQuestion),
            _ChatInput(
              controller: _controller,
              sending: _sending,
              listening: _listening,
              onSend: _send,
              onVoice: _toggleListening,
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

  void _openScheduleCalendar() {
    var selectedDate = DateTime.now();
    var focusedMonth = DateTime(selectedDate.year, selectedDate.month);
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => StatefulBuilder(
        builder: (context, setSheetState) {
          final selectedText = DateFormat('yyyy-MM-dd').format(selectedDate);
          final scheduleDates = _allSchedules
              .map((schedule) => '${schedule['visitDate'] ?? schedule['scheduleDate'] ?? schedule['date'] ?? ''}')
              .where((date) => date.length >= 10)
              .map((date) => date.substring(0, 10))
              .toSet();
          final schedules = _allSchedules.where((schedule) {
            final date = '${schedule['visitDate'] ?? schedule['scheduleDate'] ?? schedule['date'] ?? ''}';
            return date.length >= 10 && date.substring(0, 10) == selectedText;
          }).toList();

          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    '일정 달력',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  _ScheduleMonthCalendar(
                    focusedMonth: focusedMonth,
                    selectedDate: selectedDate,
                    scheduleDates: scheduleDates,
                    onMonthChanged: (month) => setSheetState(() => focusedMonth = month),
                    onDateSelected: (date) => setSheetState(() {
                      selectedDate = date;
                      focusedMonth = DateTime(date.year, date.month);
                    }),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    '${_formatDateLabel(selectedText)} 일정',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  if (schedules.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text('등록된 일정이 없습니다.', style: TextStyle(color: kTextMuted)),
                    )
                  else
                    ...schedules.map((schedule) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.event_available, color: kPrimary),
                          title: Text(_formatScheduleBrief(schedule)),
                          subtitle: Text('${schedule['note'] ?? ''}'.trim().isEmpty
                              ? '방문 일정'
                              : '${schedule['note']}'),
                          trailing: IconButton(
                            tooltip: '일정 삭제',
                            icon: const Icon(Icons.delete_outline, color: kTextMuted),
                            onPressed: () async {
                              final deleted = await _deleteSchedule(schedule);
                              if (!deleted || !context.mounted) return;
                              setSheetState(() {});
                            },
                          ),
                        )),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<bool> _deleteSchedule(dynamic schedule) async {
    final id = schedule is Map ? schedule['id'] : null;
    if (id == null) {
      await _addAssistantAnswer('일정 ID를 찾지 못해서 삭제할 수 없어요.');
      return false;
    }
    try {
      await ScheduleApi.deleteSchedule(id);
      await _refreshSchedules();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('일정을 삭제했습니다.')),
        );
      }
      return true;
    } catch (error) {
      await _addAssistantAnswer('일정 삭제에 실패했어요. ${error.toString().replaceFirst('Exception: ', '')}');
      return false;
    }
  }
}

class _TodaySchedulePanel extends StatelessWidget {
  const _TodaySchedulePanel({
    required this.schedules,
    required this.formatScheduleBrief,
    required this.onOpenCalendar,
  });

  final List<dynamic> schedules;
  final String Function(dynamic schedule) formatScheduleBrief;
  final VoidCallback onOpenCalendar;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: kBg,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: kBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: kPrimaryLight,
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Icon(Icons.event_available, color: kPrimary, size: 18),
                ),
                const SizedBox(width: 8),
                const Text('오늘 일정', style: TextStyle(fontWeight: FontWeight.w800)),
                const Spacer(),
                TextButton.icon(
                  onPressed: onOpenCalendar,
                  icon: const Icon(Icons.calendar_month, size: 18),
                  label: const Text('달력'),
                  style: TextButton.styleFrom(
                    foregroundColor: kPrimaryDark,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (schedules.isEmpty)
              const Text('등록된 일정이 없습니다.', style: TextStyle(color: kTextMuted, fontSize: 12))
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: schedules
                    .take(4)
                    .map((schedule) => Chip(
                          avatar: const Icon(Icons.schedule, size: 15, color: kPrimaryDark),
                          label: Text(formatScheduleBrief(schedule)),
                          labelStyle: const TextStyle(
                            fontSize: 12,
                            color: kTextPrimary,
                            fontWeight: FontWeight.w700,
                          ),
                          backgroundColor: kPrimaryLight,
                          side: BorderSide(color: kPrimary.withOpacity(0.22)),
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                        ))
                    .toList(),
              ),
          ],
        ),
      ),
    );
  }
}

class _ScheduleMonthCalendar extends StatelessWidget {
  const _ScheduleMonthCalendar({
    required this.focusedMonth,
    required this.selectedDate,
    required this.scheduleDates,
    required this.onMonthChanged,
    required this.onDateSelected,
  });

  final DateTime focusedMonth;
  final DateTime selectedDate;
  final Set<String> scheduleDates;
  final ValueChanged<DateTime> onMonthChanged;
  final ValueChanged<DateTime> onDateSelected;

  @override
  Widget build(BuildContext context) {
    final firstDay = DateTime(focusedMonth.year, focusedMonth.month);
    final daysInMonth = DateTime(focusedMonth.year, focusedMonth.month + 1, 0).day;
    final leadingBlanks = firstDay.weekday % 7;
    final cellCount = ((leadingBlanks + daysInMonth + 6) ~/ 7) * 7;

    return Container(
      decoration: BoxDecoration(
        color: kBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: () => onMonthChanged(DateTime(focusedMonth.year, focusedMonth.month - 1)),
                icon: const Icon(Icons.chevron_left),
              ),
              Expanded(
                child: Center(
                  child: Text(
                    DateFormat('yyyy년 M월').format(focusedMonth),
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
              IconButton(
                onPressed: () => onMonthChanged(DateTime(focusedMonth.year, focusedMonth.month + 1)),
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
          const Row(
            children: [
              _WeekdayLabel('일', color: kDanger),
              _WeekdayLabel('월'),
              _WeekdayLabel('화'),
              _WeekdayLabel('수'),
              _WeekdayLabel('목'),
              _WeekdayLabel('금'),
              _WeekdayLabel('토', color: kPrimary),
            ],
          ),
          const SizedBox(height: 4),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 7,
              mainAxisSpacing: 4,
              crossAxisSpacing: 4,
            ),
            itemCount: cellCount,
            itemBuilder: (context, index) {
              final day = index - leadingBlanks + 1;
              if (day < 1 || day > daysInMonth) return const SizedBox.shrink();

              final date = DateTime(focusedMonth.year, focusedMonth.month, day);
              final dateText = DateFormat('yyyy-MM-dd').format(date);
              final selected = _isSameDate(date, selectedDate);
              final hasSchedule = scheduleDates.contains(dateText);

              return InkWell(
                borderRadius: BorderRadius.circular(999),
                onTap: () => onDateSelected(date),
                child: Container(
                  decoration: BoxDecoration(
                    color: selected ? kPrimary : Colors.transparent,
                    shape: BoxShape.circle,
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        '$day',
                        style: TextStyle(
                          color: selected ? Colors.white : kTextPrimary,
                          fontWeight: selected || hasSchedule ? FontWeight.w800 : FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Container(
                        width: 5,
                        height: 5,
                        decoration: BoxDecoration(
                          color: hasSchedule
                              ? (selected ? Colors.white : kDanger)
                              : Colors.transparent,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  bool _isSameDate(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }
}

class _WeekdayLabel extends StatelessWidget {
  const _WeekdayLabel(this.label, {this.color = kTextMuted});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Center(
        child: Text(
          label,
          style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700),
        ),
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
      '리콜 조치일정 알려줘',
      '리콜 제품은 어떻게 확인해?',
    ];

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: kBorder)),
      ),
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: questions
              .asMap()
              .entries
              .map(
                (question) => Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ActionChip(
                    avatar: Icon(
                      _quickQuestionIcon(question.key),
                      size: 16,
                      color: kPrimaryDark,
                    ),
                    label: Text(question.value),
                    labelStyle: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: kTextPrimary,
                    ),
                    backgroundColor: kPrimaryLight,
                    side: BorderSide(color: kPrimary.withOpacity(0.22)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    onPressed: () => onTap(question.value),
                  ),
                ),
              )
              .toList(),
        ),
      ),
    );
  }

  IconData _quickQuestionIcon(int index) {
    return switch (index) {
      0 => Icons.today,
      1 => Icons.support_agent,
      _ => Icons.manage_search,
    };
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
    required this.listening,
    required this.onSend,
    required this.onVoice,
  });

  final TextEditingController controller;
  final bool sending;
  final bool listening;
  final VoidCallback onSend;
  final VoidCallback onVoice;

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
          IconButton.filledTonal(
            tooltip: listening ? '음성 입력 중지' : '음성으로 말하기',
            onPressed: sending ? null : onVoice,
            style: IconButton.styleFrom(
              backgroundColor: listening ? kDanger.withOpacity(0.12) : kPrimaryLight,
              foregroundColor: listening ? kDanger : kPrimaryDark,
            ),
            icon: Icon(listening ? Icons.stop : Icons.mic),
          ),
          const SizedBox(width: 8),
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

class _ParsedSchedule {
  const _ParsedSchedule({
    required this.date,
    required this.time,
    required this.title,
    this.needsTime = false,
    this.needsMeridiem = false,
  });

  final String date;
  final String time;
  final String title;
  final bool needsTime;
  final bool needsMeridiem;
}

class _PendingScheduleDraft {
  const _PendingScheduleDraft({
    required this.date,
    required this.title,
    required this.needsMeridiem,
  });

  final String date;
  final String title;
  final bool needsMeridiem;
}
