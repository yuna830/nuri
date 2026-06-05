import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

class FaceCheckCameraScreen extends StatefulWidget {
  const FaceCheckCameraScreen({super.key});

  @override
  State<FaceCheckCameraScreen> createState() => _FaceCheckCameraScreenState();
}

class _FaceCheckCameraScreenState extends State<FaceCheckCameraScreen> {
  CameraController? _controller;
  bool _isInitializing = true;
  bool _isTakingPicture = false;
  String? _errorMessage;

  static const _kGreen = Color(0xFF86A788);
  static const _kTextMain = Color(0xFF1C1C1E);
  static const _kTextSub = Color(0xFF6C6C70);

  @override
  void initState() {
    super.initState();
    _initCamera();
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();

      if (cameras.isEmpty) {
        setState(() {
          _errorMessage = '사용 가능한 카메라가 없습니다.';
          _isInitializing = false;
        });
        return;
      }

      final backCamera = cameras.firstWhere(
        (camera) => camera.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );

      final controller = CameraController(
        backCamera,
        ResolutionPreset.medium,
        enableAudio: false,
      );

      await controller.initialize();

      if (!mounted) return;

      setState(() {
        _controller = controller;
        _isInitializing = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorMessage = '카메라를 실행할 수 없습니다.';
        _isInitializing = false;
      });
    }
  }

  Future<void> _takePicture() async {
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) return;
    if (_isTakingPicture) return;

    setState(() => _isTakingPicture = true);

    try {
      final image = await controller.takePicture();

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('촬영 완료: ${image.path}')),
      );

      // 다음 단계:
      // 여기서 image.path 파일을 서버로 업로드하거나
      // 촬영 결과 확인 화면으로 넘기면 됩니다.
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('사진 촬영에 실패했습니다.')),
      );
    } finally {
      if (mounted) setState(() => _isTakingPicture = false);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Widget _buildCameraPreview(CameraController controller) {
    final previewSize = controller.value.previewSize;
    if (previewSize == null) return CameraPreview(controller);

    return LayoutBuilder(
      builder: (_, _) {
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
      },
    );
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
            : _errorMessage != null
                ? _ErrorView(message: _errorMessage!)
                : Column(
                    children: [
                      Expanded(child: _buildCameraPreview(controller!)),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                        color: Colors.white,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              '얼굴이 화면 중앙에 오도록 맞춰주세요.',
                              style: TextStyle(
                                fontSize: 14,
                                color: _kTextSub,
                              ),
                            ),
                            const SizedBox(height: 14),
                            SizedBox(
                              width: double.infinity,
                              height: 48,
                              child: FilledButton.icon(
                                onPressed:
                                    _isTakingPicture ? null : _takePicture,
                                style: FilledButton.styleFrom(
                                  backgroundColor: _kGreen,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                ),
                                icon: _isTakingPicture
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
                                  _isTakingPicture ? '촬영 중' : '촬영하기',
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
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

class _ErrorView extends StatelessWidget {
  final String message;

  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 15,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}
