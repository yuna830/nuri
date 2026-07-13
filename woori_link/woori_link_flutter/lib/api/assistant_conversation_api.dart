import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants.dart';
import 'http_client.dart';

const _imageUrlsStart = '[WOORI_IMAGE_URLS]';
const _imageUrlsEnd = '[/WOORI_IMAGE_URLS]';
const _hiddenMessageMarker = '[WOORI_HIDDEN_MESSAGE]';

class AssistantConversationApi {
  static Future<Map<String, dynamic>> createConversation(int seniorId) async {
    final res = await http.post(
      Uri.parse('$baseUrl/assistant-conversations/senior/$seniorId'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200 || res.statusCode == 201) {
      return jsonDecode(res.body) as Map<String, dynamic>;
    }
    throw Exception('대화 생성 실패');
  }

  static Future<List<dynamic>> fetchConversations(int seniorId) async {
    final res = await http.get(
      Uri.parse('$baseUrl/assistant-conversations/senior/$seniorId'),
      headers: await authHeaders(),
    );
    if (res.statusCode == 200) return jsonDecode(res.body) as List<dynamic>;
    throw Exception('대화 목록 조회 실패');
  }

  static Future<List<Map<String, dynamic>>> fetchMessages(
    int seniorId,
    dynamic conversationId,
  ) async {
    final uri = Uri.parse('$baseUrl/assistant-conversations/$conversationId/messages')
        .replace(queryParameters: {'seniorId': '$seniorId'});
    final res = await http.get(uri, headers: await authHeaders());
    if (res.statusCode == 200) {
      final messages = jsonDecode(res.body) as List<dynamic>;
      return messages
          .map((message) => _decodeMessage(message as Map<String, dynamic>))
          .toList();
    }
    throw Exception('대화 메시지 조회 실패');
  }

  static Future<void> saveMessage(
    int seniorId,
    dynamic conversationId,
    Map<String, dynamic> message,
  ) async {
    final uri = Uri.parse('$baseUrl/assistant-conversations/$conversationId/messages')
        .replace(queryParameters: {'seniorId': '$seniorId'});
    final res = await http.post(
      uri,
      headers: await authHeaders(),
      body: jsonEncode({
        'role': message['role'],
        'content': _encodeMessage(message),
      }),
    );
    if (res.statusCode == 200 || res.statusCode == 201) return;
    throw Exception('대화 메시지 저장 실패');
  }

  static Future<void> updateTitle(
    int seniorId,
    dynamic conversationId,
    String title,
  ) async {
    final uri = Uri.parse('$baseUrl/assistant-conversations/$conversationId')
        .replace(queryParameters: {'seniorId': '$seniorId'});
    final res = await http.patch(
      uri,
      headers: await authHeaders(),
      body: jsonEncode({'title': title}),
    );
    if (res.statusCode == 200 || res.statusCode == 204) return;
    throw Exception('대화 제목 수정 실패');
  }

  static Future<void> deleteConversation(int seniorId, dynamic conversationId) async {
    final uri = Uri.parse('$baseUrl/assistant-conversations/$conversationId')
        .replace(queryParameters: {'seniorId': '$seniorId'});
    final res = await http.delete(uri, headers: await authHeaders());
    if (res.statusCode == 200 || res.statusCode == 204) return;
    throw Exception('대화 삭제 실패');
  }
}

String _encodeMessage(Map<String, dynamic> message) {
  final rawContent = '${message['content'] ?? ''}';
  final content = message['hidden'] == true
      ? '$_hiddenMessageMarker\n$rawContent'
      : rawContent;
  final imageUrls = message['imageUrls'] is List ? message['imageUrls'] as List : [];
  if (imageUrls.isEmpty) return content;
  return '$content\n\n$_imageUrlsStart${jsonEncode(imageUrls)}$_imageUrlsEnd';
}

Map<String, dynamic> _decodeMessage(Map<String, dynamic> message) {
  var decoded = Map<String, dynamic>.from(message);
  var content = '${decoded['content'] ?? ''}';

  final markerPattern = RegExp(
    r'\n*' +
        RegExp.escape(_imageUrlsStart) +
        r'([\s\S]*?)' +
        RegExp.escape(_imageUrlsEnd) +
        r'\s*$',
  );
  final match = markerPattern.firstMatch(content);
  if (match != null) {
    try {
      decoded['imageUrls'] = jsonDecode(match.group(1) ?? '[]');
      content = content.replaceFirst(markerPattern, '').trim();
    } catch (_) {
      // Keep raw content if legacy image metadata is malformed.
    }
  }

  if (content.startsWith(_hiddenMessageMarker)) {
    decoded['hidden'] = true;
    content = content.substring(_hiddenMessageMarker.length).trimLeft();
  }

  decoded['content'] = content;
  decoded['role'] = '${decoded['role'] ?? 'assistant'}'.toLowerCase();
  return decoded;
}
