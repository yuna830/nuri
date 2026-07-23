import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/senior_api.dart';
import '../services/auth_service.dart';
import '../theme.dart';

class EnergyVoucherScreen extends StatefulWidget {
  const EnergyVoucherScreen({super.key});

  @override
  State<EnergyVoucherScreen> createState() => _EnergyVoucherScreenState();
}

class _EnergyVoucherScreenState extends State<EnergyVoucherScreen> {
  static const _storage = FlutterSecureStorage();

  Map<String, dynamic>? _senior;
  Map<String, dynamic> _info = {};
  bool _loading = true;
  bool _saving = false;
  int? _seniorId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final seniorId = await AuthService.getUserId();
      if (seniorId == null) return;
      final data = await SeniorApi.getSenior(seniorId);
      final saved = await _storage.read(key: _storageKey(seniorId));
      final localInfo = saved == null
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(jsonDecode(saved) as Map);
      if (!mounted) return;
      setState(() {
        _seniorId = seniorId;
        _senior = data;
        _info = _mergedInfo(data, localInfo);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('에너지 정보를 불러오지 못했습니다.')),
      );
    }
  }

  String _storageKey(int seniorId) => 'energy_support_info_$seniorId';

  Map<String, dynamic> _mergedInfo(
    Map<String, dynamic> senior,
    Map<String, dynamic> local,
  ) {
    return {
      'livelihoodBenefit': senior['livelihoodBenefit'],
      'medicalBenefit': senior['medicalBenefit'],
      'housingBenefit': senior['housingBenefit'],
      'educationBenefit': senior['educationBenefit'],
      'disabilityGrade': senior['disabilityGrade'],
      'livingAlone': senior['livingAlone'],
      'housingType': senior['housingType'],
      'birthDate': senior['birthDate'],
      'address': senior['address'],
      'detailAddress': senior['detailAddress'],
      'energyVoucherApplied': senior['energyVoucherApplied'],
      'electricityDiscountApplied': senior['electricityDiscountApplied'],
      'gasDiscountApplied': senior['gasDiscountApplied'],
      'elderlyHouseholdMember': senior['elderlyHouseholdMember'],
      'infantHouseholdMember': senior['infantHouseholdMember'],
      'disabledHouseholdMember': senior['disabledHouseholdMember'],
      'pregnantHouseholdMember': senior['pregnantHouseholdMember'],
      'severeDiseaseHouseholdMember': senior['severeDiseaseHouseholdMember'],
      'rareDiseaseHouseholdMember': senior['rareDiseaseHouseholdMember'],
      'intractableDiseaseHouseholdMember':
          senior['intractableDiseaseHouseholdMember'],
      'singleParentFamily': senior['singleParentFamily'],
      'childHeadedHousehold': senior['childHeadedHousehold'],
      'multiChildHousehold': senior['multiChildHousehold'],
      'allMembersInFacility': senior['allMembersInFacility'],
      'winterFuelSupport': senior['winterFuelSupport'],
      'coalCoupon': senior['coalCoupon'],
      'coalEnergyVoucher': senior['coalEnergyVoucher'],
      ...local,
    };
  }

  Future<void> _save(Map<String, dynamic> nextInfo) async {
    final seniorId = _seniorId ?? await AuthService.getUserId();
    if (seniorId == null || _saving) return;
    setState(() => _saving = true);

    final serverBody = <String, dynamic>{
      for (final key in _serverBackedKeys)
        if (nextInfo.containsKey(key)) key: nextInfo[key],
    };

    try {
      await _storage.write(
        key: _storageKey(seniorId),
        value: jsonEncode(nextInfo),
      );
      final updated = serverBody.isEmpty
          ? _senior
          : await SeniorApi.updateSenior(seniorId, serverBody);
      if (!mounted) return;
      setState(() {
        _senior = updated ?? _senior;
        _info = nextInfo;
        _saving = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('입력 정보를 저장했습니다. 남은 항목은 보호자나 복지사에게 확인을 요청하세요.'),
          backgroundColor: kPrimary,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')),
      );
    }
  }

  static const _serverBackedKeys = {
    'livelihoodBenefit',
    'medicalBenefit',
    'housingBenefit',
    'educationBenefit',
    'livingAlone',
    'housingType',
    'disabilityGrade',
    'energyVoucherApplied',
    'electricityDiscountApplied',
    'gasDiscountApplied',
    'elderlyHouseholdMember',
    'infantHouseholdMember',
    'disabledHouseholdMember',
    'pregnantHouseholdMember',
    'severeDiseaseHouseholdMember',
    'rareDiseaseHouseholdMember',
    'intractableDiseaseHouseholdMember',
    'singleParentFamily',
    'childHeadedHousehold',
    'multiChildHousehold',
    'allMembersInFacility',
    'winterFuelSupport',
    'coalCoupon',
    'coalEnergyVoucher',
  };

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: kBg,
        appBar: AppBar(
          title: const Text('에너지 복지'),
          bottom: const TabBar(
            tabs: [
              Tab(text: '내 정보'),
              Tab(text: '신청 현황'),
            ],
          ),
        ),
        body: RefreshIndicator(
          onRefresh: _load,
          child: TabBarView(
            children: [
              _MyInfoTab(
                info: _info,
                saving: _saving,
                onEdit: _openEditor,
              ),
              _StatusTab(
                info: _info,
                onEdit: _openEditor,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openEditor(_Benefit benefit) async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (context) => _BenefitEditor(
        benefit: benefit,
        initialInfo: _info,
      ),
    );
    if (result != null) await _save(result);
  }
}

class _MyInfoTab extends StatelessWidget {
  const _MyInfoTab({
    required this.info,
    required this.saving,
    required this.onEdit,
  });

  final Map<String, dynamic> info;
  final bool saving;
  final ValueChanged<_Benefit> onEdit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        _GuideCard(info: info),
        const SizedBox(height: 14),
        ..._benefits.map(
          (benefit) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _InputCard(
              benefit: benefit,
              info: info,
              saving: saving,
              onEdit: () => onEdit(benefit),
            ),
          ),
        ),
      ],
    );
  }
}

class _StatusTab extends StatelessWidget {
  const _StatusTab({
    required this.info,
    required this.onEdit,
  });

  final Map<String, dynamic> info;
  final ValueChanged<_Benefit> onEdit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        ..._benefits.map(
          (benefit) {
            final status = _evaluateBenefit(benefit, info);
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _StatusCard(
                benefit: benefit,
                status: status,
                onEdit: () => onEdit(benefit),
              ),
            );
          },
        ),
        const SizedBox(height: 4),
        const _NoticeCard(),
      ],
    );
  }
}

class _GuideCard extends StatelessWidget {
  const _GuideCard({required this.info});

  final Map<String, dynamic> info;

  @override
  Widget build(BuildContext context) {
    final completed = _benefits
        .map((benefit) => _completedCount(benefit.fields, info))
        .fold<int>(0, (a, b) => a + b);
    final total = _benefits
        .map((benefit) => benefit.fields.length)
        .fold<int>(0, (a, b) => a + b);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: kPrimary.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.fact_check_outlined, color: kPrimary),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    '혜택별 필요한 정보만 먼저 채워 주세요',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const Text(
              '수급 자격과 실제 신청 여부는 따로 확인합니다. 모르는 항목은 비워두면 신청 현황에서 확인이 필요한 항목으로 남습니다.',
              style: TextStyle(
                color: kTextMuted,
                height: 1.45,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 14),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                minHeight: 8,
                value: total == 0 ? 0 : completed / total,
                backgroundColor: kBorder,
                valueColor: const AlwaysStoppedAnimation(kPrimary),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              '입력된 항목 $completed/$total',
              style: const TextStyle(
                color: kTextMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InputCard extends StatelessWidget {
  const _InputCard({
    required this.benefit,
    required this.info,
    required this.saving,
    required this.onEdit,
  });

  final _Benefit benefit;
  final Map<String, dynamic> info;
  final bool saving;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final completed = _completedCount(benefit.fields, info);
    final total = benefit.fields.length;
    final missing = benefit.fields
        .where((field) => !_hasValue(info[field.key]))
        .map((field) => field.label)
        .take(3)
        .join(', ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(benefit.icon, color: benefit.color),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    benefit.title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                _CountBadge(done: completed, total: total),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              benefit.description,
              style: const TextStyle(
                color: kTextMuted,
                height: 1.35,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              missing.isEmpty ? '필요 항목이 모두 입력되었습니다.' : '남은 항목: $missing',
              style: TextStyle(
                color: missing.isEmpty ? kPrimaryDark : kTextMuted,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: saving ? null : onEdit,
                icon: const Icon(Icons.edit_note),
                label: Text(completed == 0 ? '정보 입력하기' : '입력 정보 수정'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.benefit,
    required this.status,
    required this.onEdit,
  });

  final _Benefit benefit;
  final _BenefitStatus status;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(benefit.icon, color: status.color),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        benefit.title,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        status.title,
                        style: TextStyle(
                          color: status.color,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: const Text('수정'),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              status.message,
              style: const TextStyle(
                color: kTextMuted,
                height: 1.45,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (status.missing.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: status.missing
                    .map((label) => _MissingChip(label: label))
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _NoticeCard extends StatelessWidget {
  const _NoticeCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: kBorder),
      ),
      child: const Text(
        '신청 현황은 자동 확정이 아니라 준비 상태입니다. 고객번호, 계약 명의, 최근 고지서처럼 확인이 필요한 항목은 보호자 또는 담당 복지사가 최종 확인해야 합니다.',
        style: TextStyle(
          color: kTextMuted,
          height: 1.45,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _BenefitEditor extends StatefulWidget {
  const _BenefitEditor({
    required this.benefit,
    required this.initialInfo,
  });

  final _Benefit benefit;
  final Map<String, dynamic> initialInfo;

  @override
  State<_BenefitEditor> createState() => _BenefitEditorState();
}

class _BenefitEditorState extends State<_BenefitEditor> {
  late Map<String, dynamic> _draft;
  final Map<String, TextEditingController> _controllers = {};

  @override
  void initState() {
    super.initState();
    _draft = Map<String, dynamic>.from(widget.initialInfo);
    _draft['householdBirthDates'] =
        _birthDateList(_draft['householdBirthDates']);
    for (final field in widget.benefit.fields.where((f) => f.type == _FieldType.text)) {
      _controllers[field.key] = TextEditingController(
        text: '${_draft[field.key] ?? ''}',
      );
    }
    _syncHouseholdBirthDateControllers();
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FractionallySizedBox(
      heightFactor: 0.9,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 10,
            bottom: MediaQuery.of(context).viewInsets.bottom + 16,
          ),
          child: ListView(
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: kBorder,
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
              ),
              Row(
                children: [
                  Icon(widget.benefit.icon, color: widget.benefit.color),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.benefit.title,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: '닫기',
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                widget.benefit.helper,
                style: const TextStyle(
                  color: kTextMuted,
                  height: 1.45,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 14),
              ...widget.benefit.fields.map(_field),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () {
                  for (final entry in _controllers.entries) {
                    if (entry.key.startsWith('householdBirthDate_')) continue;
                    _draft[entry.key] = entry.value.text.trim();
                  }
                  _draft['householdBirthDates'] = _householdBirthDates();
                  Navigator.pop(context, _draft);
                },
                icon: const Icon(Icons.save_outlined),
                label: const Text('저장'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field(_InputField field) {
    switch (field.type) {
      case _FieldType.toggle:
        return SwitchListTile(
          contentPadding: EdgeInsets.zero,
          value: _draft[field.key] == true,
          onChanged: (value) => setState(() => _draft[field.key] = value),
          title: Text(field.label),
          subtitle: field.hint == null ? null : Text(field.hint!),
        );
      case _FieldType.text:
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: TextField(
            controller: _controllers[field.key],
            keyboardType: field.keyboardType,
            onChanged: field.key == 'householdCount'
                ? (value) => setState(() {
                      _draft[field.key] = value.trim();
                      _syncHouseholdBirthDateControllers();
                    })
                : null,
            decoration: InputDecoration(
              labelText: field.label,
              helperText: field.hint,
              filled: true,
              fillColor: kBg,
            ),
          ),
        );
      case _FieldType.householdBirthDates:
        return _householdBirthDateFields(field);
      case _FieldType.choice:
        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: DropdownButtonFormField<String>(
            value: _stringValue(_draft[field.key]).isEmpty
                ? null
                : _stringValue(_draft[field.key]),
            items: field.options
                .map(
                  (option) => DropdownMenuItem(
                    value: option,
                    child: Text(option),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => _draft[field.key] = value),
            decoration: InputDecoration(
              labelText: field.label,
              helperText: field.hint,
              filled: true,
              fillColor: kBg,
            ),
          ),
        );
    }
  }

  Widget _householdBirthDateFields(_InputField field) {
    final count = _householdCount();
    _syncHouseholdBirthDateControllers();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            field.label,
            style: const TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          Text(
            count == 0
                ? '먼저 주민등록상 세대원 수를 입력하면 생년월일 칸이 생깁니다.'
                : '세대원 $count명의 생년월일을 한 명씩 입력해 주세요.',
            style: const TextStyle(
              color: kTextMuted,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ...List.generate(count, (index) {
            final key = 'householdBirthDate_$index';
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: TextField(
                controller: _controllers[key],
                keyboardType: TextInputType.datetime,
                decoration: InputDecoration(
                  labelText: '${index + 1}번째 세대원 생년월일',
                  hintText: '예: 1945.03.01',
                  filled: true,
                  fillColor: kBg,
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  int _householdCount() {
    final raw = _controllers['householdCount']?.text ?? '${_draft['householdCount'] ?? ''}';
    final count = int.tryParse(raw.trim()) ?? 0;
    return count.clamp(0, 10).toInt();
  }

  void _syncHouseholdBirthDateControllers() {
    final dates = _birthDateList(_draft['householdBirthDates']);
    final count = _householdCount();
    for (var i = 0; i < count; i += 1) {
      final key = 'householdBirthDate_$i';
      _controllers.putIfAbsent(
        key,
        () => TextEditingController(text: i < dates.length ? dates[i] : ''),
      );
    }
  }

  List<String> _householdBirthDates() {
    return List.generate(_householdCount(), (index) {
      return _controllers['householdBirthDate_$index']?.text.trim() ?? '';
    });
  }
}

class _CountBadge extends StatelessWidget {
  const _CountBadge({required this.done, required this.total});

  final int done;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: done == total ? kPrimary.withOpacity(0.1) : kWarning.withOpacity(0.12),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        '$done/$total',
        style: TextStyle(
          color: done == total ? kPrimaryDark : kWarning,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _MissingChip extends StatelessWidget {
  const _MissingChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        color: kWarning.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: kWarning,
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _BenefitStatus {
  const _BenefitStatus({
    required this.title,
    required this.message,
    required this.color,
    required this.missing,
  });

  final String title;
  final String message;
  final Color color;
  final List<String> missing;
}

class _Benefit {
  const _Benefit({
    required this.id,
    required this.title,
    required this.description,
    required this.helper,
    required this.icon,
    required this.color,
    required this.fields,
  });

  final String id;
  final String title;
  final String description;
  final String helper;
  final IconData icon;
  final Color color;
  final List<_InputField> fields;
}

class _InputField {
  const _InputField.toggle(this.key, this.label, {this.hint})
      : type = _FieldType.toggle,
        options = const [],
        keyboardType = null;

  const _InputField.text(this.key, this.label, {this.hint, this.keyboardType})
      : type = _FieldType.text,
        options = const [];

  const _InputField.choice(
    this.key,
    this.label,
    this.options, {
    this.hint,
  })  : type = _FieldType.choice,
        keyboardType = null;

  const _InputField.householdBirthDates(this.key, this.label, {this.hint})
      : type = _FieldType.householdBirthDates,
        options = const [],
        keyboardType = null;

  final String key;
  final String label;
  final String? hint;
  final _FieldType type;
  final List<String> options;
  final TextInputType? keyboardType;
}

enum _FieldType { toggle, text, choice, householdBirthDates }

const _benefits = [
  _Benefit(
    id: 'voucher',
    title: '에너지바우처',
    description: '소득 기준과 세대원 특성 기준을 나눠 확인합니다.',
    helper: '모르는 항목은 비워두세요. 세대원 생년월일, 난방 방식, 최근 고지서가 있으면 확인이 빨라집니다.',
    icon: Icons.card_giftcard,
    color: kWarning,
    fields: [
      _InputField.toggle('livelihoodBenefit', '생계급여 수급'),
      _InputField.toggle('medicalBenefit', '의료급여 수급'),
      _InputField.toggle('housingBenefit', '주거급여 수급'),
      _InputField.toggle('educationBenefit', '교육급여 수급'),
      _InputField.text('householdCount', '주민등록상 세대원 수', keyboardType: TextInputType.number),
      _InputField.householdBirthDates('householdBirthDates', '세대원 생년월일'),
      _InputField.toggle('elderlyHouseholdMember', '노인 세대원 있음'),
      _InputField.toggle('infantHouseholdMember', '영유아 세대원 있음'),
      _InputField.toggle('disabledHouseholdMember', '등록 장애인 있음'),
      _InputField.toggle('pregnantHouseholdMember', '임신·출산 해당'),
      _InputField.toggle('severeDiseaseHouseholdMember', '중증질환자 있음'),
      _InputField.toggle('rareDiseaseHouseholdMember', '희귀질환자 있음'),
      _InputField.toggle('intractableDiseaseHouseholdMember', '중증난치질환자 있음'),
      _InputField.toggle('singleParentFamily', '한부모가족'),
      _InputField.toggle('childHeadedHousehold', '소년소녀가정·가정위탁보호 아동'),
      _InputField.toggle('multiChildHousehold', '다자녀세대'),
      _InputField.toggle('allMembersInFacility', '시설 입소 세대'),
      _InputField.choice(
        'mainHeatingSource',
        '주 난방 에너지원',
        ['전기', '도시가스', '지역난방', '등유', 'LPG', '연탄', '기타'],
      ),
      _InputField.choice('voucherUseMethod', '동절기 사용 방식', ['요금차감', '국민행복카드', '미정']),
      _InputField.text('voucherElectricCustomerNo', '전기 고객번호'),
      _InputField.text('voucherGasCustomerNo', '도시가스 고객번호'),
      _InputField.text('energySupplier', '에너지 공급회사'),
      _InputField.toggle('recentBillReady', '최근 요금고지서 확인'),
      _InputField.toggle('happyCardOwned', '국민행복카드 보유'),
      _InputField.toggle('winterFuelSupport', '긴급복지 동절기 연료비 수급'),
      _InputField.toggle('coalCoupon', '연탄쿠폰 수급'),
      _InputField.toggle('coalEnergyVoucher', '연탄전환 에너지바우처 수급'),
      _InputField.choice(
        'energyVoucherApplicationStatus',
        '현재 신청 여부',
        ['모름', '미신청', '신청 중', '선정 완료', '사용 중', '대상 아님'],
      ),
    ],
  ),
  _Benefit(
    id: 'electricity',
    title: '전기요금 복지할인',
    description: '한전 고객번호와 계약자 명의 확인이 핵심입니다.',
    helper: '계약 명의가 본인이 아니거나 아파트 관리비에 전기요금이 포함되면 추가 확인이 필요합니다.',
    icon: Icons.bolt,
    color: kPrimary,
    fields: [
      _InputField.text('electricCustomerNo', '한전 고객번호'),
      _InputField.text('electricContractor', '전기 계약자 명의'),
      _InputField.toggle('electricAddressSame', '전기 사용 장소와 주민등록 주소 같음'),
      _InputField.toggle('residentialElectricity', '주택용 전기 사용'),
      _InputField.choice('apartmentBillingType', '아파트 전기요금 방식', ['해당 없음', '개별계량', '관리비 합산', '모름']),
      _InputField.toggle('electricWelfareRecipient', '수급자·차상위·장애인 등 할인 자격 있음'),
      _InputField.text('electricHouseholdCount', '세대원 수', keyboardType: TextInputType.number),
      _InputField.text('minorChildCount', '자녀 수', keyboardType: TextInputType.number),
      _InputField.text('childBirthDates', '자녀 생년월일'),
      _InputField.text('recentBabyBirthDate', '최근 출생아 생년월일'),
      _InputField.toggle('lifeSupportDevice', '생명유지장치 사용'),
      _InputField.toggle('electricBillReady', '최근 전기요금 고지서 확인'),
      _InputField.choice(
        'electricityApplicationStatus',
        '현재 할인 적용 여부',
        ['모름', '미신청', '신청 완료', '적용 중', '명의 불일치', '고객번호 확인 필요'],
      ),
    ],
  ),
  _Benefit(
    id: 'gas',
    title: '도시가스요금 경감',
    description: '도시가스 사용 여부, 공급회사, 고객번호를 따로 확인합니다.',
    helper: '도시가스 다자녀 기준은 에너지바우처와 다르므로 별도 항목으로 확인합니다.',
    icon: Icons.local_fire_department,
    color: kDanger,
    fields: [
      _InputField.toggle('usesCityGas', '도시가스 사용'),
      _InputField.choice('gasUseType', '가스 사용 형태', ['취사용', '취사·난방용', '모름']),
      _InputField.choice('gasHeatingType', '난방 방식', ['개별난방', '중앙난방', '모름']),
      _InputField.text('gasCompany', '도시가스 공급회사'),
      _InputField.text('gasCustomerNo', '도시가스 고객번호'),
      _InputField.text('gasContractor', '가스 계약자 명의'),
      _InputField.toggle('gasAddressSame', '가스 사용 장소와 주민등록 주소 같음'),
      _InputField.toggle('gasSevereDisabilityOrMerit', '중증장애·유공자 등 자격 있음'),
      _InputField.toggle('gasBasicOrNearPoor', '수급자 또는 차상위 해당'),
      _InputField.toggle('gasMultiChildThree', '자녀 또는 손자녀 3명 이상'),
      _InputField.toggle('gasEnergyVoucherRecipient', '에너지바우처 수급'),
      _InputField.toggle('gasBillReady', '최근 가스요금 고지서 확인'),
      _InputField.choice(
        'gasApplicationStatus',
        '현재 경감 적용 여부',
        ['모름', '미신청', '신청 완료', '적용 중', '도시가스 미사용', '공급회사 확인 필요'],
      ),
    ],
  ),
];

_BenefitStatus _evaluateBenefit(_Benefit benefit, Map<String, dynamic> info) {
  final missing = benefit.fields
      .where((field) => !_hasValue(info[field.key]))
      .map((field) => field.label)
      .take(6)
      .toList();
  final completed = _completedCount(benefit.fields, info);

  if (benefit.id == 'voucher') {
    final hasIncome = info['livelihoodBenefit'] == true ||
        info['medicalBenefit'] == true ||
        info['housingBenefit'] == true ||
        info['educationBenefit'] == true;
    final hasTrait = _voucherTraitKeys.any((key) => info[key] == true);
    final duplicate = info['winterFuelSupport'] == true ||
        info['coalCoupon'] == true ||
        info['coalEnergyVoucher'] == true;
    if (hasIncome && hasTrait && !duplicate) {
      return _BenefitStatus(
        title: '신청 가능성이 있습니다',
        message: '소득 기준과 세대원 특성 기준에 해당합니다. 최근 요금고지서를 준비해 행정복지센터에서 최종 확인하세요.',
        color: kPrimary,
        missing: missing,
      );
    }
    if (duplicate) {
      return _BenefitStatus(
        title: '중복 지원 확인 필요',
        message: '동절기 난방비 지원과 중복 제한될 수 있는 항목이 있습니다. 복지사가 지원 내역을 확인해야 합니다.',
        color: kWarning,
        missing: missing,
      );
    }
  }

  if (benefit.id == 'electricity') {
    if (!_hasValue(info['electricCustomerNo']) ||
        !_hasValue(info['electricContractor'])) {
      return _BenefitStatus(
        title: '추가 정보가 필요합니다',
        message: '할인 대상 가능성이 있어도 한전 고객번호와 계약자 명의가 확인되어야 신청을 진행할 수 있습니다.',
        color: kWarning,
        missing: missing,
      );
    }
    return _BenefitStatus(
      title: '신청 자료가 준비되었습니다',
      message: '한전 고객번호와 계약자 명의가 입력되었습니다. 자격 유형과 고지서를 확인해 신청을 진행하세요.',
      color: kPrimary,
      missing: missing,
    );
  }

  if (benefit.id == 'gas') {
    if (info['usesCityGas'] == false) {
      return const _BenefitStatus(
        title: '도시가스 미사용',
        message: '현재 도시가스를 사용하지 않는 것으로 입력되어 경감 신청 대상에서 제외될 수 있습니다.',
        color: kTextMuted,
        missing: [],
      );
    }
    if (!_hasValue(info['gasCompany']) || !_hasValue(info['gasCustomerNo'])) {
      return _BenefitStatus(
        title: '대상 여부 확인 필요',
        message: '도시가스를 사용 중이라면 고객번호와 공급회사를 등록해 주세요.',
        color: kWarning,
        missing: missing,
      );
    }
    return _BenefitStatus(
      title: '신청 자료가 준비되었습니다',
      message: '공급회사와 고객번호가 입력되었습니다. 사용 형태와 자격 유형에 따라 경감액을 확인하세요.',
      color: kPrimary,
      missing: missing,
    );
  }

  return _BenefitStatus(
    title: completed == 0 ? '미확인' : '추가 확인 필요',
    message: '입력된 정보를 바탕으로 보호자와 복지사가 신청 가능 여부를 확인합니다.',
    color: completed == 0 ? kTextMuted : kWarning,
    missing: missing,
  );
}

const _voucherTraitKeys = {
  'elderlyHouseholdMember',
  'infantHouseholdMember',
  'disabledHouseholdMember',
  'pregnantHouseholdMember',
  'severeDiseaseHouseholdMember',
  'rareDiseaseHouseholdMember',
  'intractableDiseaseHouseholdMember',
  'singleParentFamily',
  'childHeadedHousehold',
  'multiChildHousehold',
};

int _completedCount(List<_InputField> fields, Map<String, dynamic> info) {
  return fields.where((field) => _hasValue(info[field.key])).length;
}

bool _hasValue(dynamic value) {
  if (value == null) return false;
  if (value is bool) return true;
  if (value is List) {
    return value.any((item) => '$item'.trim().isNotEmpty);
  }
  return '$value'.trim().isNotEmpty;
}

String _stringValue(dynamic value) {
  return value == null ? '' : '$value'.trim();
}

List<String> _birthDateList(dynamic value) {
  if (value is List) {
    return value.map((item) => '$item'.trim()).toList();
  }
  final text = '${value ?? ''}'.trim();
  if (text.isEmpty) return <String>[];
  return text
      .split(',')
      .map((item) => item.trim())
      .where((item) => item.isNotEmpty)
      .toList();
}
