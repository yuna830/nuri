import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../api/product_api.dart';
import '../api/senior_api.dart';
import '../services/auth_service.dart';
import '../theme.dart';
import '../api/action_api.dart';

class RecallScreen extends StatefulWidget {
  const RecallScreen({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  State<RecallScreen> createState() => _RecallScreenState();
}

class _RecallScreenState extends State<RecallScreen> {
  List<dynamic> _products = [];
  List<dynamic> _actions = [];
  Map<String, dynamic>? _senior;
  int _selectedTab = 0;
  bool _loading = true;
  String? _loadError;
  Timer? _refreshTimer;
  final Set<String> _shownTomorrowReminderKeys = {};

  @override
  void initState() {
    super.initState();
    _selectedTab = widget.initialTab;
    _load();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (mounted) _load(silent: true);
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) return;
      final results = await Future.wait([
        ProductApi.getProductsBySenior(seniorId),
        ActionApi.getActionsBySenior(seniorId),
        SeniorApi.getSenior(seniorId).catchError((_) => <String, dynamic>{}),
      ]);
      setState(() {
        _products = _sortNewest(results[0] as List<dynamic>, 'createdAt');
        _actions = _dedupeRecallActions(
          _sortNewest(
            (results[1] as List<dynamic>)
                .where((a) => '${a['actionType'] ?? ''}' == 'RECALL')
                .where((a) => '${a['status'] ?? ''}' != 'CANCELLED')
                .toList(),
            'updatedAt',
          ),
        );
        _senior = results[2] as Map<String, dynamic>;
        _loadError = null;
        if (!silent) _loading = false;
      });
      _showTomorrowVisitReminders();
    } catch (error) {
      debugPrint('Recall load failed: $error');
      if (!silent) {
        setState(() {
          _loadError = error.toString().replaceFirst('Exception: ', '');
          _loading = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(_loadError ?? '리콜 제품 목록을 불러오지 못했습니다.')),
          );
        }
      }
    }
  }

  Future<void> _registerByInput({
    String productName = '',
    String manufacturer = '',
    String modelNumber = '',
    String barcode = '',
    String certificationNumber = '',
    bool showOcrSummary = false,
  }) async {
    final nameCtrl = TextEditingController(text: productName);
    final manufacturerCtrl = TextEditingController(text: manufacturer);
    final modelCtrl = TextEditingController(text: modelNumber);
    final barcodeCtrl = TextEditingController(text: barcode);
    final certCtrl = TextEditingController(text: certificationNumber);
    var isSubmitting = false;

    await showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) => PopScope(
            canPop: !isSubmitting,
            child: AlertDialog(
              title: const Text('보유 제품 등록'),
              scrollable: true,
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    '모델명/모델번호를 우선 확인해 주세요. 등록하면 제품안전정보센터 리콜 목록과 자동 매칭합니다.',
                    style: TextStyle(
                      fontSize: 12,
                      color: kTextMuted,
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: nameCtrl,
                    enabled: !isSubmitting,
                    decoration: const InputDecoration(labelText: '상품명/제품명'),
                  ),
                  TextField(
                    controller: manufacturerCtrl,
                    enabled: !isSubmitting,
                    decoration: const InputDecoration(labelText: '제조사'),
                  ),
                  TextField(
                    controller: modelCtrl,
                    enabled: !isSubmitting,
                    decoration: const InputDecoration(labelText: '모델명/모델번호'),
                  ),
                  TextField(
                    controller: barcodeCtrl,
                    enabled: !isSubmitting,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: '바코드',
                      helperText: barcode.isEmpty
                          ? '제품 바코드 숫자를 직접 입력해도 됩니다.'
                          : '스캔된 바코드입니다. 값이 다르면 수정해 주세요.',
                      prefixIcon: const Icon(Icons.qr_code_2),
                    ),
                  ),
                  TextField(
                    controller: certCtrl,
                    enabled: !isSubmitting,
                    decoration: const InputDecoration(
                      labelText: 'KC 인증번호',
                      helperText: '제품 라벨의 KC 번호가 있으면 리콜 판정이 더 정확해집니다.',
                    ),
                  ),
                  if (showOcrSummary) ...[
                    const SizedBox(height: 12),
                    _RecognizedInfoBox(
                      label: '자동 인식된 인증번호',
                      value: certificationNumber.trim().isEmpty
                          ? '인식되지 않음'
                          : certificationNumber.trim(),
                    ),
                  ],
                  if (barcode.trim().isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _RecognizedInfoBox(
                      label: '스캔된 바코드',
                      value: barcode.trim(),
                    ),
                  ],
                  if (isSubmitting) ...[
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: kPrimary.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: kPrimary.withOpacity(0.18)),
                      ),
                      child: const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '제품 등록 중',
                            style: TextStyle(
                              color: kPrimary,
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          SizedBox(height: 8),
                          LinearProgressIndicator(),
                          SizedBox(height: 8),
                          Text(
                            '리콜 정보와 KC 번호를 확인하고 있어요. 잠시만 기다려 주세요.',
                            style: TextStyle(
                              color: kTextMuted,
                              fontSize: 11,
                              height: 1.35,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
                  child: const Text('취소'),
                ),
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final productName = nameCtrl.text.trim();
                          final modelNumber = modelCtrl.text.trim();
                          final barcodeValue = _normalizeBarcode(
                            barcodeCtrl.text,
                          );
                          final certNumber = certCtrl.text.trim();
                          if (productName.isEmpty &&
                              modelNumber.isEmpty &&
                              barcodeValue.isEmpty &&
                              certNumber.isEmpty) {
                            ScaffoldMessenger.of(ctx).showSnackBar(
                              const SnackBar(
                                content:
                                    Text('제품명, 모델명, 바코드, KC 인증번호 중 하나는 필요합니다.'),
                              ),
                            );
                            return;
                          }

                          if (isSubmitting) return;
                          setDialogState(() => isSubmitting = true);
                          try {
                            final seniorId = await AuthService.getUserId();
                            if (seniorId == null) {
                              throw Exception('로그인 사용자 정보를 찾지 못했습니다.');
                            }
                            final saved = await ProductApi.registerProduct({
                              'seniorId': seniorId,
                              'productName': productName.isNotEmpty
                                  ? productName
                                  : (modelNumber.isNotEmpty
                                      ? modelNumber
                                      : (barcodeValue.isNotEmpty
                                          ? barcodeValue
                                          : certNumber)),
                              'manufacturer': manufacturerCtrl.text.trim(),
                              'modelNumber': modelNumber,
                              'barcode': barcodeValue,
                              'certificationNumber': certNumber,
                              'registrationSource': barcodeValue.isNotEmpty
                                  ? 'BARCODE_SCAN'
                                  : (certNumber.isNotEmpty
                                      ? 'KC_INPUT'
                                      : 'MANUAL'),
                            });
                            if (ctx.mounted) Navigator.pop(ctx);
                            await _load();
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                  content:
                                      Text(_registrationResultMessage(saved))),
                            );
                          } catch (error) {
                            if (ctx.mounted) {
                              setDialogState(() => isSubmitting = false);
                            }
                            if (!mounted) return;
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(_shortError(error))),
                            );
                          }
                        },
                  child: isSubmitting
                      ? const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            ),
                            SizedBox(width: 8),
                            Text('등록 중'),
                          ],
                        )
                      : const Text('등록'),
                ),
              ],
            ),
          ),
        );
      },
    );
    nameCtrl.dispose();
    manufacturerCtrl.dispose();
    modelCtrl.dispose();
    barcodeCtrl.dispose();
    certCtrl.dispose();
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
    final normalized = _normalizeBarcode(barcode);
    if (normalized.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('바코드 숫자를 읽지 못했습니다. 다시 스캔해 주세요.')),
      );
      return;
    }
    await _registerByInput(barcode: normalized);
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
              '사진에서 상품명, 제조사, 모델명을 읽고 있어요.',
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
        certificationNumber: extracted.certificationNumber,
        showOcrSummary: true,
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
            '(^|[\\s|│])${_labelPattern(label)}\\s*[:：|│]?\\s*(.+)\$',
            caseSensitive: false,
          );
          final match = pattern.firstMatch(line);
          final value = _cleanOcrValue(match?.group(2) ?? '');
          if (_isUsefulOcrValue(value, label)) return value;
        }
      }
      return '';
    }

    String findByLabelsInOrder(List<String> labels) {
      for (final label in labels) {
        final byPosition = _findTableValueByPosition(positionedLines, label);
        if (_isUsefulOcrValue(byPosition, label)) return byPosition;
      }

      for (final label in labels) {
        for (final line in lines) {
          final pattern = RegExp(
            '(^|[\\s|│])${_labelPattern(label)}\\s*[:：|│]?\\s*(.+)\$',
            caseSensitive: false,
          );
          final match = pattern.firstMatch(line);
          final value =
              _stripKnownLabelPrefix(_cleanOcrValue(match?.group(2) ?? ''));
          if (_isUsefulOcrValue(value, label)) return value;
        }
      }
      return '';
    }

    final guessedModelNumber = _guessModelNumber(lines);
    final certificationNumber = _guessCertificationNumber(lines);
    final guessedManufacturer = _guessManufacturer(lines);
    final guessedProductName = _guessProductName(lines, guessedModelNumber);

    final productName = findByLabels([
      '상 품 명',
      '상품명',
      '제품명',
      '제품 명',
      '품명',
      '품목명',
      '품목',
      '명칭',
    ]);
    final manufacturer = findByLabelsInOrder([
      '공급원',
      '판매원',
      '사업자명',
      '제조사',
      '제조원',
      '제조자',
      '상표명/제조자',
      '상표명',
      '수입원',
    ]);
    final modelNumber = findByLabels([
      '모델번호',
      '모델 No',
      '모델 명',
      '모델명',
      'MODEL',
      'Model',
      '형식',
      '형명',
      '품번',
    ]);
    final cleanedProductName =
        _isBadProductNameValue(productName) ? '' : productName;
    final cleanedModelNumber =
        _isBadModelNumberValue(modelNumber) ? '' : modelNumber;

    return _ExtractedProductInfo(
      productName: cleanedProductName.isNotEmpty
          ? cleanedProductName
          : guessedProductName,
      manufacturer:
          manufacturer.isNotEmpty ? manufacturer : guessedManufacturer,
      modelNumber: cleanedModelNumber.isNotEmpty
          ? cleanedModelNumber
          : guessedModelNumber,
      certificationNumber: certificationNumber,
    );
  }

  String _guessCertificationNumber(List<String> lines) {
    final text = lines.join(' ');
    final certPatterns = [
      RegExp(
        r'(?:K\s*[CÇ]|I\s*G|G)?\s*([XS]U\s*\d{5,6}\s*[- ]\s*\d{5})',
        caseSensitive: false,
      ),
      RegExp(
        r'(?:K\s*[CÇ]\s*)?(R\s*[- ]\s*R\s*[- ]\s*[A-Z0-9]{2,6}\s*[- ]\s*[A-Z0-9-]{4,})\b',
        caseSensitive: false,
      ),
      RegExp(r'\b[A-Z]{1,3}\s*[- ]\s*[A-Z0-9]{2,6}\s*[- ]\s*[A-Z0-9-]{4,}\b'),
    ];
    for (final pattern in certPatterns) {
      final match = pattern.firstMatch(text);
      if (match == null) continue;
      final value = _firstMatchedGroup(match);
      final normalized = _normalizeCertificationNumber(value);
      if (RegExp(r'^[XS]U\d{5,6}-\d{5}$').hasMatch(normalized) ||
          normalized.startsWith('R-R-')) {
        return normalized;
      }
    }
    return '';
  }

  String _firstMatchedGroup(RegExpMatch match) {
    for (var index = 1; index <= match.groupCount; index++) {
      final value = match.group(index);
      if (value != null && value.trim().isNotEmpty) {
        return value;
      }
    }
    return match.group(0) ?? '';
  }

  String _normalizeCertificationNumber(String value) {
    var normalized = value
        .replaceAll('Ç', 'C')
        .replaceAll('ç', 'C')
        .replaceAll(RegExp(r'\s+'), '')
        .toUpperCase();
    normalized = normalized.replaceFirst(RegExp(r'^KC(?=R-R-)'), '');
    normalized = normalized.replaceFirst(RegExp(r'^KCR(?=-R-)'), 'R');
    return normalized;
  }

  String _guessManufacturer(List<String> lines) {
    final joined = lines.join(' ').toUpperCase();
    if (joined.contains('SAMSUNG')) return 'SAMSUNG';
    final makerPattern =
        RegExp(r'(?:제조자|제조사|제조원|상호명)\s*[:：]?\s*([가-힣A-Z0-9().,&\s-]{2,40})');
    for (final line in lines) {
      final match = makerPattern.firstMatch(line);
      final value = _cleanOcrValue(match?.group(1) ?? '');
      if (value.isNotEmpty) return value;
    }
    return '';
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
    final labelLine =
        lines.where((line) => _lineHasLabel(line.text, label)).fold<_OcrLine?>(
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
      final value = _stripKnownLabelPrefix(_cleanOcrValue(candidate.text));
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
      '(^|[\\s|│])${_labelPattern(label)}\\s*[:：|│]?\\s*(.+)\$',
      caseSensitive: false,
    );
    final match = pattern.firstMatch(line);
    return _cleanOcrValue(match?.group(2) ?? '');
  }

  String _labelPattern(String label) {
    final chars = label
        .replaceAll(RegExp(r'\s+'), '')
        .split('')
        .map(RegExp.escape)
        .join(r'\s*');
    return chars;
  }

  String _cleanOcrValue(String value) {
    return value
        .replaceAll(RegExp(r'^[|│ㆍ·:\-=\s]+'), '')
        .replaceAll(RegExp(r'[|│]+$'), '')
        .trim();
  }

  String _stripKnownLabelPrefix(String value) {
    var result = _cleanOcrValue(value);
    final labels = [
      '인증번호',
      '인증/신고번호',
      '상 품 명',
      '상품명',
      '제품명',
      '품목명',
      '품명',
      '모 델 명',
      '모델명',
      '모델번호',
      '배 터 리',
      '배터리',
      '제조연월',
      '제조국',
      '제조국가',
      '수 입 원',
      '수입원',
      '공 급 원',
      '공급원',
      '판 매 원',
      '판매원',
      '고객센터',
      '품질보증기간',
      '제조번호',
    ];
    for (final label in labels) {
      final pattern = RegExp(
        '^${_labelPattern(label)}\\s*[:：|│]?\\s*(.+)\$',
        caseSensitive: false,
      );
      final match = pattern.firstMatch(result);
      if (match != null) {
        result = _cleanOcrValue(match.group(1) ?? '');
      }
    }
    return result;
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
      '인증번호',
      '인증신고번호',
      '인증/신고번호',
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
      '인증번호',
      '인증신고번호',
      '인증/신고번호',
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

  String _normalizeBarcode(String value) {
    return value.replaceAll(RegExp(r'[^0-9]'), '');
  }

  String _registrationResultMessage(Map<String, dynamic> product) {
    final productName = '${product['productName'] ?? '제품'}';
    final checkStatus = '${product['recallCheckStatus'] ?? ''}';
    final decision = '${product['recallDecisionStatus'] ?? ''}';
    final recallStatus = '${product['recallStatus'] ?? ''}';
    final error = '${product['lastCheckErrorMessage'] ?? ''}'.trim();

    if (checkStatus == 'FAILED') {
      return error.isEmpty
          ? '$productName 등록 완료. 리콜 조회는 실패했습니다.'
          : '$productName 등록 완료. 리콜 조회 실패: ${_shortError(error)}';
    }
    if (decision == 'NO_MATCH_FOUND' || recallStatus == 'SAFE') {
      return '$productName 등록 완료. 현재 리콜 공고와 일치하지 않습니다.';
    }
    if (decision == 'RECALL_CONFIRMED' ||
        decision == 'REVIEW_REQUIRED' ||
        recallStatus == 'RECALLED') {
      return '$productName 등록 완료. 리콜 대상입니다. 조치 요청을 확인해 주세요.';
    }
    if (recallStatus == 'UNKNOWN') {
      return '$productName 등록 완료. 리콜 조회 결과를 확인해 주세요.';
    }
    return '$productName 등록 완료. 리콜 조회 결과를 확인해 주세요.';
  }

  List<dynamic> _sortNewest(List<dynamic> items, String dateField) {
    final sorted = [...items];
    sorted.sort((a, b) {
      final left = a is Map ? DateTime.tryParse('${a[dateField] ?? ''}') : null;
      final right =
          b is Map ? DateTime.tryParse('${b[dateField] ?? ''}') : null;
      final leftTime = left ?? DateTime.fromMillisecondsSinceEpoch(0);
      final rightTime = right ?? DateTime.fromMillisecondsSinceEpoch(0);
      return rightTime.compareTo(leftTime);
    });
    return sorted;
  }

  List<dynamic> _dedupeRecallActions(List<dynamic> actions) {
    final seen = <String>{};
    final result = <dynamic>[];

    for (final item in actions) {
      if (item is! Map) continue;
      final action = Map<String, dynamic>.from(item);
      if (_isDeletedProductAction(action)) continue;
      final key = _recallActionKey(action);
      if (seen.add(key)) result.add(action);
    }

    return result;
  }

  bool _isDeletedProductAction(Map<String, dynamic> action) {
    final productId = _extractActionProductId('${action['note'] ?? ''}');
    return productId.isNotEmpty && _productForAction(action) == null;
  }

  String _recallActionKey(Map<String, dynamic> action) {
    final product = _productForAction(action);
    final matchedProductId = '${product?['id'] ?? ''}'.trim();
    if (matchedProductId.isNotEmpty) return 'id:$matchedProductId';

    final productId = _extractActionProductId('${action['note'] ?? ''}');
    if (productId.isNotEmpty) return 'id:$productId';

    final modelNumber = _extractActionModelNumber('${action['note'] ?? ''}');
    if (modelNumber.isNotEmpty) return 'model:${modelNumber.toLowerCase()}';

    final productName =
        _normalizeRecallProductName('${action['productName'] ?? ''}');
    if (productName.isNotEmpty) return 'name:$productName';

    return 'action:${action['id'] ?? action['createdAt'] ?? ''}';
  }

  Map<String, dynamic>? _productForAction(Map<String, dynamic> action) {
    final actionProductName = '${action['productName'] ?? ''}'.trim();
    final actionNote = '${action['note'] ?? ''}';
    final actionProductId = _extractActionProductId(actionNote);
    final actionModelNumber = _extractActionModelNumber(actionNote);

    for (final item in _products) {
      if (item is! Map) continue;
      final product = Map<String, dynamic>.from(item);
      final productId = '${product['id'] ?? ''}'.trim();
      final productName = '${product['productName'] ?? ''}'.trim();
      final modelNumber = '${product['modelNumber'] ?? ''}'.trim();

      if (actionProductId.isNotEmpty && actionProductId == productId) {
        return product;
      }
      if (actionModelNumber.isNotEmpty &&
          modelNumber.isNotEmpty &&
          actionModelNumber == modelNumber) {
        return product;
      }
      if (actionModelNumber.isEmpty &&
          actionProductName.isNotEmpty &&
          _sameRecallProductName(actionProductName, productName)) {
        return product;
      }
    }

    return null;
  }

  String _effectiveActionStatus(Map<String, dynamic> action) {
    final product = _productForAction(action);
    if (product == null) return '${action['status'] ?? 'PENDING'}';

    final finalResult = '${product['finalResult'] ?? ''}';
    final followUpProgress = '${product['followUpProgressStatus'] ?? ''}';
    if (finalResult.isNotEmpty || followUpProgress == 'COMPLETED') {
      return 'COMPLETED';
    }

    final currentUseStatus = '${product['currentUseStatus'] ?? 'UNKNOWN'}';
    final followUpType = '${product['followUpType'] ?? ''}'.trim();
    final stopGuidanceCompleted = product['stopGuidanceCompleted'] == true;
    if (currentUseStatus != 'UNKNOWN' ||
        followUpType.isNotEmpty ||
        stopGuidanceCompleted) {
      return 'IN_PROGRESS';
    }

    return '${action['status'] ?? 'PENDING'}';
  }

  DateTime? _actionNextDate(Map<String, dynamic> action) {
    final rawActionDate = '${action['dueDate'] ?? ''}'.trim();
    final product = _productForAction(action);
    final rawProductDate = '${product?['nextActionDate'] ?? ''}'.trim();
    final raw = rawActionDate.isNotEmpty ? rawActionDate : rawProductDate;
    if (raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  String _actionScheduleLabel(Map<String, dynamic> action) {
    final date = _actionNextDate(action);
    if (date == null) return '';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final target = DateTime(date.year, date.month, date.day);
    final diff = target.difference(today).inDays;
    final formatted = DateFormat('yyyy.MM.dd').format(date);
    if (diff == 0) return '오늘 방문 예정 ($formatted)';
    if (diff == 1) return '내일 방문 예정 ($formatted)';
    if (diff > 1) return '$diff일 뒤 방문 예정 ($formatted)';
    return '방문 예정일 지남 ($formatted)';
  }

  bool _isTomorrowAction(Map<String, dynamic> action) {
    final date = _actionNextDate(action);
    if (date == null) return false;
    final now = DateTime.now();
    final tomorrow =
        DateTime(now.year, now.month, now.day).add(const Duration(days: 1));
    return date.year == tomorrow.year &&
        date.month == tomorrow.month &&
        date.day == tomorrow.day;
  }

  String _actionReminderKey(Map<String, dynamic> action) {
    final id = '${action['id'] ?? ''}'.trim();
    if (id.isNotEmpty) return id;
    return _recallActionKey(action);
  }

  void _showTomorrowVisitReminders() {
    if (_senior?['recallReminderEnabled'] == false) return;

    final dueTomorrow = _actions
        .whereType<Map>()
        .map((action) => Map<String, dynamic>.from(action))
        .where((action) {
      final status = _effectiveActionStatus(action);
      return status != 'COMPLETED' &&
          status != 'CANCELLED' &&
          _isTomorrowAction(action);
    }).toList();
    if (dueTomorrow.isEmpty || !mounted) return;

    final fresh = dueTomorrow
        .where((action) =>
            !_shownTomorrowReminderKeys.contains(_actionReminderKey(action)))
        .toList();
    if (fresh.isEmpty) return;

    for (final action in fresh) {
      _shownTomorrowReminderKeys.add(_actionReminderKey(action));
    }

    final names = fresh
        .take(2)
        .map((action) => '${action['productName'] ?? '리콜 제품'}')
        .join(', ');
    final extra = fresh.length > 2 ? ' 외 ${fresh.length - 2}건' : '';
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('내일 방문 예정인 리콜 조치가 있어요: $names$extra'),
          action: SnackBarAction(
            label: '보기',
            onPressed: () {
              ScaffoldMessenger.of(context).hideCurrentSnackBar();
              setState(() => _selectedTab = 1);
            },
          ),
        ),
      );
    });
  }

  void _showProductDetail(Map<String, dynamic> product) {
    final status = _effectiveRecallStatus(product);
    final reason = '${product['recallReason'] ?? ''}'.trim();
    final reasonSections = _recallReasonSections(reason);
    final hasRequest = _hasRecallRequest(product);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FractionallySizedBox(
        heightFactor: 0.88,
        alignment: Alignment.bottomCenter,
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: kBorder,
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        Icon(
                          status == 'RECALLED'
                              ? Icons.warning_amber
                              : Icons.inventory_2_outlined,
                          color: _statusColor(status),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${product['productName'] ?? '제품명 없음'}',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        Text(
                          _statusLabel(status),
                          style: TextStyle(
                            color: _statusColor(status),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _detailLine('제조사', '${product['manufacturer'] ?? '-'}'),
                    _detailLine('모델명', '${product['modelNumber'] ?? '-'}'),
                    _detailLine('바코드', '${product['barcode'] ?? '-'}'),
                    _detailLine('KC 인증번호',
                        '${product['certificationNumber'] ?? product['kcCertNum'] ?? '-'}'),
                    _detailLine('등록일', _checkedAtLabel(product['createdAt'])),
                    _detailLine(
                        '마지막 조회', _checkedAtLabel(product['lastCheckedAt'])),
                    const SizedBox(height: 4),
                    _kcInfoCard(product),
                    if (reason.isNotEmpty && status == 'RECALLED') ...[
                      const SizedBox(height: 12),
                      const Text(
                        '리콜 사유',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      if (reasonSections.isEmpty)
                        _recallReasonCard('상세 내용', reason)
                      else
                        ...reasonSections.entries.map(
                          (entry) => _recallReasonCard(entry.key, entry.value),
                        ),
                    ],
                    if (reason.isNotEmpty && status != 'RECALLED') ...[
                      const SizedBox(height: 12),
                      Text(
                        status == 'SAFE' ? '조회 결과' : '추가 확인 필요',
                        style: const TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      _recallInfoCard(reason, status),
                    ],
                    if (status == 'RECALLED') ...[
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () {
                            Navigator.pop(ctx);
                            if (hasRequest) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text(
                                        '이미 리콜 조치 요청 내역이 있는 제품입니다. 요청 내역을 확인해 주세요.')),
                              );
                              setState(() => _selectedTab = 1);
                            } else {
                              _requestRecallAction(product);
                            }
                          },
                          icon: Icon(hasRequest
                              ? Icons.check_circle_outline
                              : Icons.support_agent),
                          label: Text(hasRequest ? '요청 내역 보기' : '리콜 조치 요청'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: hasRequest ? kTextMuted : kDanger,
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showActionDetail(Map<String, dynamic> action) {
    final status = _effectiveActionStatus(action);
    final note = '${action['note'] ?? ''}'.trim();
    final modelNumber = _extractActionModelNumber(note);
    final requestMemo = _requestMemoOnly(note);
    final scheduleLabel = _actionScheduleLabel(action);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => FractionallySizedBox(
        heightFactor: 0.82,
        alignment: Alignment.bottomCenter,
        child: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: kBorder,
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                    ),
                    Row(
                      children: [
                        const Icon(Icons.assignment_turned_in_outlined,
                            color: kDanger),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            '리콜 조치 요청 상세',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        Text(
                          _actionStatusLabel(status),
                          style: TextStyle(
                            color: _actionStatusColor(status),
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _detailLine('제품명', '${action['productName'] ?? '-'}'),
                    if (modelNumber.isNotEmpty) _detailLine('모델명', modelNumber),
                    _detailLine('요청 상태', _actionStatusLabel(status)),
                    _detailLine('요청일', _checkedAtLabel(action['createdAt'])),
                    if (scheduleLabel.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: kPrimary.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: kPrimary.withOpacity(0.18)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.event_available,
                                color: kPrimaryDark),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                scheduleLabel,
                                style: const TextStyle(
                                  color: kPrimaryDark,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (requestMemo.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Text(
                        '요청 내용',
                        style: TextStyle(
                            fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: kPrimary.withOpacity(0.07),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: kPrimary.withOpacity(0.14)),
                        ),
                        child: Text(
                          requestMemo,
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.45,
                            color: kTextMuted,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _detailLine(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 86,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 13,
                color: kTextMuted,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  String _requestMemoOnly(String note) {
    if (note.isEmpty) return '';
    final marker = '제품안전정보센터 리콜 사유:';
    final markerIndex = note.indexOf(marker);
    final raw = markerIndex >= 0 ? note.substring(0, markerIndex) : note;
    return raw
        .split(RegExp(r'\r?\n'))
        .map((line) => line.trim())
        .where((line) =>
            line.isNotEmpty &&
            !line.startsWith('제품ID:') &&
            !line.startsWith('모델명:'))
        .join('\n');
  }

  String _extractActionModelNumber(String note) {
    final match = RegExp(r'모델명:\s*([^\r\n]+)').firstMatch(note);
    return match?.group(1)?.trim() ?? '';
  }

  String _extractActionProductId(String note) {
    final match = RegExp(r'제품ID:\s*([0-9]+)').firstMatch(note);
    return match?.group(1)?.trim() ?? '';
  }

  String _normalizeRecallProductName(String value) {
    return value
        .trim()
        .toLowerCase()
        .replaceAll('\uBCA0\uD130\uB9AC', '\uBC30\uD130\uB9AC')
        .replaceAll(RegExp(r'[^0-9a-z\uAC00-\uD7A3]+'), '');
  }

  bool _sameRecallProductName(String left, String right) {
    final normalizedLeft = _normalizeRecallProductName(left);
    final normalizedRight = _normalizeRecallProductName(right);
    return normalizedLeft.isNotEmpty && normalizedLeft == normalizedRight;
  }

  Map<String, String> _recallReasonSections(String reason) {
    if (reason.trim().isEmpty) return {};

    final normalized =
        reason.replaceAll('\r\n', '\n').replaceAll('\r', '\n').trim();
    final labels = ['제품 결함', '위해 정보', '소비자 행동요령', '문의처'];
    final matches = <({String label, int start, int valueStart})>[];

    for (final label in labels) {
      final index = normalized.indexOf('$label:');
      if (index >= 0) {
        matches.add((
          label: label,
          start: index,
          valueStart: index + label.length + 1,
        ));
      }
    }

    matches.sort((a, b) => a.start.compareTo(b.start));
    final sections = <String, String>{};
    for (var i = 0; i < matches.length; i++) {
      final current = matches[i];
      final end =
          i + 1 < matches.length ? matches[i + 1].start : normalized.length;
      final value = normalized
          .substring(current.valueStart, end)
          .trim()
          .replaceAll(RegExp(r'\n{3,}'), '\n\n');
      if (value.isNotEmpty) sections[current.label] = value;
    }
    return sections;
  }

  Widget _recallReasonCard(String title, String content) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kDanger.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kDanger.withOpacity(0.16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: kDanger,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            content,
            style: const TextStyle(
              color: kDanger,
              fontSize: 12,
              height: 1.45,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _recallInfoCard(String content, String status) {
    final color = status == 'REVIEW' ? kWarning : kPrimary;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.16)),
      ),
      child: Text(
        content,
        style: TextStyle(
          color: color,
          fontSize: 12,
          height: 1.45,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  String _kcStatus(Map<String, dynamic> product) {
    final raw = [
      product['kcStatus'],
      product['kcCertificationStatus'],
      product['kcSafetyStatus'],
      product['certificationStatus'],
    ].where((value) => value != null).join(' ').trim().toUpperCase();
    final detectedCertNumber = [
      product['kcCertNum'],
      product['certificationNumber'],
    ]
        .where((value) => value != null)
        .map((value) => _normalizeCertificationNumber('$value'))
        .where((value) => _isCertificationNumber(value))
        .join(' ');

    if (raw.isEmpty && detectedCertNumber.isEmpty) return 'KC 확인 전';
    if (raw.contains('KC_RECALL_NOTICE_CERT_CONFIRMED')) {
      return '리콜 공고 인증번호 확인';
    }
    if (raw.contains('KC_CERT_NUMBER_DETECTED') ||
        detectedCertNumber.isNotEmpty) {
      return 'KC 번호 인식';
    }
    if (raw.contains('미확인') ||
        raw.contains('조회 불가') ||
        raw.contains('불가') ||
        raw.contains('NOT') ||
        raw.contains('UNKNOWN') ||
        raw.contains('INVALID') ||
        raw.contains('FAILED') ||
        raw.contains('EXPIRED') ||
        raw.contains('부적합')) {
      return raw.contains('불가') ? 'KC 조회 불가' : 'KC 인증 미확인';
    }
    if (raw.contains('VALID') ||
        raw.contains('CERTIFIED') ||
        raw.contains('PASS') ||
        raw.contains('CONFIRMED') ||
        raw.contains('확인') ||
        raw.contains('적합') ||
        raw.contains('인증 확인')) {
      return 'KC 인증 확인';
    }
    return 'KC 인증 미확인';
  }

  Color _kcStatusColor(String status) {
    if (status == 'KC 인증 확인' ||
        status == '리콜 공고 인증번호 확인' ||
        status == 'KC 번호 인식') {
      return kPrimary;
    }
    if (status == 'KC 인증 미확인') return kDanger;
    return kTextMuted;
  }

  Widget _kcChip(Map<String, dynamic> product) {
    final status = _kcStatus(product);
    final color = _kcStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  Widget _kcInfoCard(Map<String, dynamic> product) {
    final status = _kcStatus(product);
    final color = _kcStatusColor(status);
    final certNum = '${product['kcCertNum'] ?? ''}'.trim();
    final certState = '${product['kcCertState'] ?? ''}'.trim();
    final certOrganName = '${product['kcCertOrganName'] ?? ''}'.trim();
    final certProductName = '${product['kcCertProductName'] ?? ''}'.trim();
    final certModelName = '${product['kcCertModelName'] ?? ''}'.trim();
    final certManufacturer = '${product['kcCertManufacturer'] ?? ''}'.trim();
    final details = [
      if (certNum.isNotEmpty) '인증번호: $certNum',
      if (certState.isNotEmpty) '인증상태: $certState',
      if (certOrganName.isNotEmpty) '인증기관: $certOrganName',
      if (certProductName.isNotEmpty) '인증제품: $certProductName',
      if (certModelName.isNotEmpty) '인증모델: $certModelName',
      if (certManufacturer.isNotEmpty) '제조사/사업자: $certManufacturer',
    ];
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.16)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.verified_outlined, color: color, size: 20),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'KC 안전인증: $status',
                  style: TextStyle(
                    color: color,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  details.isEmpty
                      ? 'KC 인증정보 API에서 일치하는 인증 정보를 찾지 못했습니다. 리콜 대상 여부는 제품안전정보센터 리콜 공고 기준으로 판단합니다.'
                      : details.join('\n'),
                  style: const TextStyle(
                    color: kTextMuted,
                    fontSize: 11,
                    height: 1.4,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  bool _hasRecallRequest(Map<String, dynamic> product) {
    return _findRecallRequest(product) != null;
  }

  int _unrequestedRecalledProductCount() {
    return _products.where((item) {
      if (item is! Map) return false;
      final product = Map<String, dynamic>.from(item);
      return _effectiveRecallStatus(product) == 'RECALLED' &&
          !_hasRecallRequest(product);
    }).length;
  }

  int _activeRecallRequestCount() {
    return _actions.where((item) {
      if (item is! Map) return false;
      final status = _effectiveActionStatus(Map<String, dynamic>.from(item));
      return status == 'PENDING' || status == 'IN_PROGRESS';
    }).length;
  }

  Map<String, dynamic>? _findRecallRequest(Map<String, dynamic> product) {
    final productId = '${product['id'] ?? ''}'.trim();
    final productName = '${product['productName'] ?? ''}'.trim();
    final modelNumber = '${product['modelNumber'] ?? ''}'.trim();

    for (final a in _actions) {
      if (a is! Map) continue;
      final action = Map<String, dynamic>.from(a);
      if ('${action['actionType'] ?? ''}' != 'RECALL') continue;

      final actionProductName = '${action['productName'] ?? ''}'.trim();
      final note = '${action['note'] ?? ''}';
      final actionProductId = _extractActionProductId(note);
      final actionModelNumber = _extractActionModelNumber(note);

      if (productId.isNotEmpty && actionProductId == productId) return action;
      if (modelNumber.isNotEmpty && actionModelNumber == modelNumber) {
        return action;
      }
      if (modelNumber.isEmpty &&
          actionModelNumber.isEmpty &&
          productName.isNotEmpty &&
          _sameRecallProductName(actionProductName, productName)) {
        return action;
      }
    }

    return null;
  }

  Future<void> _requestRecallAction(Map<String, dynamic> product) async {
    final productId = '${product['id'] ?? ''}';
    final productName = '${product['productName'] ?? '제품명 없음'}';
    final modelNumber = '${product['modelNumber'] ?? ''}';
    final reason = '${product['recallReason'] ?? ''}';
    if (_hasRecallRequest(product)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('이미 리콜 조치 요청 내역이 있는 제품입니다. 요청 내역을 확인해 주세요.')),
      );
      setState(() => _selectedTab = 1);
      return;
    }
    final defaultMemo = [
      '제가 가진 제품이 리콜 대상이라고 확인되었습니다.',
      if (modelNumber.isNotEmpty) '모델명: $modelNumber',
      '보호자나 복지사에게 전화 또는 방문 안내를 요청합니다.',
    ].join('\n');
    final memoCtrl = TextEditingController(text: defaultMemo);

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('리콜 조치 요청'),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '$productName 제품이 제품안전정보센터 리콜 대상으로 확인되었습니다.',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            const Text(
              '보호자와 복지사에게 이 제품의 리콜 조치가 필요하다고 알릴까요?',
              style: TextStyle(fontSize: 13, color: kTextMuted, height: 1.4),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: memoCtrl,
              minLines: 4,
              maxLines: 6,
              decoration: const InputDecoration(
                labelText: '요청 메모',
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: kDanger,
              foregroundColor: Colors.white,
            ),
            child: const Text('요청하기'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) {
        throw Exception('로그인 사용자 정보를 찾지 못했습니다.');
      }

      await ActionApi.createAction({
        'seniorId': seniorId,
        'actionType': 'RECALL',
        'actionSubject': 'SENIOR',
        'status': 'PENDING',
        'productName': productName,
        'note': [
          if (productId.isNotEmpty) '제품ID: $productId',
          if (modelNumber.isNotEmpty) '모델명: $modelNumber',
          memoCtrl.text.trim(),
          if (reason.isNotEmpty) '',
          if (reason.isNotEmpty) '제품안전정보센터 리콜 사유:',
          if (reason.isNotEmpty) reason,
        ].where((line) => line.isNotEmpty).join('\n'),
      });

      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('리콜 조치 요청이 등록되었습니다.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(_shortError(error))),
      );
    }
  }

  String _guessProductName(List<String> lines, String modelNumber) {
    final joined = lines.join(' ');
    if (RegExp(r'직류\s*전원\s*장치|전원\s*장치|어댑터|충전기').hasMatch(joined)) {
      return '직류전원장치';
    }
    if (RegExp(r'\bEP-[A-Z0-9-]+\b', caseSensitive: false)
        .hasMatch(modelNumber)) {
      return '직류전원장치';
    }
    for (final line in lines) {
      if (_isProductMetadataLine(line)) continue;
      final value = _stripKnownLabelPrefix(_cleanOcrValue(line));
      if (_isCertificationLine(value) ||
          _isLikelyLabelLine(value) ||
          _isElectricalSpecLine(value) ||
          _isBadProductNameValue(value)) {
        continue;
      }
      if (RegExp(r'가습기|충전기|전원\s*장치|배터리|선풍기|히터|난방|전기|조명|램프').hasMatch(value)) {
        return value;
      }
    }
    for (final line in lines) {
      if (_isProductMetadataLine(line)) continue;
      final value = _stripKnownLabelPrefix(_cleanOcrValue(line));
      final lower = value.toLowerCase();
      if (_isLikelyLabelLine(value)) continue;
      if (_isCertificationLine(value) ||
          _isElectricalSpecLine(value) ||
          lower.contains('model') ||
          lower.contains('s/n') ||
          lower.contains('mac')) {
        continue;
      }
      if (RegExp(r'[가-힣]').hasMatch(value) && value.length >= 3) {
        return value;
      }
    }
    return '';
  }

  String _guessModelNumber(List<String> lines) {
    final allText = lines.join(' ');
    final chargerModel =
        RegExp(r'\bEP\s*[- ]\s*[A-Z0-9]{2,}\b', caseSensitive: false)
            .firstMatch(allText)
            ?.group(0)
            ?.replaceAll(RegExp(r'\s+'), '')
            .toUpperCase();
    if (chargerModel != null && chargerModel.length >= 5) return chargerModel;

    final labelValue = _findValueByTextLabels(lines, ['모 델 명', '모델명', '모델번호']);
    if (labelValue.isNotEmpty && !_isBadModelNumberValue(labelValue)) {
      return labelValue.replaceAll(RegExp(r'\s+'), '').toUpperCase();
    }

    final preferredLines = [
      ...lines.where(
          (line) => RegExp(r'모델|model', caseSensitive: false).hasMatch(line)),
      ...lines.where(
          (line) => !RegExp(r'모델|model', caseSensitive: false).hasMatch(line)),
    ];

    final modelPattern = RegExp(
      r'\b([A-Z]{1,6}\d[A-Z0-9\-]{3,})\b',
      caseSensitive: false,
    );

    for (final line in preferredLines) {
      if (_isCertificationLine(line) ||
          _isElectricalSpecLine(line) ||
          _isProductMetadataLine(line) ||
          RegExp(r'mac|s/n', caseSensitive: false).hasMatch(line)) {
        continue;
      }
      final match = modelPattern.firstMatch(line.replaceAll(' ', ''));
      final value = match?.group(1)?.toUpperCase() ?? '';
      if (value.length >= 5 && !_isCertificationNumber(value)) return value;
    }
    return '';
  }

  String _findValueByTextLabels(List<String> lines, List<String> labels) {
    for (final line in lines) {
      for (final label in labels) {
        final value = _valueAfterLabel(line, label);
        if (value.isNotEmpty && _isUsefulOcrValue(value, label)) {
          return _stripKnownLabelPrefix(value);
        }
      }
    }
    return '';
  }

  bool _isCertificationLine(String line) {
    final compact = line.replaceAll(RegExp(r'\s+'), '').toUpperCase();
    return compact.contains('인증번호') ||
        compact.contains('인증/신고번호') ||
        compact.contains('인증신고번호') ||
        _isCertificationNumber(compact) ||
        RegExp(r'[XS]U\d{5,6}-?\d{5}').hasMatch(compact) ||
        RegExp(r'R-R-[A-Z0-9]{2,6}-[A-Z0-9-]{4,}').hasMatch(compact);
  }

  bool _isCertificationNumber(String value) {
    final compact = value.replaceAll(RegExp(r'\s+'), '').toUpperCase();
    return RegExp(r'^[XS]U\d{5,6}-?\d{5}$').hasMatch(compact) ||
        RegExp(r'^R-R-[A-Z0-9]{2,6}-[A-Z0-9-]{4,}$').hasMatch(compact);
  }

  bool _isBadModelNumberValue(String value) {
    final compact = value.replaceAll(RegExp(r'[\s,./]+'), '').toUpperCase();
    if (compact.isEmpty) return true;
    if (_isCertificationNumber(compact)) return true;
    if (_isElectricalSpecLine(value)) return true;
    if (RegExp(r'^(DC|AC)?\d+(\.\d+)?V\d+(\.\d+)?(MAH|AH|W|A)$')
        .hasMatch(compact)) {
      return true;
    }
    if (RegExp(r'^\d+(\.\d+)?V$').hasMatch(compact)) return true;
    if (RegExp(r'^\d+(\.\d+)?(MAH|AH|W|A)$').hasMatch(compact)) return true;
    return false;
  }

  bool _isBadProductNameValue(String value) {
    final compact = value.replaceAll(RegExp(r'\s+'), '').toUpperCase();
    if (compact.isEmpty) return true;
    if (_isProductMetadataLine(value)) return true;
    if (_isCertificationNumber(compact)) return true;
    if (_isBadModelNumberValue(compact)) return true;
    final hangulCount = RegExp(r'[가-힣]').allMatches(value).length;
    final looksLikeShortCode =
        compact.length <= 14 && RegExp(r'[A-Z]{2,}\d').hasMatch(compact);
    return looksLikeShortCode && hangulCount <= 1;
  }

  bool _isProductMetadataLine(String value) {
    final compact = value.replaceAll(RegExp(r'\s+'), '');
    return compact.startsWith('인증번호') ||
        compact.startsWith('인증신고번호') ||
        compact.startsWith('인증/신고번호') ||
        compact.startsWith('제조연월') ||
        compact.startsWith('제조국') ||
        compact.startsWith('수입원') ||
        compact.startsWith('공급원') ||
        compact.startsWith('판매원') ||
        compact.startsWith('고객센터') ||
        compact.startsWith('품질보증기간') ||
        compact.startsWith('제조번호');
  }

  bool _isElectricalSpecLine(String value) {
    final compact = value.replaceAll(RegExp(r'\s+'), '').toUpperCase();
    return RegExp(r'\d+(\.\d+)?V').hasMatch(compact) ||
        RegExp(r'\d+(\.\d+)?(MAH|AH|W|A)$').hasMatch(compact);
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
                subtitle:
                    const Text('QR/바코드는 제품안전정보센터 공고에 코드가 공개된 제품만 자동 매칭됩니다.'),
                onTap: () {
                  Navigator.pop(ctx);
                  _scanBarcode();
                },
              ),
              ListTile(
                leading: const Icon(Icons.document_scanner_outlined,
                    color: kPrimary),
                title: const Text('제품 라벨 OCR'),
                subtitle: const Text('사진에서 상품명·제조사·모델명을 읽습니다.'),
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
    if (status == 'REVIEW') return kWarning;
    if (status == 'SAFE') return kPrimary;
    return kTextMuted;
  }

  String _effectiveRecallStatus(Map<String, dynamic> product) {
    final status = '${product['recallStatus'] ?? ''}'.trim();
    final decisionStatus = '${product['recallDecisionStatus'] ?? ''}'.trim();
    final reason = '${product['recallReason'] ?? ''}'.trim();
    final matchedNotice = product['matchedRecallNotice'];
    final matchedNoticeId = '${product['matchedRecallNoticeId'] ?? ''}'.trim();

    if (decisionStatus == 'NO_MATCH_FOUND' ||
        status == 'SAFE' ||
        _isNoMatchRecallReason(reason)) {
      return 'SAFE';
    }
    if (status == 'RECALLED' ||
        decisionStatus == 'RECALL_CONFIRMED' ||
        decisionStatus == 'REVIEW_REQUIRED' ||
        reason.isNotEmpty ||
        matchedNotice != null ||
        matchedNoticeId.isNotEmpty) {
      return 'RECALLED';
    }
    return status.isEmpty ? 'UNKNOWN' : status;
  }

  bool _isNoMatchRecallReason(String reason) {
    if (reason.isEmpty) return false;
    return reason.contains('일치하는 항목을 찾지 못') ||
        reason.contains('리콜 공고에서 입력한 제품 식별정보와 일치') ||
        reason.contains('등록된 리콜 공고에서 입력한 제품 식별정보와 일치');
  }

  String _statusLabel(String? status) {
    if (status == 'RECALLED') return '리콜 대상';
    if (status == 'SAFE') return '리콜 미확인';
    if (status == 'REVIEW') return '추가 확인';
    return '확인중';
  }

  String _checkedAtLabel(dynamic value) {
    final checkedAt = DateTime.tryParse('${value ?? ''}');
    if (checkedAt == null) return '아직 조회 전';
    return DateFormat('yyyy.MM.dd HH:mm').format(checkedAt);
  }

  Future<void> _deleteProduct(Map<String, dynamic> product) async {
    final id = int.tryParse('${product['id'] ?? ''}');
    if (id == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('삭제할 제품 정보를 찾지 못했습니다.')),
      );
      return;
    }

    final yes = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('제품 삭제'),
        content: Text('${product['productName'] ?? '제품'} 을(를) 삭제하시겠습니까?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('취소'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('삭제'),
          ),
        ],
      ),
    );

    if (yes != true) return;

    await ProductApi.deleteProduct(id);
    await _load();

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('제품이 삭제되었습니다.')),
    );
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
                  _recallTabs(),
                  const SizedBox(height: 12),
                  if (_selectedTab == 1)
                    _actionRequestsCard()
                  else if (_loadError != null)
                    _loadErrorCard()
                  else if (_products.isEmpty)
                    _emptyProducts()
                  else
                    ..._products.map((p) {
                      final product = Map<String, dynamic>.from(p as Map);
                      final status = _effectiveRecallStatus(product);
                      final manufacturer = p['manufacturer'] as String?;
                      final hasRequest = _hasRecallRequest(product);
                      return Card(
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _showProductDetail(product),
                          onLongPress: () => _deleteProduct(product),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  status == 'RECALLED'
                                      ? Icons.warning_amber
                                      : Icons.inventory_2_outlined,
                                  color: _statusColor(status),
                                  size: 30,
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Expanded(
                                            child: Text(
                                              p['productName'] ?? '제품명 없음',
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 16,
                                                fontWeight: FontWeight.w800,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 10,
                                              vertical: 5,
                                            ),
                                            decoration: BoxDecoration(
                                              color: _statusColor(status)
                                                  .withOpacity(0.1),
                                              borderRadius:
                                                  BorderRadius.circular(20),
                                            ),
                                            child: Text(
                                              _statusLabel(status),
                                              style: TextStyle(
                                                color: _statusColor(status),
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        [
                                          if (manufacturer != null &&
                                              manufacturer.isNotEmpty)
                                            manufacturer,
                                          if ((p['modelNumber'] ?? '')
                                              .toString()
                                              .isNotEmpty)
                                            '모델명 ${p['modelNumber']}',
                                          if ((p['barcode'] ?? '')
                                              .toString()
                                              .isNotEmpty)
                                            '바코드 ${p['barcode']}',
                                        ].join(' · '),
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(fontSize: 12),
                                      ),
                                      const SizedBox(height: 6),
                                      _kcChip(product),
                                      const SizedBox(height: 4),
                                      Text(
                                        '마지막 조회: ${_checkedAtLabel(p['lastCheckedAt'])}',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: kTextMuted,
                                        ),
                                      ),
                                      if (status == 'RECALLED') ...[
                                        const SizedBox(height: 8),
                                        Container(
                                          width: double.infinity,
                                          padding: const EdgeInsets.all(10),
                                          decoration: BoxDecoration(
                                            color: kDanger.withOpacity(0.08),
                                            borderRadius:
                                                BorderRadius.circular(8),
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
                                        const SizedBox(height: 8),
                                        SizedBox(
                                          width: double.infinity,
                                          child: ElevatedButton.icon(
                                            onPressed: () =>
                                                _requestRecallAction(product),
                                            icon: Icon(hasRequest
                                                ? Icons.check_circle_outline
                                                : Icons.support_agent),
                                            label: Text(hasRequest
                                                ? '요청 내역 보기'
                                                : '리콜 조치 요청'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: hasRequest
                                                  ? kTextMuted
                                                  : kDanger,
                                              foregroundColor: Colors.white,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                ],
              ),
      ),
      floatingActionButton: _selectedTab == 1
          ? null
          : Column(
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
        .where((p) =>
            p is Map &&
            _effectiveRecallStatus(Map<String, dynamic>.from(p)) == 'RECALLED')
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
              '보유 제품을 바코드·OCR로 등록하면 제품안전정보센터 리콜 공고와 자동 비교합니다. 바코드 매칭은 공고에 바코드가 공개된 제품만 가능합니다.',
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

  Widget _recallTabs() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kBorder),
      ),
      child: Row(
        children: [
          _recallTabButton(0, '보유 제품', _products.length),
          _recallTabButton(1, '요청 내역', _actions.length),
        ],
      ),
    );
  }

  Widget _recallTabButton(int index, String label, int count) {
    final selected = _selectedTab == index;
    return Expanded(
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: () => setState(() => _selectedTab = index),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? kPrimary.withOpacity(0.12) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            '$label $count건',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: selected ? kPrimaryDark : kTextMuted,
              fontSize: 13,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
      ),
    );
  }

  Widget _actionRequestsCard() {
    final unrequestedCount = _unrequestedRecalledProductCount();
    final activeRequestCount = _activeRecallRequestCount();

    if (_actions.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(Icons.assignment_outlined, color: kTextMuted),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  unrequestedCount > 0
                      ? '리콜 대상 제품 중 아직 조치 요청을 보내지 않은 제품이 $unrequestedCount건 있습니다.'
                      : '아직 신청한 리콜 조치 요청이 없습니다.',
                  style: TextStyle(
                    fontSize: 13,
                    color: kTextMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.assignment_turned_in_outlined, color: kDanger),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    '내 리콜 조치 요청',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                ),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: kDanger.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '${_actions.length}건',
                    style: const TextStyle(
                      color: kDanger,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '미조치 $unrequestedCount건 · 요청/진행 중 $activeRequestCount건',
              style: const TextStyle(
                color: kTextMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            ..._actions.map((a) {
              final action = Map<String, dynamic>.from(a as Map);
              final productName = '${action['productName'] ?? '리콜 제품'}';
              final status = _effectiveActionStatus(action);
              final statusColor = _actionStatusColor(status);
              final noteRaw = '${action['note'] ?? ''}'.trim();
              final note = _requestMemoOnly(noteRaw)
                  .split(RegExp(r'\r?\n'))
                  .map((line) => line.trim())
                  .where((line) => line.isNotEmpty)
                  .take(2)
                  .join(' ');
              final modelNumber = _extractActionModelNumber(noteRaw);
              final scheduleLabel = _actionScheduleLabel(action);
              return InkWell(
                borderRadius: BorderRadius.circular(10),
                onTap: () => _showActionDetail(action),
                child: Container(
                  width: double.infinity,
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.07),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: statusColor.withOpacity(0.18)),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          status == 'IN_PROGRESS'
                              ? Icons.support_agent
                              : Icons.assignment_late_outlined,
                          color: statusColor,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    productName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: statusColor.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    _actionStatusLabel(status),
                                    style: TextStyle(
                                      color: statusColor,
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                if (modelNumber.isNotEmpty) '모델명 $modelNumber',
                                '요청일 ${_checkedAtLabel(action['createdAt'])}',
                                if (scheduleLabel.isNotEmpty) scheduleLabel,
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: kTextMuted,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            if (note.isNotEmpty) ...[
                              const SizedBox(height: 5),
                              Text(
                                note,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  height: 1.35,
                                  color: kTextMuted,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  String _actionStatusLabel(String status) {
    if (status == 'PENDING') return '요청 접수';
    if (status == 'IN_PROGRESS') return '조치 중';
    if (status == 'COMPLETED') return '조치 완료';
    if (status == 'CANCELLED') return '취소';
    return '상태 확인 중';
  }

  Color _actionStatusColor(String status) {
    if (status == 'IN_PROGRESS') return kPrimary;
    if (status == 'COMPLETED') return kTextMuted;
    if (status == 'CANCELLED') return kTextMuted;
    return kDanger;
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
            '상품명·제조사·모델명 또는 KC 번호를 등록하면 리콜 여부를 확인합니다. 바코드는 제품안전정보센터 공고에 공개된 경우에만 자동 매칭됩니다.',
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

  Widget _loadErrorCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.error_outline, color: kDanger),
                SizedBox(width: 8),
                Text(
                  '제품 목록을 불러오지 못했습니다.',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              _loadError ?? '잠시 후 다시 시도해 주세요.',
              style:
                  const TextStyle(color: kTextMuted, fontSize: 12, height: 1.4),
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: const Text('다시 불러오기'),
            ),
          ],
        ),
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

class _RecognizedInfoBox extends StatelessWidget {
  const _RecognizedInfoBox({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kPrimary.withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: kPrimary.withOpacity(0.24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: kTextMuted,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontSize: 15,
              color: kTextPrimary,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ExtractedProductInfo {
  const _ExtractedProductInfo({
    required this.productName,
    required this.manufacturer,
    required this.modelNumber,
    required this.certificationNumber,
  });

  final String productName;
  final String manufacturer;
  final String modelNumber;
  final String certificationNumber;
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
