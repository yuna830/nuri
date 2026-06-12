import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:characters/characters.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as img;

import '../../core/config/app_config.dart';
import '../../core/theme/app_colors.dart';
import '../report/report_screen.dart';

class FaceCheckCameraScreen extends StatefulWidget {
  const FaceCheckCameraScreen({super.key});

  @override
  State<FaceCheckCameraScreen> createState() => _FaceCheckCameraScreenState();
}

class _BouncingLoadingText extends StatefulWidget {
  final String text;
  final TextStyle style;

  const _BouncingLoadingText({required this.text, required this.style});

  @override
  State<_BouncingLoadingText> createState() => _BouncingLoadingTextState();
}

class _BouncingLoadingTextState extends State<_BouncingLoadingText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final characters = widget.text.characters.toList();

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Wrap(
          alignment: WrapAlignment.center,
          children: List.generate(characters.length, (index) {
            final phase = (_controller.value * 2 * math.pi) + (index * 0.45);
            final offsetY = math.sin(phase) * 3;

            return Transform.translate(
              offset: Offset(0, offsetY),
              child: Text(characters[index], style: widget.style),
            );
          }),
        );
      },
    );
  }
}

class FaceVerifyResult {
  final bool matched;
  final String message;
  final String? seniorName;

  // 발견 제보 전송에 필요한 정보 — 매치된 사용자 ID와 유사도
  final int? seniorId;
  final double? similarity;

  const FaceVerifyResult({
    required this.matched,
    required this.message,
    this.seniorName,
    this.seniorId,
    this.similarity,
  });
}

class _FaceCheckCameraScreenState extends State<FaceCheckCameraScreen> {
  List<CameraDescription> _cameras = [];
  CameraLensDirection _lensDirection = CameraLensDirection.back;
  CameraController? _controller;
  late final FaceDetector _faceDetector;

  bool _isInitializing = true;
  bool _isDetecting = false;
  bool _isUploading = false;
  String _guideText = '얼굴을 화면에 맞춰주세요.';
  DateTime? _lastAutoCaptureAt;
  XFile? _capturedImage;
  XFile? _matchedImage;
  bool _hasMatchedFace = false;
  bool _hasVerifyResult = false;
  FaceVerifyResult? _lastVerifyResult;

  double _minZoom = 1.0;
  double _maxZoom = 1.0;
  double _currentZoom = 1.0;
  double _zoomAtScaleStart = 1.0;

  bool get _isSelfieMode =>
      _controller?.description.lensDirection == CameraLensDirection.front;

  static const _kGreen = AppColors.green;
  static String get _pythonServerUrl => AppConfig.faceApiBaseUrl;

  @override
  void initState() {
    super.initState();

    _faceDetector = FaceDetector(
      options: FaceDetectorOptions(
        performanceMode: FaceDetectorMode.fast,
        enableLandmarks: true,
        enableContours: false,
        enableClassification: false,
        minFaceSize: 0.12,
      ),
    );

    _initCamera();
  }

  Future<void> _initCamera({CameraLensDirection? lensDirection}) async {
    try {
      setState(() => _isInitializing = true);

      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        throw Exception('사용 가능한 카메라가 없습니다.');
      }

      final targetLens = lensDirection ?? _lensDirection;
      final selectedCamera = _cameras.firstWhere(
        (camera) => camera.lensDirection == targetLens,
        orElse: () => _cameras.first,
      );

      final controller = CameraController(
        selectedCamera,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21,
      );

      await controller.initialize();

      final minZoom = await controller.getMinZoomLevel();
      final maxZoom = await controller.getMaxZoomLevel();

      if (!mounted) {
        await controller.dispose();
        return;
      }

      setState(() {
        _controller = controller;
        _lensDirection = selectedCamera.lensDirection;
        _isInitializing = false;
        _capturedImage = null;
        _matchedImage = null;
        _hasMatchedFace = false;
        _hasVerifyResult = false;
        _lastVerifyResult = null;
        _guideText = '얼굴을 화면에 맞춰주세요.';
        _minZoom = minZoom;
        _maxZoom = maxZoom;
        _currentZoom = minZoom; // 카메라 전환 시 줌 초기화
      });

      await controller.startImageStream(_processCameraImage);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _guideText = '카메라를 실행할 수 없습니다.';
        _isInitializing = false;
      });
    }
  }

  Future<void> _switchCamera() async {
    if (_isUploading || _isInitializing) return;

    final currentController = _controller;
    final nextLens = _lensDirection == CameraLensDirection.back
        ? CameraLensDirection.front
        : CameraLensDirection.back;

    try {
      if (currentController != null) {
        if (currentController.value.isStreamingImages) {
          await currentController.stopImageStream();
        }
        await currentController.dispose();
      }

      setState(() {
        _controller = null;
        _isDetecting = false;
        _capturedImage = null;
        _guideText = '카메라 전환 중...';
      });

      await _initCamera(lensDirection: nextLens);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _guideText = '카메라 전환에 실패했습니다.';
        _isInitializing = false;
      });
    }
  }

  Future<void> _setZoom(double zoom) async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    final clamped = zoom.clamp(_minZoom, _maxZoom);
    if ((clamped - _currentZoom).abs() < 0.01) return;

    setState(() => _currentZoom = clamped);
    await controller.setZoomLevel(clamped);
  }

  Future<void> _processCameraImage(CameraImage image) async {
    final controller = _controller;
    if (controller == null || _isDetecting || _hasMatchedFace) {
      return;
    }

    _isDetecting = true;

    try {
      final inputImage = _inputImageFromCameraImage(image);
      if (inputImage == null) return;

      final faces = await _faceDetector.processImage(inputImage);

      if (!mounted) return;

      if (faces.isEmpty) {
        setState(() => _guideText = '얼굴을 화면에 맞춰주세요.');
        return;
      }

      final hasGoodFace = faces.any((face) {
        final box = face.boundingBox;
        final faceArea = box.width * box.height;
        final imageArea = image.width * image.height;
        return faceArea / imageArea >= 0.08;
      });

      if (!hasGoodFace) {
        setState(() => _guideText = '조금 더 가까이 와주세요.');
        return;
      }

      setState(() => _guideText = '${faces.length}명 감지됨. 촬영해주세요.');
    } catch (_) {
      // 프레임 분석 중 오류가 나도 다음 프레임에서 다시 시도
    } finally {
      _isDetecting = false;
    }
  }

  InputImage? _inputImageFromCameraImage(CameraImage image) {
    final controller = _controller;
    if (controller == null) return null;

    final rotation = InputImageRotationValue.fromRawValue(
      controller.description.sensorOrientation,
    );
    if (rotation == null) return null;

    final format = InputImageFormatValue.fromRawValue(image.format.raw);
    if (format == null) return null;

    if (image.planes.isEmpty) return null;

    return InputImage.fromBytes(
      bytes: image.planes.first.bytes,
      metadata: InputImageMetadata(
        size: Size(image.width.toDouble(), image.height.toDouble()),
        rotation: rotation,
        format: format,
        bytesPerRow: image.planes.first.bytesPerRow,
      ),
    );
  }

  Future<void> _takePicture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      return;
    }
    if (_isUploading) return;

    setState(() {
      _isUploading = true;
      _guideText = '사진 촬영 중...';
    });

    try {
      if (controller.value.isStreamingImages) {
        await controller.stopImageStream().timeout(
          const Duration(seconds: 2),
          onTimeout: () {
            throw TimeoutException('카메라 스트림 중지 시간이 초과되었습니다.');
          },
        );
      }

      final image = await controller.takePicture().timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          throw TimeoutException('사진 촬영 시간이 초과되었습니다.');
        },
      );

      if (!mounted) return;

      setState(() {
        _capturedImage = image;
        _guideText = '사진이 촬영되었습니다.';
      });
    } on TimeoutException catch (e) {
      if (!mounted) return;
      setState(() => _guideText = e.message ?? '사진 촬영 시간이 초과되었습니다.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _guideText = '사진 촬영에 실패했습니다.');
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _retakePicture() async {
    final controller = _controller;
    if (controller == null) return;

    setState(() {
      _capturedImage = null;
      _matchedImage = null;
      _hasMatchedFace = false;
      _guideText = '얼굴을 화면에 맞춰주세요.';
      _hasVerifyResult = false;
      _lastVerifyResult = null;
    });

    if (controller.value.isInitialized && !controller.value.isStreamingImages) {
      await controller.startImageStream(_processCameraImage);
    }
  }

  Future<void> _verifyCapturedImage() async {
    final capturedImage = _capturedImage;

    if (capturedImage == null) {
      setState(() => _guideText = '확인할 사진이 없습니다.');
      return;
    }
    if (_isUploading) return;

    setState(() {
      _isUploading = true;
      _guideText = '얼굴 정보를 확인하는 중...';
    });

    try {
      final result = await _uploadFullImage(File(capturedImage.path)).timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw TimeoutException('얼굴 확인 응답 시간이 초과되었습니다.');
        },
      );

      if (!mounted) return;

      // 확인이 끝나면 신고하기로 전환 — 비매치인 사람은 신고 화면에서 '직접 입력'으로 이어진다.
      setState(() {
        _guideText = result.message;
        _hasVerifyResult = true;
        _lastVerifyResult = result;
      });
    } on TimeoutException catch (e) {
      if (!mounted) return;
      final message = e.message ?? '얼굴 확인 시간이 초과되었습니다.';
      setState(() => _guideText = message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _guideText = '얼굴 확인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  // ── 발견 제보 ─────────────────────────────────────────────────────────────
  // 이미 신고된 사용자과 일치/유사한 사람을 발견했을 때,
  // 새 신고를 만드는 대신 찍은 사진과 유사도를 보호자에게 알림으로 보낸다.
  Future<void> _sendDiscoveryReport() async {
    final result = _lastVerifyResult;
    final captured = _capturedImage;

    if (result == null || result.seniorId == null) {
      setState(() => _guideText = '제보 대상 정보가 없습니다. 다시 확인해주세요.');
      return;
    }
    if (_isUploading) return;

    setState(() {
      _isUploading = true;
      _guideText = '보호자에게 발견 제보를 보내는 중...';
    });

    try {
      // 찍은 사진을 업로드해 알림에 첨부
      String? imageUrl;
      if (captured != null) {
        final request = http.MultipartRequest(
          'POST',
          Uri.parse('${AppConfig.apiBaseUrl}/uploads/candidates'),
        );
        request.files.add(
          http.MultipartFile.fromBytes(
            'image',
            await _compressForUpload(captured.path),
            filename: 'discovery.jpg',
          ),
        );
        final uploadResponse = await request.send().timeout(
          const Duration(seconds: 15),
        );
        final uploadBody = await uploadResponse.stream.bytesToString();
        if (uploadResponse.statusCode == 200) {
          final uploadData = jsonDecode(uploadBody) as Map<String, dynamic>;
          imageUrl = uploadData['imageUrl']?.toString();
        }
      }

      final response = await http
          .post(
            Uri.parse('${AppConfig.apiBaseUrl}/alerts/camera'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'seniorId': result.seniorId,
              'type': 'AI_CANDIDATE_CONFIRM',
              if (imageUrl != null) 'imageUrl': imageUrl,
              if (result.similarity != null)
                'similarityScore': result.similarity,
              'candidateKind': 'FACE_MATCH',
            }),
          )
          .timeout(const Duration(seconds: 10));

      if (!mounted) return;

      if (response.statusCode == 200) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('보호자에게 발견 제보를 보냈습니다.')));
        Navigator.pop(context);
      } else {
        setState(
          () => _guideText = '발견 제보 전송에 실패했습니다. (${response.statusCode})',
        );
      }
    } on TimeoutException {
      if (!mounted) return;
      setState(() => _guideText = '발견 제보 전송 시간이 초과되었습니다.');
    } catch (_) {
      if (!mounted) return;
      setState(() => _guideText = '발견 제보 전송에 실패했습니다.');
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _goToReportScreen() async {
    final controller = _controller;

    try {
      if (controller != null &&
          controller.value.isInitialized &&
          controller.value.isStreamingImages) {
        await controller.stopImageStream();
      }
    } catch (_) {
      // 화면 전환 전 카메라 스트림 정리 실패는 신고 화면 진입을 막지 않습니다.
    }

    if (!mounted) return;

    final isMatched = _lastVerifyResult?.matched ?? false;
    final capturedPhotoPath = _capturedImage?.path;

    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(
            title: const Text('실종/위험 신고'),
            backgroundColor: AppColors.green,
            foregroundColor: Colors.white,
          ),
          // 등록 얼굴과 일치하지 않는 사람은 '직접 입력'으로 신고하고,
          // 방금 찍은 사진은 사진 첨부에 미리 넣어준다.
          body: ReportScreen(
            startInDirectInput: !isMatched,
            initialPhotoPath: capturedPhotoPath,
          ),
        ),
      ),
    );

    if (!mounted) return;

    try {
      if (controller != null &&
          controller.value.isInitialized &&
          !controller.value.isStreamingImages &&
          _capturedImage == null) {
        await controller.startImageStream(_processCameraImage);
      }
    } catch (_) {}
  }

  // 업로드용 압축 — 카메라 원본(수 MB)을 그대로 올리면 전송이 수 초 이상 걸린다.
  Future<List<int>> _compressForUpload(String path) async {
    final bytes = await File(path).readAsBytes();
    try {
      final decoded = img.decodeImage(bytes);
      if (decoded != null && decoded.width > 1280) {
        final resized = img.copyResize(decoded, width: 1280);
        return img.encodeJpg(resized, quality: 85);
      }
    } catch (_) {}
    return bytes;
  }

  Future<FaceVerifyResult> _uploadFullImage(File imageFile) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_pythonServerUrl/api/face/verify'),
      );

      request.files.add(
        http.MultipartFile.fromBytes(
          'faces',
          await _compressForUpload(imageFile.path),
          filename: 'face.jpg',
        ),
      );

      final response = await request.send().timeout(
        const Duration(seconds: 25),
        onTimeout: () {
          throw TimeoutException('얼굴 확인 연결 시간이 초과되었습니다.');
        },
      );

      final body = await response.stream.bytesToString().timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          throw TimeoutException('얼굴 확인 응답 시간이 초과되었습니다.');
        },
      );

      if (response.statusCode != 200) {
        return FaceVerifyResult(
          matched: false,
          message: '얼굴 확인에 실패했습니다. (${response.statusCode})',
        );
      }

      final data = jsonDecode(body) as Map<String, dynamic>;
      final status = data['status']?.toString() ?? 'NO_MATCH';
      final bestCandidate = data['bestCandidate'];

      final candidateName = bestCandidate is Map<String, dynamic>
          ? bestCandidate['seniorName']?.toString()
          : null;

      final name = data['seniorName']?.toString() ?? candidateName;
      final seniorId = (data['seniorId'] as num?)?.toInt();
      final similarity = data['bestSimilarity'];
      final similarityValue = similarity is num ? similarity.toDouble() : null;

      String formatSimilarity(dynamic value) {
        if (value is num) return value.toStringAsFixed(2);
        return value?.toString() ?? '-';
      }

      final scoreText = formatSimilarity(similarity);
      final displayName = name == null || name.isEmpty ? '등록된 실종자' : name;

      if (status == 'MATCH') {
        return FaceVerifyResult(
          matched: true,
          seniorName: name,
          seniorId: seniorId,
          similarity: similarityValue,
          message: '$displayName님과 일치 가능성이 높습니다. 유사도: $scoreText',
        );
      }

      // 유사 후보(CANDIDATE)도 보호자에게 발견 제보를 보낼 수 있게 허용
      if (status == 'CANDIDATE') {
        return FaceVerifyResult(
          matched: true,
          seniorName: name,
          seniorId: seniorId,
          similarity: similarityValue,
          message: '$displayName님과 비슷한 얼굴입니다. 직접 확인 후 제보해주세요. 유사도: $scoreText',
        );
      }

      return FaceVerifyResult(
        matched: false,
        message: '일치하는 실종자 얼굴이 없습니다. 유사도: $scoreText',
      );
    } on TimeoutException {
      rethrow;
    } catch (_) {
      return const FaceVerifyResult(
        matched: false,
        message: '얼굴 확인 서비스에 연결할 수 없습니다.',
      );
    }
  }

  Future<List<File>> _cropFacesFromImage(File imageFile) async {
    final inputImage = InputImage.fromFilePath(imageFile.path);
    final faces = await _faceDetector.processImage(inputImage);

    if (faces.isEmpty) return [];

    final bytes = await imageFile.readAsBytes();
    final decoded = img.decodeImage(bytes);
    if (decoded == null) return [];

    final cropFiles = <File>[];

    for (var i = 0; i < faces.length; i++) {
      final box = faces[i].boundingBox;

      final padding = 30;
      final left = math.max(0, box.left.toInt() - padding);
      final top = math.max(0, box.top.toInt() - padding);
      final right = math.min(decoded.width, box.right.toInt() + padding);
      final bottom = math.min(decoded.height, box.bottom.toInt() + padding);

      final width = right - left;
      final height = bottom - top;

      if (width <= 0 || height <= 0) continue;

      final cropped = img.copyCrop(
        decoded,
        x: left,
        y: top,
        width: width,
        height: height,
      );

      final cropPath = '${imageFile.path}_face_$i.jpg';
      final cropFile = File(cropPath);
      await cropFile.writeAsBytes(img.encodeJpg(cropped, quality: 90));
      cropFiles.add(cropFile);
    }

    return cropFiles;
  }

  Future<FaceVerifyResult> _uploadFaceCrops(List<File> faceFiles) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_pythonServerUrl/api/face/verify'),
      );

      for (final file in faceFiles) {
        request.files.add(
          await http.MultipartFile.fromPath('faces', file.path),
        );
      }

      final response = await request.send().timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          throw TimeoutException('Python 서버 연결 시간이 초과되었습니다.');
        },
      );

      final body = await response.stream.bytesToString().timeout(
        const Duration(seconds: 3),
        onTimeout: () {
          throw TimeoutException('서버 응답 읽기 시간이 초과되었습니다.');
        },
      );

      if (response.statusCode != 200) {
        return FaceVerifyResult(
          matched: false,
          message: '서버 확인에 실패했습니다. (${response.statusCode})',
        );
      }

      final data = jsonDecode(body) as Map<String, dynamic>;
      final matched = data['matched'] == true;
      final seniorName = data['seniorName']?.toString();

      if (!matched) {
        final similarity = data['bestSimilarity'];
        return FaceVerifyResult(
          matched: false,
          message: similarity == null
              ? (data['message']?.toString() ?? '일치하는 실종자 얼굴이 없습니다.')
              : '일치하는 실종자 얼굴이 없습니다. 유사도: $similarity',
        );
      }

      if (seniorName != null && seniorName.isNotEmpty) {
        return FaceVerifyResult(
          matched: true,
          seniorName: seniorName,
          message: '$seniorName님과 유사한 얼굴입니다.',
        );
      }

      return const FaceVerifyResult(matched: true, message: '등록된 얼굴과 일치합니다.');
    } on TimeoutException {
      rethrow;
    } catch (_) {
      return const FaceVerifyResult(
        matched: false,
        message: 'Python 서버에 연결할 수 없습니다.',
      );
    }
  }

  Widget _buildCameraPreview(CameraController controller) {
    final previewSize = controller.value.previewSize;
    if (previewSize == null) return CameraPreview(controller);

    final preview = ClipRect(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: previewSize.height,
          height: previewSize.width,
          child: CameraPreview(controller),
        ),
      ),
    );

    if (controller.description.lensDirection == CameraLensDirection.front) {
      return Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()..scale(-1.0, 1.0, 1.0),
        child: preview,
      );
    }

    return preview;
  }

  @override
  void dispose() {
    _controller?.dispose();
    _faceDetector.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('얼굴 확인'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: _isInitializing || _isUploading ? null : _switchCamera,
            icon: const Icon(Icons.flip_camera_ios_outlined),
            tooltip: _lensDirection == CameraLensDirection.front
                ? '후면 카메라'
                : '셀카 모드',
          ),
        ],
      ),
      body: SafeArea(
        child: _isInitializing
            ? const Center(
                child: CircularProgressIndicator(color: Colors.white),
              )
            : Column(
                children: [
                  Expanded(
                    child: Stack(
                      children: [
                        if (_capturedImage != null)
                          Positioned.fill(
                            child: Transform(
                              alignment: Alignment.center,
                              transform: Matrix4.identity()
                                ..scale(_isSelfieMode ? -1.0 : 1.0, 1.0, 1.0),
                              child: Image.file(
                                File(_capturedImage!.path),
                                fit: BoxFit.cover,
                              ),
                            ),
                          )
                        // 두 손가락으로 확대, 축소
                        // 두 손가락으로 확대, 축소
                        else if (controller != null)
                          Positioned.fill(
                            child: GestureDetector(
                              onScaleStart: (_) =>
                                  _zoomAtScaleStart = _currentZoom,
                              onScaleUpdate: (details) =>
                                  _setZoom(_zoomAtScaleStart * details.scale),
                              child: _buildCameraPreview(controller),
                            ),
                          ),

                        // ▼▼ 여기에 추가 — 현재 줌 배율 표시 ▼▼
                        if (_capturedImage == null &&
                            _currentZoom > _minZoom + 0.05)
                          Positioned(
                            top: 16,
                            right: 16,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.black.withValues(alpha: 0.45),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Text(
                                'x${_currentZoom.toStringAsFixed(1)}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ),
                        Positioned(
                          left: 20,
                          right: 20,
                          bottom: 24,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 12,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.black.withValues(alpha: 0.55),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: _isUploading
                                    ? _BouncingLoadingText(
                                        text: _guideText,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      )
                                    : Text(
                                        _guideText,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                        ),
                                        textAlign: TextAlign.center,
                                      ),
                              ),
                              const SizedBox(height: 12),
                              if (_capturedImage == null)
                                SizedBox(
                                  width: double.infinity,
                                  height: 48,
                                  child: FilledButton.icon(
                                    onPressed: _isUploading
                                        ? null
                                        : _takePicture,
                                    style: FilledButton.styleFrom(
                                      backgroundColor: _kGreen,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                    icon: _isUploading
                                        ? const SizedBox(
                                            width: 18,
                                            height: 18,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : const Icon(Icons.camera_alt_outlined),
                                    label: Text(
                                      _isUploading ? '촬영 중' : '촬영하기',
                                      style: const TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                )
                              else
                                Row(
                                  children: [
                                    Expanded(
                                      child: SizedBox(
                                        height: 48,
                                        child: OutlinedButton(
                                          onPressed: _isUploading
                                              ? null
                                              : _retakePicture,
                                          style: OutlinedButton.styleFrom(
                                            backgroundColor: Colors.white,
                                            foregroundColor: _kGreen,
                                            side: const BorderSide(
                                              color: Colors.white,
                                            ),
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                          ),
                                          child: const Text(
                                            '다시 촬영',
                                            style: TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: SizedBox(
                                        height: 48,
                                        child: FilledButton(
                                          onPressed: _isUploading
                                              ? null
                                              : !_hasVerifyResult
                                              ? _verifyCapturedImage
                                              : (_lastVerifyResult?.matched ??
                                                    false)
                                              ? _sendDiscoveryReport
                                              : _goToReportScreen,
                                          style: FilledButton.styleFrom(
                                            backgroundColor: _hasVerifyResult
                                                ? AppColors.red
                                                : _kGreen,
                                            foregroundColor: Colors.white,
                                            disabledBackgroundColor:
                                                _hasVerifyResult
                                                ? AppColors.red
                                                : _kGreen,
                                            disabledForegroundColor:
                                                Colors.white,
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                          ),
                                          child: Text(
                                            _isUploading
                                                ? '확인 중'
                                                : !_hasVerifyResult
                                                ? '확인하기'
                                                : (_lastVerifyResult?.matched ??
                                                      false)
                                                ? '발견 제보하기'
                                                : '신고하기',
                                            style: const TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}
