import 'package:flutter/material.dart';
import '../../core/api/guardian_api.dart';
import '../../core/models/senior.dart';
import '../../core/storage/guardian_session_storage.dart';

const _kGreen = Color(0xFF86A788);
const _kBg = Colors.white;
const _kDivider = Color(0xFFE5E5EA);

class SeniorListScreen extends StatefulWidget {
  const SeniorListScreen({super.key});

  @override
  State<SeniorListScreen> createState() => _SeniorListScreenState();
}

class _SeniorListScreenState extends State<SeniorListScreen> {
  final _api = GuardianApi();
  final _storage = GuardianSessionStorage();

  bool _loading = true;
  List<Senior> _seniors = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final info = await _storage.getGuardianInfo();
      final idStr = info['guardianId'];
      if (idStr == null || idStr.isEmpty) throw Exception('세션 정보가 없습니다.');
      final seniors = await _api.fetchGuardianSeniors(int.parse(idStr));
      if (mounted) setState(() { _seniors = seniors; _loading = false; });
    } catch (e) {
      if (mounted) setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        title: const Text('보호 대상자 목록'),
        backgroundColor: _kGreen,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: _kGreen))
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: Colors.grey)),
                      const SizedBox(height: 12),
                      FilledButton(
                          onPressed: _load,
                          style: FilledButton.styleFrom(backgroundColor: _kGreen),
                          child: const Text('다시 시도')),
                    ],
                  ),
                )
              : _seniors.isEmpty
                  ? const Center(
                      child: Text('등록된 보호 대상자가 없습니다.',
                          style: TextStyle(color: Colors.grey)),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: _kGreen,
                      child: ListView.separated(
                        padding: const EdgeInsets.symmetric(
                            vertical: 16, horizontal: 16),
                        itemCount: _seniors.length,
                        separatorBuilder: (_, __) =>
                            const SizedBox(height: 12),
                        itemBuilder: (_, i) => _SeniorTile(_seniors[i]),
                      ),
                    ),
    );
  }
}

class _SeniorTile extends StatelessWidget {
  final Senior senior;
  const _SeniorTile(this.senior);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _kDivider),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFFEBF8EE),
            child: Text(
              senior.name.isNotEmpty ? senior.name[0] : '?',
              style: const TextStyle(
                  color: _kGreen,
                  fontSize: 16,
                  fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(senior.name,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600)),
                    if (senior.age != null) ...[
                      const SizedBox(width: 6),
                      Text('${senior.age}세',
                          style: const TextStyle(
                              fontSize: 13, color: Colors.grey)),
                    ],
                  ],
                ),
                if (senior.phone.isNotEmpty)
                  Text(senior.phone,
                      style: const TextStyle(
                          fontSize: 13, color: Colors.grey)),
              ],
            ),
          ),
          _StatusDot(senior.status),
        ],
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final String status;
  const _StatusDot(this.status);

  @override
  Widget build(BuildContext context) {
    final isSafe = status == '안전';
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 8, height: 8,
          decoration: BoxDecoration(
            color: isSafe ? const Color(0xFF4A7A4C) : const Color(0xFFFF9500),
            shape: BoxShape.circle,
          ),
        ),
        const SizedBox(width: 4),
        Text(status,
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isSafe
                    ? const Color(0xFF4A7A4C)
                    : const Color(0xFFFF9500))),
      ],
    );
  }
}
