import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../api/product_api.dart';
import '../constants.dart';
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
      final data = await ProductApi.getProductsBySenior(kSeniorId);
      setState(() { _products = data; _loading = false; });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Future<void> _registerByInput() async {
    final nameCtrl = TextEditingController();
    final modelCtrl = TextEditingController();
    await showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('제품 등록'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(labelText: '제품명'),
            ),
            TextField(
              controller: modelCtrl,
              decoration: const InputDecoration(labelText: '모델번호'),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('취소')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty) return;
              await ProductApi.registerProduct({
                'seniorId': kSeniorId,
                'productName': nameCtrl.text,
                'modelNumber': modelCtrl.text,
              });
              if (ctx.mounted) Navigator.pop(ctx);
              await _load();
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
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('이미지에서 제품 정보를 추출하는 기능은 예린 팀원이 구현 예정입니다.'),
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('리콜 제품 확인'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () async {
              await ProductApi.refreshProducts();
              await _load();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _products.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.inventory_2_outlined,
                            size: 64, color: kTextMuted),
                        const SizedBox(height: 16),
                        const Text('등록된 제품이 없습니다.',
                            style: TextStyle(color: kTextMuted)),
                        const SizedBox(height: 24),
                        ElevatedButton.icon(
                          onPressed: _registerByInput,
                          icon: const Icon(Icons.add),
                          label: const Text('제품 등록'),
                        ),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _products.length,
                    itemBuilder: (_, i) {
                      final p = _products[i];
                      final status = p['recallStatus'] as String?;
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
                          subtitle: Text(
                            p['modelNumber'] ?? '',
                            style: const TextStyle(fontSize: 12),
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
                    },
                  ),
      ),
      floatingActionButton: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          FloatingActionButton.small(
            heroTag: 'cam',
            onPressed: _pickAndRegister,
            backgroundColor: Colors.white,
            foregroundColor: kPrimary,
            child: const Icon(Icons.photo_library_outlined),
          ),
          const SizedBox(height: 8),
          FloatingActionButton(
            heroTag: 'add',
            onPressed: _registerByInput,
            backgroundColor: kPrimary,
            child: const Icon(Icons.add, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
