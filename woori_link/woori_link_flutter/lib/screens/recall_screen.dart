import 'package:flutter/material.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../api/product_api.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class RecallScreen extends StatefulWidget {
  const RecallScreen({super.key});

  @override
  State<RecallScreen> createState() => _RecallScreenState();
}

class _RecallScreenState extends State<RecallScreen> {
  List<dynamic> _products = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) return;
      final data = await ProductApi.getProductsBySenior(seniorId);
      setState(() {
        _products = data;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _registerByInput({
    String productName = '',
    String manufacturer = '',
    String modelNumber = '',
  }) async {
    final nameCtrl = TextEditingController(text: productName);
    final manufacturerCtrl = TextEditingController(text: manufacturer);
    final modelCtrl = TextEditingController(text: modelNumber);
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('보유 제품 등록'),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              '모델명/모델번호를 우선 확인해 주세요. 등록하면 제품안전정보센터 리콜 목록과 자동 매칭합니다.',
              style: TextStyle(fontSize: 12, color: kTextMuted, height: 1.45),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: '품목/제품 종류'),
            ),
            TextField(
              controller: manufacturerCtrl,
              decoration: const InputDecoration(labelText: '제조사'),
            ),
            TextField(
              controller: modelCtrl,
              decoration: const InputDecoration(labelText: '모델명/모델번호'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () async {
              final productName = nameCtrl.text.trim();
              final modelNumber = modelCtrl.text.trim();
              if (productName.isEmpty && modelNumber.isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('품목 또는 모델명을 입력해 주세요.')),
                );
                return;
              }
              try {
                final seniorId = await AuthService.getUserId();
                if (seniorId == null) {
                  throw Exception('로그인 사용자 정보를 찾지 못했습니다.');
                }
                await ProductApi.registerProduct({
                  'seniorId': seniorId,
                  'productName':
                      productName.isNotEmpty ? productName : modelNumber,
                  'manufacturer': manufacturerCtrl.text.trim(),
                  'modelNumber': modelNumber,
                });
                if (ctx.mounted) Navigator.pop(ctx);
                await _load();
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('제품안전정보센터 리콜 조회가 완료되었습니다.')),
                );
              } catch (error) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(_shortError(error))),
                );
              }
            },
            child: const Text('등록'),
          ),
        ],
      ),
    );
  }

  Future<void> _pickAndRegister() async {
    final picker = ImagePicker();
    final img = await picker.pickImage(source: ImageSource.gallery);
    if (img == null || !mounted) return;
    await _recognizeProductFromImage(img.path);
  }

  Future<void> _scanBarcode() async {
    final barcode = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _BarcodeScanScreen()),
    );
    if (barcode == null || barcode.isEmpty || !mounted) return;
    await _registerByInput(modelNumber: barcode);
  }

  void _showOcrProgressDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        contentPadding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: const [
            SizedBox(
              width: 40,
              height: 40,
              child: CircularProgressIndicator(strokeWidth: 4),
            ),
            SizedBox(height: 18),
            Text(
              '제품 라벨 분석 중',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            SizedBox(height: 8),
            Text(
              '사진에서 품목, 제조사, 모델명을 읽고 있어요.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: kTextMuted, height: 1.4),
            ),
            SizedBox(height: 16),
            LinearProgressIndicator(),
          ],
        ),
      ),
    );
  }

  Future<void> _recognizeProductFromImage(String path) async {
    final recognizer = TextRecognizer(script: TextRecognitionScript.korean);
    var progressOpen = false;
    _ExtractedProductInfo? extracted;
    Object? recognitionError;

    if (mounted) {
      progressOpen = true;
      _showOcrProgressDialog();
    }

    try {
      await Future.delayed(const Duration(milliseconds: 350));
      final recognizedText =
          await recognizer.processImage(InputImage.fromFilePath(path));
      debugPrint('OCR text:\n${recognizedText.text}');
      extracted = _extractProductInfo(recognizedText);
    } catch (error) {
      recognitionError = error;
    } finally {
      await recognizer.close();
      if (progressOpen && mounted) {
        Navigator.of(context, rootNavigator: true).pop();
      }
    }

    if (recognitionError == null && extracted != null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('OCR 인식이 완료되었습니다. 내용을 확인해 주세요.')),
      );
      await _registerByInput(
        productName: extracted.productName,
        manufacturer: extracted.manufacturer,
        modelNumber: extracted.modelNumber,
      );
      return;
    }

    if (!mounted) return;
    debugPrint('OCR failed: $recognitionError');
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('사진에서 제품 정보를 읽지 못했습니다. 직접 입력해 주세요.')),
    );
    await _registerByInput();
  }

  _ExtractedProductInfo _extractProductInfo(RecognizedText recognizedText) {
    final positionedLines = _positionedOcrLines(recognizedText);
    final lines = recognizedText.text
        .split(RegExp(r'\r?\n'))
        .map((line) => line.replaceAll(RegExp(r'\s+'), ' ').trim())
        .where((line) => line.isNotEmpty)
        .toList();

    String findByLabels(List<String> labels) {
      final sortedLabels = [...labels]
        ..sort((a, b) => b.length.compareTo(a.length));

      for (final label in sortedLabels) {
        final byPosition = _findTableValueByPosition(positionedLines, label);
        if (_isUsefulOcrValue(byPosition, label)) return byPosition;
      }

      for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        final line = lines[lineIndex];
        for (final label in sortedLabels) {
          final pattern = RegExp(
            '(^|[\\s|│])${RegExp.escape(label)}\\s*[:：]?\\s*(.+)\$',
            caseSensitive: false,
          );
          final match = pattern.firstMatch(line);
          final value = _cleanOcrValue(match?.group(2) ?? '');
          if (_isUsefulOcrValue(value, label)) return value;
        }
      }
      return '';
    }

    final productName =
        findByLabels(['제품명', '제품 명', '품명', '상품명', '명칭', '품목명', '품목']);
    final manufacturer = findByLabels(
      ['상표명/제조자', '상표명', '제조사', '제조원', '제조자', '수입원', '판매원'],
    );
    final modelNumber = findByLabels([
      '모델번호',
      '모델 No',
      '모델명',
      'MODEL',
      'Model',
      '형식',
      '형명',
      '품번',
    ]);

    return _ExtractedProductInfo(
      productName: productName.isNotEmpty
          ? productName
          : _guessProductName(lines),
      manufacturer: manufacturer,
      modelNumber: modelNumber.isNotEmpty ? modelNumber : _guessModelNumber(lines),
    );
  }

  List<_OcrLine> _positionedOcrLines(RecognizedText recognizedText) {
    final ocrLines = <_OcrLine>[];
    for (final block in recognizedText.blocks) {
      for (final line in block.lines) {
        final text = line.text.replaceAll(RegExp(r'\s+'), ' ').trim();
        if (text.isEmpty) continue;
        ocrLines.add(_OcrLine(text: text, box: line.boundingBox));
      }
    }
    ocrLines.sort((a, b) {
      final yCompare = a.centerY.compareTo(b.centerY);
      if (yCompare != 0) return yCompare;
      return a.box.left.compareTo(b.box.left);
    });
    return ocrLines;
  }

  String _findTableValueByPosition(List<_OcrLine> lines, String label) {
    final labelLine = lines
        .where((line) => _lineHasLabel(line.text, label))
        .fold<_OcrLine?>(
          null,
          (best, line) {
            if (best == null) return line;
            return line.box.left < best.box.left ? line : best;
          },
        );
    if (labelLine == null) return '';

    final inlineValue = _valueAfterLabel(labelLine.text, label);
    if (_isUsefulOcrValue(inlineValue, label)) return inlineValue;

    final rowHeight = labelLine.box.height <= 0 ? 24.0 : labelLine.box.height;
    final rowCandidates = lines
        .where((line) =>
            line != labelLine &&
            line.box.left > labelLine.box.right - 4 &&
            (line.centerY - labelLine.centerY).abs() <= rowHeight * 0.9)
        .toList()
      ..sort((a, b) => a.box.left.compareTo(b.box.left));

    for (final candidate in rowCandidates) {
      final value = _cleanOcrValue(candidate.text);
      if (_isUsefulOcrValue(value, label) && !_isLikelyLabelLine(value)) {
        return value;
      }
    }

    return '';
  }

  bool _lineHasLabel(String line, String label) {
    final compactLine = line.replaceAll(RegExp(r'\s+'), '').toLowerCase();
    final compactLabel = label.replaceAll(RegExp(r'\s+'), '').toLowerCase();
    return compactLine == compactLabel ||
        compactLine.startsWith(compactLabel) ||
        compactLine.contains('|$compactLabel') ||
        compactLine.contains('│$compactLabel');
  }

  String _valueAfterLabel(String line, String label) {
    final pattern = RegExp(
      '(^|[\\s|│])${RegExp.escape(label)}\\s*[:：]?\\s*(.+)\$',
      caseSensitive: false,
    );
    final match = pattern.firstMatch(line);
    return _cleanOcrValue(match?.group(2) ?? '');
  }

  String _cleanOcrValue(String value) {
    return value
        .replaceAll(RegExp(r'^[|│ㆍ·:\-=\s]+'), '')
        .replaceAll(RegExp(r'[|│]+$'), '')
        .trim();
  }

  bool _sameOcrToken(String value, String label) {
    return value.replaceAll(RegExp(r'\s+'), '').toLowerCase() ==
        label.replaceAll(RegExp(r'\s+'), '').toLowerCase();
  }

  bool _isUsefulOcrValue(String value, String label) {
    if (value.isEmpty) return false;
    if (_sameOcrToken(value, label)) return false;
    if (value.length == 1) return false;
    final compact = value.replaceAll(RegExp(r'\s+'), '');
    const blocked = {
      '명',
      '번호',
      '모델',
      '모델명',
      '제품명',
      '품명',
      '기능',
      '정격전원',
      '정격능력',
      '소비전력',
      '운전전류',
      '냉매명',
      '냉매봉입량',
      '설계압력',
      '제품중량',
      '인증기관',
      '제조국가',
      '제조국가(원산지)',
      '원산지',
      '국가(원산지)',
    };
    return !blocked.contains(compact);
  }

  bool _isLikelyLabelLine(String line) {
    final compact = line.replaceAll(RegExp(r'\s+'), '').toLowerCase();
    const labels = {
      '제품명',
      '품명',
      '상품명',
      '명칭',
      '모델명',
      '모델번호',
      'model',
      '제조사',
      '제조원',
      '제조자',
      '제조국가',
      '제조국가(원산지)',
      '상표명/제조자',
      '상표명',
    };
    return labels.contains(compact);
  }

  String _shortError(Object error) {
    final message = error.toString().replaceFirst('Exception: ', '');
    if (message.length <= 140) return message;
    return '${message.substring(0, 140)}...';
  }

  String _guessProductName(List<String> lines) {
    for (final line in lines) {
      final value = _cleanOcrValue(line);
      final lower = value.toLowerCase();
      if (_isLikelyLabelLine(value)) continue;
      if (lower.contains('model') || lower.contains('s/n') || lower.contains('mac')) {
        continue;
      }
      if (RegExp(r'[가-힣]').hasMatch(value) && value.length >= 3) {
        return value;
      }
    }
    return '';
  }

  String _guessModelNumber(List<String> lines) {
    final preferredLines = [
      ...lines.where((line) =>
          RegExp(r'모델|model', caseSensitive: false).hasMatch(line)),
      ...lines.where((line) =>
          !RegExp(r'모델|model', caseSensitive: false).hasMatch(line)),
    ];

    final modelPattern = RegExp(
      r'\b([A-Z]{1,6}\d[A-Z0-9\-]{3,})\b',
      caseSensitive: false,
    );

    for (final line in preferredLines) {
      if (RegExp(r'mac|s/n', caseSensitive: false).hasMatch(line)) continue;
      final match = modelPattern.firstMatch(line.replaceAll(' ', ''));
      final value = match?.group(1)?.toUpperCase() ?? '';
      if (value.length >= 5) return value;
    }
    return '';
  }

  void _openRegisterOptions() {
    showModalBottomSheet(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.qr_code_scanner, color: kPrimary),
                title: const Text('바코드 스캔'),
                subtitle: const Text('바코드 값을 등록 보조 정보로 불러옵니다.'),
                onTap: () {
                  Navigator.pop(ctx);
                  _scanBarcode();
                },
              ),
              ListTile(
                leading: const Icon(Icons.document_scanner_outlined, color: kPrimary),
                title: const Text('제품 라벨 OCR'),
                subtitle: const Text('사진에서 품목·제조사·모델명을 읽습니다.'),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndRegister();
                },
              ),
              ListTile(
                leading: const Icon(Icons.edit_outlined, color: kPrimary),
                title: const Text('직접 입력'),
                subtitle: const Text('제품 정보를 직접 입력합니다.'),
                onTap: () {
                  Navigator.pop(ctx);
                  _registerByInput();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _statusColor(String? status) {
    if (status == 'RECALLED') return kDanger;
    if (status == 'SAFE') return kPrimary;
    return kTextMuted;
  }

  String _statusLabel(String? status) {
    if (status == 'RECALLED') return '리콜';
    if (status == 'SAFE') return '안전';
    return '확인중';
  }

  String _checkedAtLabel(dynamic value) {
    final checkedAt = DateTime.tryParse('${value ?? ''}');
    if (checkedAt == null) return '아직 조회 전';
    return DateFormat('yyyy.MM.dd HH:mm').format(checkedAt);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('리콜 제품 확인'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () async {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('제품안전정보센터에서 리콜 정보를 다시 조회합니다.')),
              );
              try {
                await ProductApi.refreshProducts();
                await _load();
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('리콜 정보 새로고침이 완료되었습니다.')),
                );
              } catch (error) {
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(_shortError(error))),
                );
              }
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _recallFlowCard(),
                  const SizedBox(height: 12),
                  if (_products.isEmpty)
                    _emptyProducts()
                  else
                    ..._products.map((p) {
                      final status = p['recallStatus'] as String?;
                      final reason = p['recallReason'] as String?;
                      final manufacturer = p['manufacturer'] as String?;
                      return Card(
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          leading: Icon(
                            status == 'RECALLED'
                                ? Icons.warning_amber
                                : Icons.inventory_2_outlined,
                            color: _statusColor(status),
                            size: 28,
                          ),
                          title: Text(
                            p['productName'] ?? '제품명 없음',
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  [
                                    if (manufacturer != null && manufacturer.isNotEmpty)
                                      manufacturer,
                                    if ((p['modelNumber'] ?? '').toString().isNotEmpty)
                                      '모델명 ${p['modelNumber']}',
                                  ].join(' · '),
                                  style: const TextStyle(fontSize: 12),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '마지막 조회: ${_checkedAtLabel(p['lastCheckedAt'])}',
                                  style: const TextStyle(
                                      fontSize: 11, color: kTextMuted),
                                ),
                                if (status == 'RECALLED' &&
                                    reason != null &&
                                    reason.isNotEmpty) ...[
                                  const SizedBox(height: 6),
                                  Text(
                                    reason,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 12, color: kDanger),
                                  ),
                                ],
                                if (status == 'RECALLED') ...[
                                  const SizedBox(height: 8),
                                  Container(
                                    width: double.infinity,
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: kDanger.withOpacity(0.08),
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(
                                        color: kDanger.withOpacity(0.18),
                                      ),
                                    ),
                                    child: const Text(
                                      '리콜 미조치 대상자로 보호자와 복지사에게 표시됩니다. 방문·전화 조치가 필요합니다.',
                                      style: TextStyle(
                                        color: kDanger,
                                        fontSize: 11,
                                        height: 1.35,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          trailing: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: _statusColor(status).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              _statusLabel(status),
                              style: TextStyle(
                                  color: _statusColor(status),
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600),
                            ),
                          ),
                          onLongPress: () async {
                            final yes = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('제품 삭제'),
                                content: Text(
                                    '${p['productName']} 을(를) 삭제하시겠습니까?'),
                                actions: [
                                  TextButton(
                                      onPressed: () =>
                                          Navigator.pop(ctx, false),
                                      child: const Text('취소')),
                                  ElevatedButton(
                                      onPressed: () =>
                                          Navigator.pop(ctx, true),
                                      child: const Text('삭제')),
                                ],
                              ),
                            );
                            if (yes == true) {
                              await ProductApi.deleteProduct(p['id']);
                              await _load();
                            }
                          },
                        ),
                      );
                    }),
                ],
              ),
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'cam',
            onPressed: _scanBarcode,
            backgroundColor: Colors.white,
            foregroundColor: kPrimary,
            child: const Icon(Icons.qr_code_scanner),
          ),
          const SizedBox(height: 8),
          FloatingActionButton(
            heroTag: 'add',
            onPressed: _openRegisterOptions,
            backgroundColor: kPrimary,
            child: const Icon(Icons.add, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _recallFlowCard() {
    final recalledCount = _products
        .where((p) => p is Map && p['recallStatus'] == 'RECALLED')
        .length;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.verified_user_outlined, color: kPrimary),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    '제품안전정보센터 자동 매칭',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                ),
                if (recalledCount > 0)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: kDanger.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '리콜 $recalledCount건',
                      style: const TextStyle(
                        color: kDanger,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            const Text(
              '어르신이 보유한 제품을 바코드·OCR 기반으로 등록하면 국가기술표준원 제품안전정보센터 리콜 목록과 자동으로 비교합니다.',
              style: TextStyle(fontSize: 12, color: kTextMuted, height: 1.45),
            ),
            const SizedBox(height: 12),
            Row(
              children: const [
                _FlowStep(icon: Icons.qr_code_scanner, label: '제품 등록'),
                _FlowDivider(),
                _FlowStep(icon: Icons.manage_search, label: '리콜 매칭'),
                _FlowDivider(),
                _FlowStep(icon: Icons.support_agent, label: '조치 연계'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyProducts() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Column(
        children: [
          const Icon(Icons.inventory_2_outlined, size: 64, color: kTextMuted),
          const SizedBox(height: 16),
          const Text('등록된 제품이 없습니다.', style: TextStyle(color: kTextMuted)),
          const SizedBox(height: 8),
          const Text(
            '품목·제조사·모델명을 등록하면 제품안전정보센터에서 리콜 여부를 바로 확인합니다.',
            textAlign: TextAlign.center,
            style: TextStyle(color: kTextMuted, fontSize: 12),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _openRegisterOptions,
            icon: const Icon(Icons.add),
            label: const Text('제품 등록'),
          ),
        ],
      ),
    );
  }
}

class _FlowStep extends StatelessWidget {
  const _FlowStep({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, color: kPrimary, size: 22),
          const SizedBox(height: 6),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _FlowDivider extends StatelessWidget {
  const _FlowDivider();

  @override
  Widget build(BuildContext context) {
    return Container(width: 18, height: 1, color: kBorder);
  }
}

class _ExtractedProductInfo {
  const _ExtractedProductInfo({
    required this.productName,
    required this.manufacturer,
    required this.modelNumber,
  });

  final String productName;
  final String manufacturer;
  final String modelNumber;
}

class _OcrLine {
  const _OcrLine({
    required this.text,
    required this.box,
  });

  final String text;
  final Rect box;

  double get centerY => box.top + box.height / 2;
}

class _BarcodeScanScreen extends StatefulWidget {
  const _BarcodeScanScreen();

  @override
  State<_BarcodeScanScreen> createState() => _BarcodeScanScreenState();
}

class _BarcodeScanScreenState extends State<_BarcodeScanScreen> {
  bool _handled = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('바코드 스캔')),
      body: Stack(
        children: [
          MobileScanner(
            onDetect: (capture) {
              if (_handled) return;
              String? value;
              for (final barcode in capture.barcodes) {
                final raw = barcode.rawValue;
                if (raw != null && raw.isNotEmpty) {
                  value = raw;
                  break;
                }
              }
              if (value == null) return;
              _handled = true;
              Navigator.of(context).pop(value);
            },
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              color: Colors.black.withOpacity(0.58),
              child: const SafeArea(
                top: false,
                child: Text(
                  '제품 바코드를 화면 중앙에 맞춰 주세요.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
