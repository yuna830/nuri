import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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
  final FlutterSecureStorage _localStore = const FlutterSecureStorage();

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
  _PendingScheduleDraft? _pendingScheduleDraft;

  String _conversationKey(int seniorId) => 'assistant_conversations_$seniorId';
  String _messagesKey(int seniorId, dynamic conversationId) =>
      'assistant_messages_${seniorId}_$conversationId';

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
          _finishVoiceInput(sendRecognized: true);
        } else if (status == 'notListening') {
          if (_listening && _controller.text.trim().isNotEmpty) {
            _finishVoiceInput(sendRecognized: true);
          } else {
            setState(() => _listening = false);
          }
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
      _conversations = await _mergeConversations(
        results[3] as List<dynamic>,
        await _loadLocalConversations(seniorId),
      );
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
    final userLabel = name.isNotEmpty ? '$name?? : '?ъ슜?먮떂';
    return '''
?덈뒗 $userLabel???쇱긽???뺣뒗 ?쒓뎅???뚮큵 梨쀫큸?대떎.

洹쒖튃:
- 紐⑤뱺 ?듬?? ?먯뿰?ㅻ윭???쒓뎅??議대뙎留먮줈 ?쒕떎.
- ?ъ슜?먮? 遺瑜???"蹂댄샇??곸옄"?쇨퀬 ?섏? 留먭퀬 "$userLabel"?대씪怨?遺瑜몃떎.
- ?쇰컲 ?듬?? 1~3臾몄옣?쇰줈 吏㏐퀬 ?뺤떎?섍쾶 留먰븳??
- ?쇱젙, ?좎쭨, ?쒓컙, ?좎뵪???깆뿉??癒쇱? 泥섎━?섎?濡?異붿륫?섏? ?딅뒗??
- 由ъ퐳 ?쒗뭹 ?뺤씤??臾쇱쑝硫??몃? ?ъ씠?몃낫???곕━ ???섎떒??由ъ퐳 ??쓣 癒쇱? ?덈궡?쒕떎.
- 由ъ퐳 ??뿉?쒕뒗 ?쒗뭹 ?ъ쭊 OCR, 諛붿퐫??QR ?ㅼ틪, 吏곸젒 ?낅젰?쇰줈 蹂댁쑀 ?쒗뭹???깅줉?섍퀬 ?쒗뭹?덉쟾?뺣낫?쇳꽣 由ъ퐳 ?곗씠?곗? ?먮룞 留ㅼ묶?????덈떎怨??ㅻ챸?쒕떎.
- 由ъ퐳 ??곸씠硫??깆뿉??由ъ퐳 議곗튂 ?붿껌??蹂대궪 ???덇퀬 蹂댄샇??蹂듭??ъ뿉寃?誘몄“移???곸쑝濡??꾨떖?쒕떎怨??덈궡?쒕떎.
- ?먮꼫吏諛붿슦泥? 湲곗긽?밸낫, 由ъ퐳, ?꾧린 ?덉쟾, 媛???덉쟾, KC ?덉쟾?몄쬆 吏덈Ц? ??湲곕뒫 湲곗??쇰줈 吏㏐쾶 遺꾨쪟?댁꽌 ?덈궡?쒕떎.
- 紐⑤Ⅴ硫?吏?대궡吏 留먭퀬 ?ㅼ떆 留먰빐 ?щ씪怨??쒕떎.
- ?묎툒 ?곹솴?대㈃ 利됱떆 119 ?먮뒗 蹂댄샇??蹂듭??ъ뿉寃??곕씫?섎씪怨??덈궡?쒕떎.
- 諛섎쭚, 怨쇳븳 ?띾떞, ?멸뎅???욎뼱 ?곌린???섏? ?딅뒗??
''';
  }

  List<_ChatMessage> _welcomeMessages() {
    final messages = [
      _ChatMessage.assistant(
        _withUserGreeting('?덈뀞?섏꽭?? 臾댁뾿???꾩??쒕┫源뚯슂? ?쇱젙 ?뺤씤, 由ъ퐳 ?쒗뭹 ?뺤씤, 湲닿툒 ?꾩???臾쇱뼱蹂????덉뼱??'),
      ),
    ];

    final briefs = _remainingTodaySchedules(_todaySchedules).map(_formatScheduleBrief).toList();
    if (briefs.isNotEmpty) {
      messages.add(_ChatMessage.assistant(_formatScheduleAnswer('?⑥? ?ㅻ뒛 ?쇱젙?낅땲??', briefs)));
    }
    if (_apiKeyMissing) {
      messages.add(_ChatMessage.assistant(
        '.env??VITE_GEMINI_API_KEY ?먮뒗 GEMINI_API_KEY瑜??ㅼ젙?섎㈃ AI ?듬????ъ슜?????덉뒿?덈떎.',
      ));
    }
    return messages;
  }

  String _withUserGreeting(String text) {
    final name = (_senior?['name'] ?? '').toString().trim();
    if (name.isEmpty) return text;
    return '$name?? $text';
  }

  Future<void> _openConversation(dynamic conversationId) async {
    final seniorId = _seniorId;
    if (seniorId == null) return;
    try {
      var savedMessages = _isLocalConversationId(conversationId)
          ? await _loadLocalMessages(seniorId, conversationId)
          : await AssistantConversationApi.fetchMessages(seniorId, conversationId);
      if (savedMessages.isEmpty) {
        savedMessages = await _loadLocalMessages(seniorId, conversationId);
      }
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
      final localMessages = await _loadLocalMessages(seniorId, conversationId);
      if (!mounted) return;
      setState(() {
        _activeConversationId = conversationId;
        _messages = localMessages.isEmpty
            ? _welcomeMessages()
            : localMessages
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
      await _upsertLocalConversation(seniorId, conversation);
      for (final message in nextMessages) {
        await _saveMessage(message);
      }
      await _refreshConversations();
      _scrollToBottom();
    } catch (_) {
      final localConversation = _newLocalConversation();
      final nextMessages = _welcomeMessages();
      setState(() {
        _activeConversationId = localConversation['id'];
        _conversations = [localConversation, ..._conversations];
        _messages = nextMessages;
        _loading = false;
      });
      await _upsertLocalConversation(seniorId, localConversation);
      await _saveLocalMessages(seniorId, localConversation['id'], nextMessages);
      _scrollToBottom();
    }
  }

  Future<void> _refreshConversations() async {
    final seniorId = _seniorId;
    if (seniorId == null) return;
    try {
      final conversations = await AssistantConversationApi.fetchConversations(seniorId);
      final localConversations = await _loadLocalConversations(seniorId);
      if (!mounted) return;
      setState(() {
        _conversations = _mergeConversationsSync(conversations, localConversations);
      });
    } catch (_) {
      final localConversations = await _loadLocalConversations(seniorId);
      if (!mounted) return;
      if (localConversations.isNotEmpty) {
        setState(() => _conversations = localConversations);
      }
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
            _finishVoiceInput(sendRecognized: true);
          } else if (status == 'notListening') {
            if (_listening && _controller.text.trim().isNotEmpty) {
              _finishVoiceInput(sendRecognized: true);
            } else {
              setState(() => _listening = false);
            }
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
          const SnackBar(content: Text('?뚯꽦 ?몄떇???쒖옉?섏? 紐삵뻽?듬땲?? 留덉씠??沅뚰븳???뺤씤??二쇱꽭??')),
        );
        return;
      }
    }

    if (_listening) {
      await _finishVoiceInput(sendRecognized: true);
      return;
    }

    await _tts.stop();
    _voiceSendScheduled = false;
    setState(() => _listening = true);
    await _speech.listen(
      localeId: 'ko_KR',
      listenMode: stt.ListenMode.dictation,
      partialResults: true,
      listenFor: const Duration(seconds: 10),
      pauseFor: const Duration(seconds: 2),
      onResult: (result) {
        if (!mounted) return;
        final words = result.recognizedWords.trim();
        if (words.isEmpty) return;
        setState(() {
          _controller.text = words;
          _controller.selection = TextSelection.collapsed(offset: _controller.text.length);
        });
        if (result.finalResult) {
          _finishVoiceInput(sendRecognized: true);
        }
      },
    );
  }

  Future<void> _finishVoiceInput({required bool sendRecognized}) async {
    if (_voiceSendScheduled) return;
    _voiceSendScheduled = true;
    await _speech.stop();
    if (!mounted) {
      _voiceSendScheduled = false;
      return;
    }
    setState(() => _listening = false);
    final text = _controller.text.trim();
    if (sendRecognized && text.isNotEmpty && !_sending) {
      await _send();
    } else if (sendRecognized && text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('?뚯꽦???몄떇?섏? ?딆븯?댁슂. ?ㅼ떆 留먰빐 二쇱꽭??')),
      );
    }
    _voiceSendScheduled = false;
  }

  Future<void> _speak(String text) async {
    if (!_voiceAnswerEnabled || text.trim().isEmpty) return;
    final speakable = text
        .replaceAll(RegExp(r'[-??'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (speakable.isEmpty) return;
    try {
      await _tts.stop();
      await _tts.speak(speakable);
    } catch (_) {
      // Some emulators do not have a usable Korean TTS engine.
    }
  }

  Future<void> _setVoiceAnswerEnabled(bool enabled) async {
    final previous = _voiceAnswerEnabled;
    setState(() => _voiceAnswerEnabled = enabled);

    try {
      final seniorId = _seniorId ?? await AuthService.getUserId();
      if (seniorId == null) throw Exception('?ъ슜??ID媛 ?놁뒿?덈떎.');
      final updated = await SeniorApi.updateSenior(seniorId, {
        'chatbotVoiceEnabled': enabled,
      });
      if (!mounted) return;
      setState(() => _senior = updated);
      if (enabled) {
        await _speak('?뚯꽦 ?듬???耳곗뒿?덈떎.');
      } else {
        await _tts.stop();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _voiceAnswerEnabled = previous);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('?뚯꽦 ?듬? ?ㅼ젙????ν븯吏 紐삵뻽?듬땲??')),
      );
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
    await _maybeUpdateTitle(text);

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
      await _addAssistantAnswer('Gemini API ?ㅺ? ?ㅼ젙?섏? ?딆븯?댁슂. .env???ㅻ? ?ｊ퀬 ?ㅼ떆 ?ㅽ뻾??二쇱꽭??');
      return;
    }

    try {
      final historyText = _messages
          .where((message) => message.content.trim().isNotEmpty)
          .take(12)
          .map((message) => '${message.role == 'user' ? '?ъ슜?? : '梨쀫큸'}: ${message.content}')
          .join('\n');
      final scheduleText = _todaySchedules.isEmpty
          ? '?ㅻ뒛 ?깅줉???쇱젙 ?놁쓬'
          : _todaySchedules.map(_scheduleToText).join('\n');
      final recallScheduleText = await _recallSchedulesToText();
      final response = await _chat!.sendMessage(
        Content.text('''
理쒓렐 ???
$historyText

?ㅻ뒛 ?쇱젙:
$scheduleText

由ъ퐳 ?꾩냽 議곗튂 ?쇱젙:
$recallScheduleText

?ъ슜??吏덈Ц:
$text
'''),
      );
      final answer = response.text?.trim();
      await _addAssistantAnswer(
        answer?.isNotEmpty == true ? answer! : '?듬???留뚮뱾吏 紐삵뻽?댁슂. ?ㅼ떆 留먯???二쇱꽭??',
      );
    } catch (_) {
      await _addAssistantAnswer('?듬???媛?몄삤吏 紐삵뻽?댁슂. ?좎떆 ???ㅼ떆 留먯???二쇱꽭??');
    }
  }

  Future<String?> _answerLocally(String text) async {
    final normalized = text.replaceAll(' ', '');
    final targetDate = _parseScheduleQueryDate(text);
    if (RegExp(r'(?섏젙|蹂寃?諛붽퓭)').hasMatch(normalized) && _isScheduleQuestion(normalized)) {
      return '?쇱젙 ?섏젙? ?꾩쭅 ?쒕쾭 API媛 ?놁뼱??諛붾줈 諛붽씀吏??紐삵빐?? 吏湲덉? ?щ젰?먯꽌 湲곗〈 ?쇱젙????젣???????쇱젙?쇰줈 ?ㅼ떆 ?깅줉??二쇱꽭??';
    }
    if (_isRecallScheduleQuestion(normalized)) {
      final briefs = await _fetchRecallScheduleBriefs(dateText: targetDate);
      if (briefs.isEmpty) {
        final dateLabel = targetDate == null ? '' : '${_formatDateLabel(targetDate)}??';
        return '${dateLabel}?깅줉??由ъ퐳 ?꾩냽 議곗튂 ?쇱젙? ?놁뼱??';
      }
      return _formatScheduleAnswer(
        targetDate == null ? '由ъ퐳 ?꾩냽 議곗튂 ?쇱젙?낅땲??' : '${_formatDateLabel(targetDate)} 由ъ퐳 ?꾩냽 議곗튂 ?쇱젙?낅땲??',
        briefs,
      );
    }
    if (_isScheduleQuestion(normalized)) {
      final dateText = targetDate ?? DateFormat('yyyy-MM-dd').format(DateTime.now());
      final briefs = _scheduleBriefsForDate(dateText);
      if (briefs.isEmpty) {
        return dateText == DateFormat('yyyy-MM-dd').format(DateTime.now())
            ? '?⑥? ?ㅻ뒛 ?쇱젙? ?놁뼱??'
            : '${_formatDateLabel(dateText)} ?쇱젙? ?놁뼱??';
      }
      return _formatScheduleAnswer(
        dateText == DateFormat('yyyy-MM-dd').format(DateTime.now())
            ? '?⑥? ?ㅻ뒛 ?쇱젙?낅땲??'
            : '${_formatDateLabel(dateText)} ?쇱젙?낅땲??',
        briefs,
      );
    }
    if (_isEnergyVoucherQuestion(normalized)) {
      return _energyVoucherAnswer();
    }
    if (_isWeatherQuestion(normalized)) {
      return _weatherAnswer();
    }
    if (normalized.contains('由ъ퐳')) {
      return '?섎떒??由ъ퐳 ??뿉??蹂댁쑀 ?쒗뭹???깅줉?섎㈃ ?쒗뭹?덉쟾?뺣낫?쇳꽣 由ъ퐳 ?곗씠?곗? ?먮룞?쇰줈 鍮꾧탳???쒕젮?? ?쒗뭹 ?ъ쭊 OCR, 諛붿퐫??QR ?ㅼ틪, 吏곸젒 ?낅젰?쇰줈 ?깅줉?????덇퀬, 由ъ퐳 ??곸씠硫?由ъ퐳 議곗튂 ?붿껌???뚮윭 蹂댄샇?먯? 蹂듭??ъ뿉寃?誘몄“移???곸쑝濡??뚮┫ ???덉뼱??';
    }
    if (_isElectricQuestion(normalized)) {
      return _electricSafetyAnswer();
    }
    if (_isGasQuestion(normalized)) {
      return _gasSafetyAnswer();
    }
    if (_isKcQuestion(normalized)) {
      return _kcSafetyAnswer();
    }
    if (normalized.contains('119') ||
        normalized.contains('?묎툒') ||
        normalized.contains('湲닿툒') ||
        normalized.contains('SOS')) {
      return '?묎툒 ?곹솴?대㈃ 利됱떆 119???꾪솕??二쇱꽭?? 媛?ν븯硫?蹂댄샇?먮굹 ?대떦 蹂듭??ъ뿉寃뚮룄 諛붾줈 ?뚮젮二쇱꽭??';
    }
    return null;
  }

  Future<String?> _tryDeleteScheduleFromText(String text) async {
    final compact = text.replaceAll(' ', '');
    if (!RegExp(r'(??젣|吏??痍⑥냼)').hasMatch(compact) ||
        !RegExp(r'(?쇱젙|?덉빟|?뚮┝|?곗콉|?대룞|?섏쁺|蹂묒썝|吏꾨즺|寃吏???蹂듭빟|諛⑸Ц|?꾪솕|?쎌냽|?앹궗|?꾩묠|?먯떖|???').hasMatch(compact)) {
      return null;
    }

    final targetDate = _parseScheduleDate(text);
    final keyword = _cleanScheduleTitle(text
        .replaceAll(RegExp(r'??젣?댁쨾|??젣|吏?뚯쨾|吏??痍⑥냼?댁쨾|痍⑥냼'), ' ')
        .trim());
    if (keyword.isEmpty) {
      return '?대뼡 ?쇱젙????젣?좉퉴?? ?? ?곗콉 ?쇱젙 ??젣?댁쨾';
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
      return '$keyword ?쇱젙??李얠? 紐삵뻽?댁슂.';
    }
    if (candidates.length > 1 && targetDate == null) {
      return '$keyword ?쇱젙???щ윭 媛??덉뼱?? ?좎쭨瑜?媛숈씠 留먰빐 二쇱꽭?? ?? ?댁씪 $keyword ??젣';
    }

    final schedule = candidates.first;
    final id = schedule is Map ? schedule['id'] : null;
    if (id == null) return '?쇱젙 ID瑜?李얠? 紐삵빐????젣?????놁뼱??';

    try {
      await ScheduleApi.deleteSchedule(id);
      await _refreshSchedules();
      return '${_formatScheduleBrief(schedule)} ?쇱젙????젣?덉뼱??';
    } catch (error) {
      return '?쇱젙 ??젣???ㅽ뙣?덉뼱?? ${error.toString().replaceFirst('Exception: ', '')}';
    }
  }

  Future<String?> _tryCreateScheduleFromText(String text) async {
    final seniorId = _seniorId;
    if (seniorId == null) return null;

    final pending = _pendingScheduleDraft;
    if (pending != null) {
      if (_isAffirmativeRegisterText(text) &&
          pending.time.isNotEmpty &&
          !pending.needsMeridiem) {
        _pendingScheduleDraft = null;
        return _saveParsedSchedule(
          _ParsedSchedule(
            date: pending.date,
            time: pending.time,
            title: pending.title,
          ),
        );
      }
      if (pending.needsMeridiem) {
        if (!_hasMeridiem(text)) {
          return '${_formatDateLabel(pending.date)} ${pending.title} ?쇱젙? ?ㅼ쟾?몄? ?ㅽ썑?몄? ?뚮젮二쇱꽭?? ?? ?ㅽ썑 ${_formatHourOnly(pending.time)}';
        }
        final time = _applyMeridiemToTime(pending.time, text);
        _pendingScheduleDraft = null;
        return _saveParsedSchedule(
          _ParsedSchedule(date: pending.date, time: time, title: pending.title),
        );
      }
      final time = _parseScheduleTime(text, pending.date);
      if (time.isEmpty) {
        return '${pending.title} ?쇱젙??紐??쒕줈 ?깅줉?좉퉴?? ?? ?ㅼ쟾 9??;
      }
      final timeMatch = _scheduleTimeMatch(text);
      final hour = int.tryParse(timeMatch?.group(2) ?? '') ?? 0;
      if (pending.needsMeridiem && hour >= 1 && hour <= 11 && !_hasMeridiem(text)) {
        return '${_formatDateLabel(pending.date)} ${pending.title} ?쇱젙? ?ㅼ쟾?몄? ?ㅽ썑?몄? ?뚮젮二쇱꽭?? ?? ?ㅼ쟾 6??;
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
        time: '',
        title: parsed.title,
        needsMeridiem: false,
      );
      return '${_formatDateLabel(parsed.date)} ${parsed.title} ?쇱젙??紐??쒕줈 ?깅줉?좉퉴??';
    }
    if (parsed.needsMeridiem) {
      _pendingScheduleDraft = _PendingScheduleDraft(
        date: parsed.date,
        time: parsed.time,
        title: parsed.title,
        needsMeridiem: true,
      );
      return '${_formatDateLabel(parsed.date)} ${_formatHourOnly(parsed.time)} ${parsed.title} ?쇱젙? ?ㅼ쟾?몄? ?ㅽ썑?몄? ?뚮젮二쇱꽭?? ?? ?ㅽ썑 ${_formatHourOnly(parsed.time)}';
    }

    return _saveParsedSchedule(parsed);
  }

  Future<String> _saveParsedSchedule(_ParsedSchedule parsed) async {
    final seniorId = _seniorId;
    if (seniorId == null) return '濡쒓렇???뺣낫瑜??뺤씤?섏? 紐삵빐???쇱젙 ?깅줉???????놁뼱??';
    try {
      final saved = await ScheduleApi.createSchedule({
        'seniorId': seniorId,
        'welfareWorkerId': _senior?['welfareWorkerId'],
        'visitDate': parsed.date,
        'visitTime': parsed.time,
        'purpose': parsed.title,
        'note': '梨쀫큸?먯꽌 ?깅줉???쇱젙?낅땲??',
        'status': 'PLANNED',
      });
      await _refreshSchedules();
      final savedDate = '${saved['visitDate'] ?? parsed.date}';
      final savedTime = '${saved['visitTime'] ?? parsed.time}';
      final timeLabel = savedTime.isEmpty ? '?쒓컙 誘몄젙' : _formatTime(savedTime);
      return '${_formatDateLabel(savedDate)} $timeLabel??${parsed.title} ?쇱젙?쇰줈 ?깅줉?덉뼱??';
    } catch (error) {
      final message = error.toString().replaceFirst('Exception: ', '');
      return '?쇱젙 ?깅줉???ㅽ뙣?덉뼱?? $message';
    }
  }

  _ParsedSchedule? _parseScheduleCreateText(String text) {
    final normalized = text
        .replaceAll('??, '?댁씪')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final compact = normalized.replaceAll(' ', '');
    final explicitCreate = RegExp(r'(?깅줉|異붽?|?ｌ뼱|?ｌ뼱以?湲곗뼲|梨숆꺼|?뚮┝|?덉빟)').hasMatch(compact);
    final looksLikeQuestion = RegExp(r'(萸??대뼸寃??뚮젮|?덉뼱|?덈굹???덉쑝?좉?|?뺤씤)').hasMatch(compact);
    final hasDateOrTime = _parseScheduleDate(normalized) != null ||
        RegExp(r'(?ㅼ쟾|?ㅽ썑|?꾩묠|?먯떖|???諛??덈꼍)?\s*\d{1,2}\s*??).hasMatch(normalized);
    final possibleTitle = _cleanScheduleTitle(normalized);
    final wantsCreate = explicitCreate || (hasDateOrTime && possibleTitle.isNotEmpty && !looksLikeQuestion);
    if (!wantsCreate || (!hasDateOrTime && possibleTitle.isEmpty)) return null;

    final parsedDate = _parseScheduleDate(normalized);
    final date = parsedDate ?? DateFormat('yyyy-MM-dd').format(DateTime.now());
    final time = _parseScheduleTime(normalized, date);
    final title = possibleTitle;
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
    if (text.contains('?ㅻ뒛')) return DateFormat('yyyy-MM-dd').format(now);
    if (text.contains('湲??)) {
      return DateFormat('yyyy-MM-dd').format(now.add(const Duration(days: 3)));
    }
    if (text.contains('?댁씪紐⑤젅') || text.contains('紐⑤젅')) {
      return DateFormat('yyyy-MM-dd').format(now.add(const Duration(days: 2)));
    }
    if (text.contains('?댁씪')) {
      return DateFormat('yyyy-MM-dd').format(now.add(const Duration(days: 1)));
    }

    final fullDate = RegExp(r'(20\d{2})[??/-]?\s*(\d{1,2})[??/-]?\s*(\d{1,2})??').firstMatch(text);
    if (fullDate != null) {
      final year = int.parse(fullDate.group(1)!);
      final month = int.parse(fullDate.group(2)!);
      final day = int.parse(fullDate.group(3)!);
      return DateFormat('yyyy-MM-dd').format(DateTime(year, month, day));
    }

    final monthDay = RegExp(r'(\d{1,2})\s*??s*(\d{1,2})\s*??').firstMatch(text);
    if (monthDay != null) {
      final month = int.parse(monthDay.group(1)!);
      final day = int.parse(monthDay.group(2)!);
      return DateFormat('yyyy-MM-dd').format(DateTime(now.year, month, day));
    }

    final dayOnly = RegExp(r'(^|[^\d??)(\d{1,2})\s*??).firstMatch(text);
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
    final minute = minuteText == '諛? ? 30 : int.tryParse(match.group(4) ?? '0') ?? 0;

    if (['?ㅽ썑', '???, '諛?].contains(meridiem) && hour < 12) hour += 12;
    if (['?ㅼ쟾', '?꾩묠', '?덈꼍'].contains(meridiem) && hour == 12) hour = 0;
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
    return RegExp(r'(?ㅼ쟾|?ㅽ썑|?꾩묠|?먯떖|???諛??덈꼍)?\s*(\d{1,2})\s*??s*(諛?(\d{1,2})\s*遺?)?').firstMatch(text);
  }

  bool _hasMeridiem(String text) {
    return RegExp(r'(?ㅼ쟾|?ㅽ썑|?꾩묠|?먯떖|???諛??덈꼍)').hasMatch(text);
  }

  bool _isAffirmativeRegisterText(String text) {
    final compact = text.replaceAll(' ', '');
    return RegExp(r'(??????留욎븘|留욎븘??洹몃옒|?깅줉|異붽?|?ｌ뼱|?댁쨾|吏꾪뻾)').hasMatch(compact);
  }

  String _applyMeridiemToTime(String time, String text) {
    final parts = time.split(':');
    var hour = int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 0;
    final minute = int.tryParse(parts.length > 1 ? parts[1] : '') ?? 0;
    if (RegExp(r'(?ㅽ썑|???諛?').hasMatch(text) && hour >= 1 && hour <= 11) {
      hour += 12;
    }
    if (RegExp(r'(?ㅼ쟾|?꾩묠|?덈꼍)').hasMatch(text) && hour == 12) {
      hour = 0;
    }
    return '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}';
  }

  String _formatHourOnly(String time) {
    final parts = time.split(':');
    final hour = int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 0;
    final minute = int.tryParse(parts.length > 1 ? parts[1] : '') ?? 0;
    final displayHour = hour == 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    if (minute == 0) return '$displayHour??;
    return '$displayHour??${minute}遺?;
  }

  String _cleanScheduleTitle(String text) {
    return text
        .replaceAll(RegExp(r'20\d{2}[??/-]?\s*\d{1,2}[??/-]?\s*\d{1,2}??'), ' ')
        .replaceAll(RegExp(r'\d{1,2}\s*??s*\d{1,2}\s*??'), ' ')
        .replaceAll(RegExp(r'?ㅻ뒛|?댁씪紐⑤젅|紐⑤젅|?댁씪|湲??), ' ')
        .replaceAll(RegExp(r'(?ㅼ쟾|?ㅽ썑|?꾩묠|?먯떖|???諛??덈꼍)?\s*\d{1,2}\s*??s*(諛?(\d{1,2})\s*遺?)?\s*??'), ' ')
        .replaceAll(RegExp(r'?쇱젙|?덉빟|?뚮┝|由щ쭏?몃뱶|?깅줉?댁쨾|?깅줉|異붽??댁쨾|異붽?|?ｌ뼱以??ｌ뼱|湲곗뼲?댁쨾|湲곗뼲|梨숆꺼以?梨숆꺼|?댁쨾|以?), ' ')
        .replaceAll(RegExp(r'[,.:]'), ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  bool _isScheduleQuestion(String normalized) {
    return normalized.contains('?쇱젙') ||
        normalized.contains('?ㅼ?以?) ||
        normalized.contains('?덉젙') ||
        normalized.contains('諛⑸Ц') ||
        normalized.contains('議곗튂??);
  }

  bool _isRecallScheduleQuestion(String normalized) {
    return normalized.contains('由ъ퐳') &&
        (normalized.contains('?쇱젙') ||
            normalized.contains('議곗튂??) ||
            normalized.contains('?꾩냽議곗튂') ||
            normalized.contains('諛⑸Ц') ||
            normalized.contains('?덉젙'));
  }

  bool _isEnergyVoucherQuestion(String normalized) {
    return normalized.contains('?먮꼫吏諛붿슦泥?) ||
        normalized.contains('?꾧린?붽툑') ||
        normalized.contains('媛?ㅼ슂湲?) ||
        normalized.contains('?쒕갑鍮?) ||
        normalized.contains('蹂듭??좎씤');
  }

  bool _isWeatherQuestion(String normalized) {
    return normalized.contains('?좎뵪') ||
        normalized.contains('湲곗긽') ||
        normalized.contains('?밸낫') ||
        normalized.contains('??뿼') ||
        normalized.contains('?쒗뙆') ||
        normalized.contains('?몄슦');
  }

  bool _isElectricQuestion(String normalized) {
    return normalized.contains('?꾧린') ||
        normalized.contains('肄섏꽱??) ||
        normalized.contains('硫?고꺆') ||
        normalized.contains('?꾩쟾') ||
        normalized.contains('李⑤떒湲?);
  }

  bool _isGasQuestion(String normalized) {
    return normalized.contains('媛??) ||
        normalized.contains('媛?ㅻ젅?몄?') ||
        normalized.contains('諛몃툕') ||
        normalized.contains('媛?ㅻ깂??) ||
        normalized.contains('蹂댁씪??);
  }

  bool _isKcQuestion(String normalized) {
    return normalized.contains('kc') ||
        normalized.contains('?덉쟾?몄쬆') ||
        normalized.contains('?몄쬆踰덊샇') ||
        normalized.contains('?몄쬆?뺣낫');
  }

  String _energyVoucherAnswer() {
    return [
      '?먮꼫吏諛붿슦泥섎뒗 ?섎떒 ?먮꼫吏 ??뿉???좎껌 ?곹깭瑜??뺤씤?????덉뼱??',
      '- ?꾧린?붽툑 蹂듭??좎씤',
      '- 媛?ㅼ슂湲?蹂듭??좎씤',
      '- ?먮꼫吏諛붿슦泥??좎껌 ?щ?',
      '誘몄떊泥?쑝濡?蹂댁씠硫?蹂댄샇?먮굹 ?대떦 蹂듭??ъ뿉寃??좎껌 ?꾩????붿껌??二쇱꽭??',
    ].join('\n');
  }

  String _weatherAnswer() {
    return [
      '湲곗긽?밸낫?????붾㈃ ?덉쟾 泥댄겕由ъ뒪?몄뿉???뺤씤?????덉뼱??',
      '- ??뿼?대굹 ?쒗뙆 ?뚮뒗 ?몄텧??以꾩뿬 二쇱꽭??',
      '- 臾쇱쓣 ?먯＜ 留덉떆怨??ㅻ궡 ?⑤룄瑜??뺤씤??二쇱꽭??',
      '- 紐몄씠 遺덊렪?섎㈃ 蹂댄샇?먮굹 蹂듭??ъ뿉寃?諛붾줈 ?곕씫??二쇱꽭??',
    ].join('\n');
  }

  String _electricSafetyAnswer() {
    return [
      '?꾧린 ?덉쟾? ?대젃寃??뺤씤??二쇱꽭??',
      '- 硫?고꺆???щ윭 ?쒗뭹???쒓볼踰덉뿉 苑귥? 留덉꽭??',
      '- ???꾩깉???댁씠 ?섎㈃ 諛붾줈 ?뚮윭洹몃? 戮묒븘 二쇱꽭??',
      '- ?뽰? ?먯쑝濡?肄섏꽱?몃? 留뚯?吏 留덉꽭??',
      '?꾪뿕?섎떎怨??먭뺨吏硫?吏곸젒 留뚯?吏 留먭퀬 蹂댄샇?먮굹 蹂듭??ъ뿉寃??곕씫??二쇱꽭??',
    ].join('\n');
  }

  String _gasSafetyAnswer() {
    return [
      '媛???꾩깉媛 ?섎㈃ 諛붾줈 ?대젃寃???二쇱꽭??',
      '- 媛??諛몃툕瑜??좉? 二쇱꽭??',
      '- 李쎈Ц???댁뼱 ?섍린??二쇱꽭??',
      '- 遺덉쓣 耳쒓굅???꾧린 ?ㅼ쐞移섎? ?꾨Ⅴ吏 留덉꽭??',
      '?꾩깉媛 怨꾩냽 ?섎㈃ 利됱떆 119 ?먮뒗 媛???덉쟾?쇳꽣???곕씫??二쇱꽭??',
    ].join('\n');
  }

  String _kcSafetyAnswer() {
    return [
      'KC ?덉쟾?몄쬆? ?쒗뭹 ?쇰꺼??KC 留덊겕, ?몄쬆踰덊샇, 紐⑤뜽紐낆쓣 湲곗??쇰줈 ?뺤씤?댁빞 ?댁슂.',
      '?꾩옱 ?깆? ?쒗뭹 ?쇰꺼 OCR怨?由ъ퐳 議고쉶源뚯? ?곌껐?섏뼱 ?덇퀬, KC ?몄쬆 ?곗씠???먮룞 ?議곕뒗 ?쒕쾭 ?곗씠???곕룞??異붽?濡??꾩슂?댁슂.',
      '?쒖뿰?먯꽌??由ъ퐳 ??쓽 ?쒗뭹 ?곸꽭??KC ?뺤씤 ?곹깭瑜??④퍡 蹂댁뿬二쇰뒗 ?먮쫫?쇰줈 ?곌껐?섎㈃ ?⑸땲??',
    ].join('\n');
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
      if (!_isLocalConversationId(conversationId)) {
        await AssistantConversationApi.saveMessage(
          seniorId,
          conversationId,
          {
            'role': message.role,
            'content': message.content,
          },
        );
      }
    } catch (_) {
      // Chat should continue even if persistence is temporarily unavailable.
    }
    await _appendLocalMessage(seniorId, conversationId, message);
  }

  Future<void> _maybeUpdateTitle(String text) async {
    final seniorId = _seniorId;
    final conversationId = _activeConversationId;
    if (seniorId == null || conversationId == null) return;
    final current = _conversations.firstWhere(
      (conversation) => conversation is Map && _sameConversationId(conversation['id'], conversationId),
      orElse: () => const {},
    );
    if (current is Map) {
      final currentTitle = '${current['title'] ?? ''}'.trim();
      if (currentTitle.isNotEmpty && currentTitle != '?????) return;
    }
    final title = text.length > 18 ? '${text.substring(0, 18)}...' : text;
    try {
      if (!_isLocalConversationId(conversationId)) {
        await AssistantConversationApi.updateTitle(seniorId, conversationId, title);
      }
    } catch (_) {
      // Title updates are cosmetic.
    }
    await _updateLocalConversationTitle(seniorId, conversationId, title);
    if (!mounted) return;
    setState(() {
      _conversations = _conversations
          .map((conversation) => _sameConversationId(conversation['id'], conversationId)
              ? {...conversation, 'title': title}
              : conversation)
          .toList();
    });
  }

  Future<void> _deleteConversation(dynamic conversationId) async {
    final seniorId = _seniorId;
    if (seniorId == null) return;
    try {
      if (!_isLocalConversationId(conversationId)) {
        await AssistantConversationApi.deleteConversation(seniorId, conversationId);
      }
    } catch (_) {
      // If the server delete fails, remove the local copy so the UI stays usable.
    }
    await _deleteLocalConversation(seniorId, conversationId);
    if (!mounted) return;
    setState(() {
      _conversations = _conversations
          .where((conversation) => !_sameConversationId(conversation['id'], conversationId))
          .toList();
    });
    await _refreshConversations();
    if (_activeConversationId == conversationId) {
      if (_conversations.isEmpty) {
        await _createConversation();
      } else {
        await _openConversation(_conversations.first['id']);
      }
    }
  }

  Future<List<dynamic>> _mergeConversations(
    List<dynamic> remote,
    List<dynamic> local,
  ) async {
    return _mergeConversationsSync(remote, local);
  }

  List<dynamic> _mergeConversationsSync(List<dynamic> remote, List<dynamic> local) {
    final byId = <String, Map<String, dynamic>>{};

    for (final conversation in [...remote, ...local]) {
      if (conversation is! Map) continue;
      final map = Map<String, dynamic>.from(conversation);
      final id = '${map['id'] ?? ''}';
      if (id.isEmpty) continue;
      byId[id] = {
        ...map,
        'title': _conversationTitle(map),
        'updatedAt': map['updatedAt'] ?? map['createdAt'] ?? DateTime.now().toIso8601String(),
      };
    }

    final conversations = byId.values.toList();
    conversations.sort((a, b) => _parseDate(b['updatedAt']).compareTo(_parseDate(a['updatedAt'])));
    return conversations;
  }

  Future<List<dynamic>> _loadLocalConversations(int seniorId) async {
    final raw = await _localStore.read(key: _conversationKey(seniorId));
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) return decoded;
    } catch (_) {
      // Ignore broken cache.
    }
    return [];
  }

  Future<void> _saveLocalConversations(int seniorId, List<dynamic> conversations) async {
    await _localStore.write(
      key: _conversationKey(seniorId),
      value: jsonEncode(conversations),
    );
  }

  Future<void> _upsertLocalConversation(
    int seniorId,
    Map<String, dynamic> conversation,
  ) async {
    final conversations = await _loadLocalConversations(seniorId);
    final next = [
      {
        ...conversation,
        'title': _conversationTitle(conversation),
        'updatedAt': DateTime.now().toIso8601String(),
      },
      ...conversations
          .where((item) => item is Map && !_sameConversationId(item['id'], conversation['id'])),
    ];
    await _saveLocalConversations(seniorId, next);
  }

  Future<void> _updateLocalConversationTitle(
    int seniorId,
    dynamic conversationId,
    String title,
  ) async {
    final conversations = await _loadLocalConversations(seniorId);
    final next = conversations
        .map((conversation) => conversation is Map && _sameConversationId(conversation['id'], conversationId)
            ? {
                ...Map<String, dynamic>.from(conversation),
                'title': title,
                'updatedAt': DateTime.now().toIso8601String(),
              }
            : conversation)
        .toList();
    await _saveLocalConversations(seniorId, next);
  }

  Future<void> _deleteLocalConversation(int seniorId, dynamic conversationId) async {
    final conversations = await _loadLocalConversations(seniorId);
    final next = conversations
        .where((conversation) => conversation is! Map || !_sameConversationId(conversation['id'], conversationId))
        .toList();
    await _saveLocalConversations(seniorId, next);
    await _localStore.delete(key: _messagesKey(seniorId, conversationId));
  }

  Future<List<Map<String, dynamic>>> _loadLocalMessages(
    int seniorId,
    dynamic conversationId,
  ) async {
    final raw = await _localStore.read(key: _messagesKey(seniorId, conversationId));
    if (raw == null || raw.isEmpty) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .whereType<Map>()
            .map((message) => Map<String, dynamic>.from(message))
            .toList();
      }
    } catch (_) {
      // Ignore broken cache.
    }
    return [];
  }

  Future<void> _saveLocalMessages(
    int seniorId,
    dynamic conversationId,
    List<_ChatMessage> messages,
  ) async {
    await _localStore.write(
      key: _messagesKey(seniorId, conversationId),
      value: jsonEncode(messages.map(_messageToJson).toList()),
    );
  }

  Future<void> _appendLocalMessage(
    int seniorId,
    dynamic conversationId,
    _ChatMessage message,
  ) async {
    final messages = await _loadLocalMessages(seniorId, conversationId);
    messages.add(_messageToJson(message));
    await _localStore.write(
      key: _messagesKey(seniorId, conversationId),
      value: jsonEncode(messages),
    );

    final current = _conversations.firstWhere(
      (conversation) => conversation is Map && _sameConversationId(conversation['id'], conversationId),
      orElse: () => _newLocalConversation(id: conversationId),
    );
    await _upsertLocalConversation(
      seniorId,
      {
        ...Map<String, dynamic>.from(current as Map),
        'updatedAt': DateTime.now().toIso8601String(),
      },
    );
  }

  Map<String, dynamic> _messageToJson(_ChatMessage message) {
    return {
      'role': message.role,
      'content': message.content,
      'createdAt': message.createdAt.toIso8601String(),
    };
  }

  Map<String, dynamic> _newLocalConversation({dynamic id}) {
    final now = DateTime.now().toIso8601String();
    return {
      'id': id ?? 'local_${DateTime.now().microsecondsSinceEpoch}',
      'title': '?????,
      'createdAt': now,
      'updatedAt': now,
      'localOnly': true,
    };
  }

  String _conversationTitle(Map<dynamic, dynamic> conversation) {
    final title = '${conversation['title'] ?? ''}'.trim();
    return title.isEmpty ? '????? : title;
  }

  bool _isLocalConversationId(dynamic id) => '$id'.startsWith('local_');

  bool _sameConversationId(dynamic a, dynamic b) => '$a' == '$b';

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
        '${schedule['purpose'] ?? schedule['title'] ?? schedule['content'] ?? schedule['memo'] ?? '?쇱젙'}';
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
    if (briefs.isEmpty) return '?깅줉??由ъ퐳 ?꾩냽 議곗튂 ?쇱젙 ?놁쓬';
    return _summarizeBriefs(briefs);
  }

  String _summarizeBriefs(List<String> briefs, {int limit = 2}) {
    if (briefs.length <= limit) return briefs.join(', ');
    final visible = briefs.take(limit).join(', ');
    return '$visible ??${briefs.length - limit}嫄?;
  }

  String _formatScheduleAnswer(String title, List<String> briefs, {int limit = 2}) {
    final visible = briefs.take(limit).toList();
    final lines = <String>[
      title,
      for (final brief in visible) '??$brief',
    ];
    if (briefs.length > limit) {
      lines.add('??${briefs.length - limit}嫄댁씠 ???덉뼱??');
    }
    return lines.join('\n');
  }

  Future<List<String>> _fetchRecallScheduleBriefs({String? dateText}) async {
    final seniorId = _seniorId;
    if (seniorId == null) return [];
    try {
      final products = await ProductApi.getProductsBySenior(seniorId);
      return products
          .where((product) => '${product['recallStatus'] ?? ''}' == 'RECALLED')
          .where((product) {
            final date = '${product['nextActionDate'] ?? ''}';
            if (date.isEmpty) return false;
            final shortDate = date.length >= 10 ? date.substring(0, 10) : date;
            return dateText == null || shortDate == dateText;
          })
          .map((product) {
            final date = '${product['nextActionDate'] ?? ''}';
            final shortDate = date.length >= 10 ? date.substring(0, 10) : date;
            final productName = '${product['productName'] ?? '由ъ퐳 ?쒗뭹'}';
            final followUpType = '${product['followUpType'] ?? ''}'.trim();
            final label = followUpType.isEmpty ? '由ъ퐳 ?꾩냽 議곗튂' : followUpType;
            return '${_formatDateLabel(shortDate)} $productName $label';
          })
          .toList();
    } catch (_) {
      return [];
    }
  }

  String _formatDateLabel(String date) {
    final parsed = DateTime.tryParse(date);
    if (parsed == null) return date;
    return DateFormat('M??d??).format(parsed);
  }

  String _formatTime(String time) {
    final parts = time.split(':');
    if (parts.length < 2) return time;
    final hour = int.tryParse(parts[0]) ?? 0;
    final minute = int.tryParse(parts[1]) ?? 0;
    final period = hour < 12 ? '?ㅼ쟾' : '?ㅽ썑';
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
        title: const Text('?곷떞 梨쀫큸'),
        actions: [
          IconButton(
            tooltip: '???紐⑸줉',
            onPressed: _openConversationSheet,
            icon: const Icon(Icons.menu),
          ),
          IconButton(
            tooltip: '?????,
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
              voiceAnswerEnabled: _voiceAnswerEnabled,
              onSend: _send,
              onVoice: _toggleListening,
              onToggleVoiceAnswer: () {
                _setVoiceAnswerEnabled(!_voiceAnswerEnabled);
              },
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
                  '???紐⑸줉',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                ),
                const Spacer(),
                TextButton.icon(
                  onPressed: () {
                    Navigator.pop(context);
                    _createConversation();
                  },
                  icon: const Icon(Icons.add),
                  label: const Text('?????),
                ),
              ],
            ),
            if (_conversations.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Text('??λ맂 ??붽? ?놁뒿?덈떎.', style: TextStyle(color: kTextMuted)),
              ),
            ..._conversations.map((conversation) {
              final id = conversation['id'];
              final title = '${conversation['title'] ?? '?????}';
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
                    '?쇱젙 ?щ젰',
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
                    '${_formatDateLabel(selectedText)} ?쇱젙',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 8),
                  if (schedules.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text('?깅줉???쇱젙???놁뒿?덈떎.', style: TextStyle(color: kTextMuted)),
                    )
                  else
                    ...schedules.map((schedule) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.event_available, color: kPrimary),
                          title: Text(_formatScheduleBrief(schedule)),
                          subtitle: Text('${schedule['note'] ?? ''}'.trim().isEmpty
                              ? '諛⑸Ц ?쇱젙'
                              : '${schedule['note']}'),
                          trailing: IconButton(
                            tooltip: '?쇱젙 ??젣',
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
      await _addAssistantAnswer('?쇱젙 ID瑜?李얠? 紐삵빐????젣?????놁뼱??');
      return false;
    }
    try {
      await ScheduleApi.deleteSchedule(id);
      await _refreshSchedules();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('?쇱젙????젣?덉뒿?덈떎.')),
        );
      }
      return true;
    } catch (error) {
      await _addAssistantAnswer('?쇱젙 ??젣???ㅽ뙣?덉뼱?? ${error.toString().replaceFirst('Exception: ', '')}');
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
                const Text('?ㅻ뒛 ?쇱젙', style: TextStyle(fontWeight: FontWeight.w800)),
                const Spacer(),
                TextButton.icon(
                  onPressed: onOpenCalendar,
                  icon: const Icon(Icons.calendar_month, size: 18),
                  label: const Text('?щ젰'),
                  style: TextButton.styleFrom(
                    foregroundColor: kPrimaryDark,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            if (schedules.isEmpty)
              const Text('?깅줉???쇱젙???놁뒿?덈떎.', style: TextStyle(color: kTextMuted, fontSize: 12))
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
                    DateFormat('yyyy??M??).format(focusedMonth),
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
              _WeekdayLabel('??, color: kDanger),
              _WeekdayLabel('??),
              _WeekdayLabel('??),
              _WeekdayLabel('??),
              _WeekdayLabel('紐?),
              _WeekdayLabel('湲?),
              _WeekdayLabel('??, color: kPrimary),
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
      '?ㅻ뒛 ?쇱젙 ?뚮젮以?,
      '由ъ퐳 議곗튂?쇱젙 ?뚮젮以?,
      '由ъ퐳 ?쒗뭹? ?대뼸寃??뺤씤??',
      '?먮꼫吏諛붿슦泥??뚮젮以?,
      '?꾧린 ?덉쟾 ?뚮젮以?,
      '媛???꾩깉 ?섎㈃?',
      'KC ?몄쬆? 萸먯빞?',
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
      2 => Icons.manage_search,
      3 => Icons.bolt,
      4 => Icons.electrical_services,
      5 => Icons.local_fire_department_outlined,
      _ => Icons.verified_outlined,
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
  final period = value.hour < 12 ? '?ㅼ쟾' : '?ㅽ썑';
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
              '?듬????묒꽦 以묒엯?덈떎...',
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
    required this.voiceAnswerEnabled,
    required this.onSend,
    required this.onVoice,
    required this.onToggleVoiceAnswer,
  });

  final TextEditingController controller;
  final bool sending;
  final bool listening;
  final bool voiceAnswerEnabled;
  final VoidCallback onSend;
  final VoidCallback onVoice;
  final VoidCallback onToggleVoiceAnswer;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: kBorder)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (listening)
            Container(
              width: double.infinity,
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: kPrimaryLight,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: kPrimary.withOpacity(0.22)),
              ),
              child: const Text(
                '?ｊ퀬 ?덉뼱?? 留먯???留덉튂硫??먮룞?쇰줈 ?꾩넚?⑸땲??',
                style: TextStyle(color: kPrimaryDark, fontSize: 12, fontWeight: FontWeight.w700),
              ),
            ),
          Row(
            children: [
              IconButton.filledTonal(
                tooltip: listening ? '?뚯꽦 ?낅젰 以묒?' : '?뚯꽦?쇰줈 留먰븯湲?,
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
                    hintText: listening ? '留먯????ｊ퀬 ?덉뼱?? : '沅곴툑???댁슜???낅젰?섏꽭??,
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
              IconButton.filledTonal(
                tooltip: voiceAnswerEnabled ? '?뚯꽦 ?듬? ?꾧린' : '?뚯꽦 ?듬? 耳쒓린',
                onPressed: onToggleVoiceAnswer,
                style: IconButton.styleFrom(
                  backgroundColor: voiceAnswerEnabled ? kPrimaryLight : kBg,
                  foregroundColor: voiceAnswerEnabled ? kPrimaryDark : kTextMuted,
                ),
                icon: Icon(voiceAnswerEnabled ? Icons.volume_up : Icons.volume_off),
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
    required this.time,
    required this.title,
    required this.needsMeridiem,
  });

  final String date;
  final String time;
  final String title;
  final bool needsMeridiem;
}
