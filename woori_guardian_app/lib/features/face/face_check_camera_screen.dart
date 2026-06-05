import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as img;

class FaceCheckCameraScreen extends StatefulWidget {
  const FaceCheckCameraScreen({super.key});

  @override
  State<FaceCheckCameraScreen> createState() => _FaceCheckCameraScreenState();
}

class FaceVerifyResult {
  final bool matched;
  final String message;
  final String? seniorName;

  const FaceVerifyResult({
    required this.matched,
    required this.message,
    this.seniorName,
  });
}

class _FaceCheckCameraScreenState extends State<FaceCheckCameraScreen> {
  CameraController? _controller;
  late final FaceDetector _faceDetector;

  bool _isInitializing = true;
  bool _isDetecting = false;
  bool _isUploading = false;
  String _guideText = '얼굴을 화면에 맞춰주세요.';
  DateTime? _lastAutoCaptureAt;
  XFile? _capturedImage;
  XFile? _matchedImage;

  static const _kGreen = Color(0xFF86A788);
  static const _pythonServerUrl = 'http://172.28.6.164:8000';

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

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();

      final backCamera = cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        backCamera,
        ResolutionPreset.medium,
        enableAudio: false,
        imageFormatGroup: ImageFormatGroup.nv21,
      );

      await controller.initialize();

      if (!mounted) return;

      setState(() {
        _controller = controller;
        _isInitializing = false;
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

  Future<void> _processCameraImage(CameraImage image) async {
    final controller = _controller;
    if (controller == null || _isDetecting || _isUploading) return;

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

      setState(() => _guideText = '${faces.length}명 감지됨');

      final now = DateTime.now();
      final canAutoCapture =
          _lastAutoCaptureAt == null ||
          now.difference(_lastAutoCaptureAt!).inSeconds >= 5;

      if (!canAutoCapture) return;

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

      _lastAutoCaptureAt = now;
      await _captureCropAndUpload();
    } catch (_) {
      // 프레임 분석 중 오류는 다음 프레임에서 다시 시도
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
      _guideText = '얼굴을 화면에 맞춰주세요.';
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
      _guideText = '얼굴을 찾는 중...';
    });

    try {
      final faceFiles = await _cropFacesFromImage(File(capturedImage.path))
          .timeout(
            const Duration(seconds: 8),
            onTimeout: () {
              throw TimeoutException('얼굴 감지 시간이 초과되었습니다.');
            },
          );

      if (faceFiles.isEmpty) {
        if (!mounted) return;
        setState(() => _guideText = '얼굴을 찾지 못했습니다. 다시 촬영해주세요.');
        return;
      }

      if (!mounted) return;
      setState(() => _guideText = '서버에서 얼굴을 확인하는 중...');

      final result = await _uploadFaceCrops(faceFiles).timeout(
        const Duration(seconds: 12),
        onTimeout: () {
          throw TimeoutException('서버 응답 시간이 초과되었습니다.');
        },
      );

      if (!mounted) return;

      setState(() => _guideText = result.message);
    } on TimeoutException catch (e) {
      if (!mounted) return;
      final message = e.message ?? '얼굴 확인 시간이 초과되었습니다.';
      setState(() => _guideText = message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _guideText = '얼굴 확인에 실패했습니다. 서버 상태를 확인해주세요.');
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  Future<void> _captureCropAndUpload() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;

    setState(() {
      _isUploading = true;
      _guideText = '얼굴 확인 중...';
    });

    try {
      await controller.stopImageStream();

      final picture = await controller.takePicture().timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          throw TimeoutException('자동 촬영 시간이 초과되었습니다.');
        },
      );

      setState(() => _guideText = '얼굴을 찾는 중...');

      final faceFiles = await _cropFacesFromImage(File(picture.path)).timeout(
        const Duration(seconds: 8),
        onTimeout: () {
          throw TimeoutException('얼굴 감지 시간이 초과되었습니다.');
        },
      );

      if (faceFiles.isEmpty) {
        setState(() => _guideText = '얼굴을 찾지 못했습니다. 다시 맞춰주세요.');
        await controller.startImageStream(_processCameraImage);
        return;
      }

      setState(() => _guideText = '서버에서 얼굴을 확인하는 중...');

      final result = await _uploadFaceCrops(faceFiles).timeout(
        const Duration(seconds: 12),
        onTimeout: () {
          throw TimeoutException('서버 응답 시간이 초과되었습니다.');
        },
      );

      if (!mounted) return;

      setState(() {
        _guideText = result.message;
      });

      await Future.delayed(const Duration(seconds: 2));
      if (mounted) {
        await controller.startImageStream(_processCameraImage);
      }
    } on TimeoutException catch (e) {
      if (!mounted) return;
      final message = e.message ?? '얼굴 확인 시간이 초과되었습니다.';
      setState(() => _guideText = message);

      try {
        await controller.startImageStream(_processCameraImage);
      } catch (_) {}
    } catch (_) {
      if (!mounted) return;
      setState(() => _guideText = '얼굴 확인에 실패했습니다. 서버 상태를 확인해주세요.');

      try {
        await controller.startImageStream(_processCameraImage);
      } catch (_) {}
    } finally {
      if (mounted) setState(() => _isUploading = false);
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

      request.fields['seniorId'] = '1';

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
        return const FaceVerifyResult(
          matched: false,
          message: '일치하는 얼굴이 없습니다.',
        );
      }

      if (seniorName != null && seniorName.isNotEmpty) {
        return FaceVerifyResult(
          matched: true,
          seniorName: seniorName,
          message: '$seniorName님 얼굴과 일치합니다.',
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

    return ClipRect(
      child: FittedBox(
        fit: BoxFit.cover,
        child: SizedBox(
          width: previewSize.height,
          height: previewSize.width,
          child: CameraPreview(controller),
        ),
      ),
    );
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
                            child: Image.file(
                              File(_capturedImage!.path),
                              fit: BoxFit.cover,
                            ),
                          )
                        else if (controller != null)
                          Positioned.fill(
                            child: _buildCameraPreview(controller),
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
                                child: Text(
                                  _guideText,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                  ),
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
                                              : _verifyCapturedImage,
                                          style: FilledButton.styleFrom(
                                            backgroundColor: _kGreen,
                                            foregroundColor: Colors.white,
                                            shape: RoundedRectangleBorder(
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                          ),
                                          child: Text(
                                            _isUploading ? '확인 중' : '확인하기',
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
