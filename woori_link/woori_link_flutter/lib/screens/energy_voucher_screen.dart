import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/energy_support_api.dart';
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
      final energySupportDetails = await Future.wait([
        EnergySupportApi.getEnergySupportProfile(seniorId),
        EnergySupportApi.getEnergyVoucherDetail(seniorId),
        EnergySupportApi.getGasDiscountDetail(seniorId),
        EnergySupportApi.getElectricityDiscountDetail(seniorId),
      ]);
      final profile = energySupportDetails[0];
      final voucherDetail = energySupportDetails[1];
      final gasDetail = energySupportDetails[2];
      final electricityDetail = energySupportDetails[3];
      final saved = await _storage.read(key: _storageKey(seniorId));
      final localInfo = saved == null
          ? <String, dynamic>{}
          : Map<String, dynamic>.from(jsonDecode(saved) as Map);
      if (!mounted) return;
      setState(() {
        _seniorId = seniorId;
        _senior = data;
        _info = _mergedInfo(
          data,
          localInfo,
          profile: profile,
          voucherDetail: voucherDetail,
          gasDetail: gasDetail,
          electricityDetail: electricityDetail,
        );
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
    Map<String, dynamic> local, {
    Map<String, dynamic>? profile,
    Map<String, dynamic>? voucherDetail,
    Map<String, dynamic>? gasDetail,
    Map<String, dynamic>? electricityDetail,
  }) {
    final localWithoutGas = Map<String, dynamic>.from(local)
      ..removeWhere((key, _) => _gasServerBackedKeys.contains(key));

    final values = <String, dynamic>{
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
      ...localWithoutGas,
    };

    if (profile != null) {
      _applyProfileToLocal(values, profile);
    }
    if (voucherDetail != null) {
      values.addAll(_voucherDetailToLocal(voucherDetail));
    }
    if (gasDetail != null) {
      values.addAll(_gasDetailToLocal(gasDetail));
    }
    if (electricityDetail != null) {
      values.addAll(_electricityDetailToLocal(electricityDetail));
    }
    return values;
  }

  void _applyProfileToLocal(
    Map<String, dynamic> values,
    Map<String, dynamic> profile,
  ) {
    void apply(String serverKey, String localKey) {
      if (profile.containsKey(serverKey) && profile[serverKey] != null) {
        values[localKey] = profile[serverKey];
      }
    }

    apply('basicLivelihoodRecipient', 'livelihoodBenefit');
    apply('nearPoverty', 'nearPoverty');
    apply('disabledHousehold', 'disabledHouseholdMember');
    apply('nationalMeritHousehold', 'nationalMeritHousehold');
    apply('seniorHousehold', 'elderlyHouseholdMember');
    apply('infantHousehold', 'infantHouseholdMember');
    apply('pregnantHousehold', 'pregnantHouseholdMember');
    apply('singleParentHousehold', 'singleParentFamily');
    apply('multiChildHousehold', 'multiChildHousehold');
    apply('householdSize', 'householdCount');
    apply('energyVoucherRecipient', 'energyVoucherRecipient');

    final heatingEnergyType = _heatingEnergyTypeToDisplay(
      profile['heatingEnergyType'],
    );
    if (heatingEnergyType != null) {
      values['mainHeatingSource'] = heatingEnergyType;
    }
  }

  String? _heatingEnergyTypeToDisplay(dynamic value) {
    return switch (value?.toString()) {
      'CITY_GAS' => '도시가스',
      'LPG' => 'LPG',
      'KEROSENE' => '등유',
      'ELECTRICITY' => '전기',
      'DISTRICT_HEATING' => '지역난방',
      'OTHER' => '기타',
      'UNKNOWN' => '모름',
      _ => null,
    };
  }

  Future<void> _save(
    Map<String, dynamic> nextInfo,
    String benefitId,
  ) async {
    final seniorId = _seniorId ?? await AuthService.getUserId();
    if (seniorId == null || _saving) return;
    setState(() => _saving = true);

    final serverBody = <String, dynamic>{
      for (final key in _serverBackedKeys)
        if (nextInfo.containsKey(key)) key: nextInfo[key],
    };

    try {
      if (serverBody.isNotEmpty) {
        await SeniorApi.updateSenior(seniorId, serverBody);
      }

      final detailSaves = <Future<dynamic>>[
        EnergySupportApi.saveEnergySupportProfile(
          seniorId,
          _buildProfileRequest(nextInfo),
        ),
        EnergySupportApi.saveEnergyVoucherDetail(
          seniorId,
          _buildVoucherRequest(nextInfo),
        ),
      ];
      if (_shouldSaveGasDetail(nextInfo)) {
        detailSaves.add(
          EnergySupportApi.saveGasDiscountDetail(
            seniorId,
            _gasDetailRequest(nextInfo),
          ),
        );
      }
      if (_shouldSaveElectricityDetail(nextInfo)) {
        detailSaves.add(
          EnergySupportApi.saveElectricityDiscountDetail(
            seniorId,
            _buildElectricityRequest(nextInfo),
          ),
        );
      }

      await Future.wait(detailSaves);

      final localInfo = Map<String, dynamic>.from(nextInfo)
        ..removeWhere(
          (key, _) =>
              _gasServerBackedKeys.contains(key) ||
              _profileServerBackedKeys.contains(key) ||
              _voucherServerBackedKeys.contains(key) ||
              _electricityServerBackedKeys.contains(key),
        );
      await _storage.write(
        key: _storageKey(seniorId),
        value: jsonEncode(localInfo),
      );

      await _load();
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            benefitId == 'gas'
                ? '도시가스 정보를 저장했습니다.'
                : '입력 정보를 저장했습니다. 남은 항목은 보호자나 복지사에게 확인을 요청하세요.',
          ),
          backgroundColor: kPrimary,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.toString().replaceFirst('Exception: ', ''),
          ),
        ),
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

  static const _gasServerBackedKeys = {
    'usesCityGas',
    'gasUseType',
    'gasHeatingType',
    'gasCompany',
    'gasCustomerNo',
    'gasContractor',
    'gasAddressSame',
    'gasServiceAddress',
    'gasBillReady',
    'gasSevereDisabilityOrMerit',
    'gasBasicOrNearPoor',
    'gasMultiChildThree',
      'gasEnergyVoucherRecipient',
    'gasNote',
  };

  static const _profileServerBackedKeys = {
    'livelihoodBenefit',
    'nearPoverty',
    'disabledHouseholdMember',
    'nationalMeritHousehold',
    'elderlyHouseholdMember',
    'infantHouseholdMember',
    'pregnantHouseholdMember',
    'singleParentFamily',
    'multiChildHousehold',
    'householdCount',
    'energyVoucherRecipient',
    'mainHeatingSource',
  };

  static const _voucherServerBackedKeys = {
    'voucherUseMethod',
    'voucherElectricCustomerNo',
    'voucherGasCustomerNo',
    'energySupplier',
    'recentBillReady',
    'happyCardOwned',
    'winterFuelSupport',
    'coalCoupon',
    'coalEnergyVoucher',
  };

  static const _electricityServerBackedKeys = {
    'residentialElectricity',
    'electricityCompany',
    'electricCustomerNo',
    'electricContractor',
    'electricAddressSame',
    'electricityServiceAddress',
    'electricBillReady',
    'electricityDiscountApplied',
    'electricityDiscountStatus',
    'electricWelfareRecipient',
    'electricityNote',
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
              Tab(text: '입력 현황'),
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
    if (result != null) {
      await _save(result, benefit.id);
    }
  }

  Map<String, dynamic> _gasDetailRequest(
    Map<String, dynamic> info,
  ) {
    return {
      'usesCityGas': info['usesCityGas'],
      'gasUseType': switch (info['gasUseType']) {
        '취사' => 'COOKING',
        '취사용' => 'COOKING',
        '난방' => 'HEATING',
        '취사 및 난방' => 'COOKING_AND_HEATING',
        '취사·난방용' => 'COOKING_AND_HEATING',
        '기타' => 'OTHER',
        _ => null,
      },
      'gasHeatingType': switch (info['gasHeatingType']) {
        '개별난방' => 'INDIVIDUAL',
        '중앙난방' => 'CENTRAL',
        '지역난방' => 'DISTRICT',
        '가스 난방 미사용' => 'NOT_USED',
        '기타' => 'OTHER',
        _ => null,
      },
      'gasCompany': _emptyToNull(info['gasCompany']),
      'gasCustomerNumber': _emptyToNull(info['gasCustomerNo']),
      'gasContractorName': _emptyToNull(info['gasContractor']),
      'addressSame': info['gasAddressSame'],
      'gasServiceAddress': info['gasAddressSame'] == false
          ? _emptyToNull(info['gasServiceAddress'])
          : null,
      'recentBillChecked': info['gasBillReady'],
      'severeDisabilityOrMerit': info['gasSevereDisabilityOrMerit'],
      'basicOrNearPoor': info['gasBasicOrNearPoor'],
      'multiChildHousehold': info['gasMultiChildThree'],
      'energyVoucherRecipient': info['gasEnergyVoucherRecipient'],
      'note': _emptyToNull(info['gasNote']),
    };
  }

  Map<String, dynamic> _buildProfileRequest(
    Map<String, dynamic> info,
  ) {
    return {
      'basicLivelihoodRecipient': info['livelihoodBenefit'],
      'nearPoverty': info['nearPoverty'],
      'disabledHousehold': info['disabledHouseholdMember'],
      'nationalMeritHousehold': info['nationalMeritHousehold'],
      'seniorHousehold': info['elderlyHouseholdMember'],
      'infantHousehold': info['infantHouseholdMember'],
      'pregnantHousehold': info['pregnantHouseholdMember'],
      'singleParentHousehold': info['singleParentFamily'],
      'multiChildHousehold': info['multiChildHousehold'],
      'householdSize': _parseNullableInt(info['householdCount']),
      'energyVoucherRecipient': info['energyVoucherRecipient'],
      'heatingEnergyType': _heatingEnergyTypeToServer(
        info['mainHeatingSource'],
      ),
    };
  }

  Map<String, dynamic> _voucherDetailToLocal(Map<String, dynamic> detail) {
    final values = <String, dynamic>{};

    if (detail['applicationResult'] == 'APPROVED') {
      values['energyVoucherApplied'] = true;
    }

    final winterSupport = detail['winterOtherEnergySupportRecipient'];
    if (winterSupport != null) {
      values['winterFuelSupport'] = winterSupport;
    }

    final duplicateSupport = detail['duplicateSupportDisqualifying'];
    if (duplicateSupport != null) {
      values['coalCoupon'] = duplicateSupport;
    }

    final note = detail['confirmationNote'];
    if (note is String && note.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(note);
        if (decoded is Map) {
          for (final entry in decoded.entries) {
            values[entry.key.toString()] = entry.value;
          }
        }
      } catch (_) {
        values['voucherNote'] = note;
      }
    }

    return values;
  }

  Map<String, dynamic> _buildVoucherRequest(Map<String, dynamic> info) {
    final incomeKeys = {
      'livelihoodBenefit',
      'medicalBenefit',
      'housingBenefit',
      'educationBenefit',
      'nearPoverty',
    };
    final traitKeys = {
      'elderlyHouseholdMember',
      'infantHouseholdMember',
      'disabledHouseholdMember',
      'nationalMeritHousehold',
      'pregnantHouseholdMember',
      'severeDiseaseHouseholdMember',
      'rareDiseaseHouseholdMember',
      'intractableDiseaseHouseholdMember',
      'singleParentFamily',
      'childHeadedHousehold',
      'multiChildHousehold',
    };
    final otherSupportKeys = {
      'winterFuelSupport',
      'coalCoupon',
      'coalEnergyVoucher',
    };

    final incomeValues = incomeKeys
        .where((key) => info[key] == true)
        .toList(growable: false);
    final traitValues = traitKeys
        .where((key) => info[key] == true)
        .toList(growable: false);
    final otherSupportValues = otherSupportKeys
        .where((key) => info[key] == true)
        .toList(growable: false);

    final incomeConfirmed = _anyPresent(info, incomeKeys)
        ? incomeValues.isNotEmpty
        : null;
    final traitConfirmed = _anyPresent(info, traitKeys)
        ? traitValues.isNotEmpty
        : null;
    final winterSupportRecipient = _anyPresent(info, otherSupportKeys)
        ? otherSupportValues.isNotEmpty
        : null;

    final notePayload = {
      for (final key in _voucherServerBackedKeys)
        if (info.containsKey(key)) key: info[key],
    };

    return {
      'incomeCriteriaConfirmed': incomeConfirmed,
      'livelihoodBenefitTypes':
          incomeValues.isEmpty ? null : incomeValues.join(', '),
      'householdCharacteristicConfirmed': traitConfirmed,
      'householdCharacteristics':
          traitValues.isEmpty ? null : traitValues.join(', '),
      'winterOtherEnergySupportRecipient': winterSupportRecipient,
      'otherEnergySupportTypes':
          otherSupportValues.isEmpty ? null : otherSupportValues.join(', '),
      'duplicateSupportDisqualifying': otherSupportValues.isNotEmpty,
      'applicationYear': null,
      'applicationResult': info['energyVoucherApplied'] == true
          ? 'APPROVED'
          : 'UNKNOWN',
      'confirmationNote':
          notePayload.isEmpty ? null : jsonEncode(notePayload),
    };
  }

  bool _shouldSaveGasDetail(Map<String, dynamic> info) {
    return info['usesCityGas'] != null;
  }

  bool _anyPresent(Map<String, dynamic> info, Set<String> keys) {
    return keys.any((key) => info.containsKey(key) && info[key] != null);
  }

  int? _parseNullableInt(dynamic value) {
    if (value == null) return null;
    if (value is int) return value;

    final text = value.toString().trim();
    if (text.isEmpty) return null;
    return int.tryParse(text);
  }

  String? _heatingEnergyTypeToServer(dynamic value) {
    return switch (value?.toString()) {
      '도시가스' => 'CITY_GAS',
      'LPG' => 'LPG',
      '등유' => 'KEROSENE',
      '전기' => 'ELECTRICITY',
      '지역난방' => 'DISTRICT_HEATING',
      '기타' => 'OTHER',
      '모름' => 'UNKNOWN',
      _ => null,
    };
  }

  Map<String, dynamic> _electricityDetailToLocal(
    Map<String, dynamic> detail,
  ) {
    final values = <String, dynamic>{};

    void apply(String serverKey, String localKey) {
      if (detail.containsKey(serverKey) && detail[serverKey] != null) {
        values[localKey] = detail[serverKey];
      }
    }

    apply('usesElectricity', 'residentialElectricity');
    final company =
        detail['electricityCompany'] ?? detail['electricityProvider'];
    if (company != null) values['electricityCompany'] = company;
    apply('customerNumber', 'electricCustomerNo');
    apply('contractorName', 'electricContractor');
    apply('addressSame', 'electricAddressSame');
    apply('serviceAddress', 'electricityServiceAddress');
    apply('recentBillChecked', 'electricBillReady');
    final currentDiscountStatus = _electricityDiscountStatusToDisplay(
      detail['currentDiscountStatus'],
    );
    if (currentDiscountStatus != null) {
      values['electricityDiscountStatus'] = currentDiscountStatus;
      values['electricityDiscountApplied'] =
          detail['currentDiscountStatus'] == 'RECEIVING';
    }
    apply('welfareEligible', 'electricWelfareRecipient');
    apply('note', 'electricityNote');

    return values;
  }

  Map<String, dynamic> _buildElectricityRequest(
    Map<String, dynamic> info,
  ) {
    final addressSame = info['electricAddressSame'];
    return {
      'usesElectricity': info['residentialElectricity'],
      'electricityCompany': _emptyToNull(info['electricityCompany']),
      'customerNumber': _emptyToNull(info['electricCustomerNo']),
      'contractorName': _emptyToNull(info['electricContractor']),
      'addressSame': addressSame,
      'serviceAddress': addressSame == false
          ? _emptyToNull(info['electricityServiceAddress'])
          : null,
      'recentBillChecked': info['electricBillReady'],
      'currentDiscountStatus':
          _electricityCurrentDiscountStatusToServer(info),
      'welfareEligible': info['electricWelfareRecipient'],
      'note': _emptyToNull(info['electricityNote']),
    };
  }

  bool _shouldSaveElectricityDetail(Map<String, dynamic> info) {
    return _emptyToNull(info['electricityCompany']) != null ||
        _emptyToNull(info['electricCustomerNo']) != null ||
        _emptyToNull(info['electricContractor']) != null ||
        info['electricAddressSame'] != null ||
        info['electricBillReady'] != null ||
        info['residentialElectricity'] != null ||
        info['electricityDiscountApplied'] != null ||
        info['electricWelfareRecipient'] != null;
  }

  String? _electricityCurrentDiscountStatusToServer(
    Map<String, dynamic> info,
  ) {
    final explicitStatus =
        _electricityDiscountStatusToServer(info['electricityDiscountStatus']);
    if (explicitStatus != null) return explicitStatus;

    final applied = info['electricityDiscountApplied'];
    if (applied == true) return 'RECEIVING';
    if (applied == false) return 'NOT_RECEIVING';
    return null;
  }

  String? _electricityDiscountStatusToDisplay(dynamic value) {
    return switch (value?.toString()) {
      'UNKNOWN' => '모름',
      'NOT_RECEIVING' => '할인받지 않음',
      'RECEIVING' => '할인받고 있음',
      _ => null,
    };
  }

  String? _electricityDiscountStatusToServer(dynamic value) {
    return switch (value?.toString()) {
      '모름' || 'UNKNOWN' => 'UNKNOWN',
      '할인받지 않음' || '미신청' || 'NOT_RECEIVING' => 'NOT_RECEIVING',
      '할인받고 있음' || '신청 완료' || '적용 중' || 'RECEIVING' =>
        'RECEIVING',
      _ => null,
    };
  }

  Map<String, dynamic> _gasDetailToLocal(Map<String, dynamic> detail) {
    return {
      'usesCityGas': detail['usesCityGas'],
      'gasUseType': switch (detail['gasUseType']) {
        'COOKING' => '취사',
        'HEATING' => '난방',
        'COOKING_AND_HEATING' => '취사 및 난방',
        'OTHER' => '기타',
        _ => '모름',
      },
      'gasHeatingType': switch (detail['gasHeatingType']) {
        'INDIVIDUAL' => '개별난방',
        'CENTRAL' => '중앙난방',
        'DISTRICT' => '지역난방',
        'NOT_USED' => '가스 난방 미사용',
        'OTHER' => '기타',
        _ => '모름',
      },
      'gasCompany': detail['gasCompany'],
      'gasCustomerNo': detail['gasCustomerNumber'],
      'gasContractor': detail['gasContractorName'],
      'gasAddressSame': detail['addressSame'],
      'gasServiceAddress': detail['gasServiceAddress'],
      'gasBillReady': detail['recentBillChecked'],
      'gasSevereDisabilityOrMerit': detail['severeDisabilityOrMerit'],
      'gasBasicOrNearPoor': detail['basicOrNearPoor'],
      'gasMultiChildThree': detail['multiChildHousehold'],
      'gasEnergyVoucherRecipient': detail['energyVoucherRecipient'],
      'gasNote': detail['note'],
    };
  }

  dynamic _emptyToNull(dynamic value) {
    if (value is! String) return value;
    final trimmed = value.trim();
    return trimmed.isEmpty ? null : trimmed;
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
  });

  final Map<String, dynamic> info;

  @override
  Widget build(BuildContext context) {
    final enteredBenefits = _benefits
        .where((benefit) => _completedCount(benefit.fields, info) > 0)
        .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
      children: [
        if (enteredBenefits.isEmpty) ...[
          const _EmptyInputStatusCard(),
        ] else ...[
          ...enteredBenefits.map(
            (benefit) {
              final status = _evaluateBenefit(benefit, info);
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: _StatusCard(
                  benefit: benefit,
                  status: status,
                ),
              );
            },
          ),
        ],
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
              '수급 자격과 실제 신청 여부는 따로 확인합니다. 모르는 항목은 비워두면 입력 현황에서 확인이 필요한 항목으로 남습니다.',
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
  });

  final _Benefit benefit;
  final _BenefitStatus status;

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
        '입력 현황은 실제 신청 완료가 아니라 현재 입력된 정보와 확인이 필요한 항목을 보여줍니다. 수정은 내 정보 탭에서 할 수 있습니다.',
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

class _EmptyInputStatusCard extends StatelessWidget {
  const _EmptyInputStatusCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: kPrimary.withOpacity(0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.edit_note, color: kPrimary),
            ),
            const SizedBox(width: 12),
            const Expanded(
              child: Text(
                '아직 입력된 복지 정보가 없습니다. 내 정보 탭에서 필요한 항목을 먼저 입력해 주세요.',
                style: TextStyle(
                  color: kTextMuted,
                  height: 1.45,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
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
              if (widget.benefit.fields
                  .any((field) => field.type == _FieldType.toggle)) ...[
                const SizedBox(height: 10),
                const _UnknownAnswerNotice(),
              ],
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
        return _YesNoUnknownField(
          label: field.label,
          hint: field.hint,
          value: _draft[field.key] is bool ? _draft[field.key] as bool : null,
          onChanged: (value) => setState(() => _draft[field.key] = value),
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
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: '${index + 1}번째 세대원 생년월일',
                  hintText: '예: 19450301',
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
    final raw = _controllers['householdCount']?.text ??
        '${_draft['householdCount'] ?? ''}';
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

class _YesNoUnknownField extends StatelessWidget {
  const _YesNoUnknownField({
    required this.label,
    required this.value,
    required this.onChanged,
    this.hint,
  });

  final String label;
  final String? hint;
  final bool? value;
  final ValueChanged<bool?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 8, right: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  if (hint != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      hint!,
                      style: const TextStyle(
                        color: kTextMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          SizedBox(
            width: 152,
            height: 44,
            child: _YesNoPill(
              value: value,
              onChanged: onChanged,
            ),
          ),
        ],
      ),
    );
  }
}

class _YesNoPill extends StatelessWidget {
  const _YesNoPill({
    required this.value,
    required this.onChanged,
  });

  final bool? value;
  final ValueChanged<bool?> onChanged;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: Colors.white,
          border: Border.all(color: kBorder.withOpacity(0.9), width: 1.1),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            _YesNoPillSegment(
              selected: value == true,
              label: '예',
              icon: Icons.check,
              onTap: () => onChanged(value == true ? null : true),
            ),
            Container(width: 1, color: kBorder.withOpacity(0.9)),
            _YesNoPillSegment(
              selected: value == false,
              label: '아니요',
              icon: Icons.close,
              onTap: () => onChanged(value == false ? null : false),
            ),
          ],
        ),
      ),
    );
  }
}

class _YesNoPillSegment extends StatelessWidget {
  const _YesNoPillSegment({
    required this.selected,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final bool selected;
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final selectedColor = label == '아니요' ? kDanger : kPrimaryDark;
    final selectedBackground =
        label == '아니요' ? kDanger.withOpacity(0.11) : kPrimary.withOpacity(0.16);
    final color = selected ? selectedColor : kTextPrimary;

    return Expanded(
      child: Material(
        color: selected ? selectedBackground : Colors.white,
        child: InkWell(
          onTap: onTap,
          child: Center(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 6),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 17, color: color),
                    const SizedBox(width: 4),
                    Text(
                      label,
                      style: TextStyle(
                        color: color,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _UnknownAnswerNotice extends StatelessWidget {
  const _UnknownAnswerNotice();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: kPrimary.withOpacity(0.07),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: kPrimary.withOpacity(0.16)),
      ),
      child: const Text(
        '예/아니요를 선택하지 않은 항목은 모름으로 전달됩니다.',
        style: TextStyle(
          color: kTextMuted,
          fontSize: 12,
          height: 1.35,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
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
  const _InputField.toggle(
    this.key,
    this.label, {
    this.hint,
    this.requiredForStatus = true,
  })
      : type = _FieldType.toggle,
        options = const [],
        keyboardType = null;

  const _InputField.text(
    this.key,
    this.label, {
    this.hint,
    this.keyboardType,
    this.requiredForStatus = true,
  })
      : type = _FieldType.text,
        options = const [];

  const _InputField.choice(
    this.key,
    this.label,
    this.options, {
    this.hint,
    this.requiredForStatus = true,
  })  : type = _FieldType.choice,
        keyboardType = null;

  const _InputField.householdBirthDates(
    this.key,
    this.label, {
    this.hint,
    this.requiredForStatus = true,
  })
      : type = _FieldType.householdBirthDates,
        options = const [],
        keyboardType = null;

  final String key;
  final String label;
  final String? hint;
  final _FieldType type;
  final List<String> options;
  final TextInputType? keyboardType;
  final bool requiredForStatus;
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
      _InputField.toggle('nearPoverty', '차상위계층 해당'),
      _InputField.toggle('medicalBenefit', '의료급여 수급'),
      _InputField.toggle('housingBenefit', '주거급여 수급'),
      _InputField.toggle('educationBenefit', '교육급여 수급'),
      _InputField.text('householdCount', '주민등록상 세대원 수', keyboardType: TextInputType.number),
      _InputField.householdBirthDates('householdBirthDates', '세대원 생년월일'),
      _InputField.toggle('elderlyHouseholdMember', '노인 세대원 있음'),
      _InputField.toggle('infantHouseholdMember', '영유아 세대원 있음'),
      _InputField.toggle('disabledHouseholdMember', '등록 장애인 있음'),
      _InputField.toggle('nationalMeritHousehold', '국가유공자 세대 해당'),
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
        ['전기', '도시가스', '지역난방', '등유', 'LPG', '연탄', '기타', '모름'],
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
      _InputField.toggle('energyVoucherRecipient', '에너지바우처 수급'),
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
      _InputField.text('electricityCompany', '전기 공급사'),
      _InputField.text('electricCustomerNo', '한전 고객번호'),
      _InputField.text('electricContractor', '전기 계약자 명의'),
      _InputField.toggle('electricAddressSame', '전기 사용 장소와 주민등록 주소 같음'),
      _InputField.text('electricityServiceAddress', '전기 사용 주소'),
      _InputField.toggle('residentialElectricity', '주택용 전기 사용'),
      _InputField.choice('apartmentBillingType', '아파트 전기요금 방식', ['해당 없음', '개별계량', '관리비 합산', '모름']),
      _InputField.toggle('electricWelfareRecipient', '수급자·차상위·장애인 등 할인 자격 있음'),
      _InputField.text('electricHouseholdCount', '세대원 수', keyboardType: TextInputType.number),
      _InputField.toggle('minorChildrenPresent', '미성년 자녀 있음'),
      _InputField.text(
        'minorChildCount',
        '자녀 수',
        hint: '자녀가 없으면 위 항목에서 아니요를 선택하세요.',
        keyboardType: TextInputType.number,
        requiredForStatus: false,
      ),
      _InputField.text(
        'childBirthDates',
        '자녀 생년월일',
        hint: '확인 가능한 경우만 입력하세요.',
        requiredForStatus: false,
      ),
      _InputField.text(
        'recentBabyBirthDate',
        '최근 출생아 생년월일',
        hint: '해당하는 경우만 입력하세요.',
        requiredForStatus: false,
      ),
      _InputField.toggle('lifeSupportDevice', '생명유지장치 사용'),
      _InputField.toggle('electricBillReady', '최근 전기요금 고지서 확인'),
      _InputField.text('electricityNote', '전기요금 확인 메모'),
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
      _InputField.choice(
        'gasUseType',
        '가스 사용 형태',
        ['취사', '난방', '취사 및 난방', '기타', '모름'],
      ),
      _InputField.choice(
        'gasHeatingType',
        '난방 방식',
        ['개별난방', '중앙난방', '지역난방', '가스 난방 미사용', '기타', '모름'],
      ),
      _InputField.text('gasCompany', '도시가스 공급회사'),
      _InputField.text('gasCustomerNo', '도시가스 고객번호'),
      _InputField.text('gasContractor', '가스 계약자 명의'),
      _InputField.toggle('gasAddressSame', '가스 사용 장소와 주민등록 주소 같음'),
      _InputField.text('gasServiceAddress', '도시가스 사용 주소'),
      _InputField.toggle('gasSevereDisabilityOrMerit', '중증장애·유공자 등 자격 있음'),
      _InputField.toggle('gasBasicOrNearPoor', '수급자 또는 차상위 해당'),
      _InputField.toggle('gasMultiChildThree', '자녀 또는 손자녀 3명 이상'),
      _InputField.toggle('gasEnergyVoucherRecipient', '에너지바우처 수급'),
      _InputField.toggle('gasBillReady', '최근 가스요금 고지서 확인'),
      _InputField.text('gasNote', '도시가스 확인 메모'),
    ],
  ),
];

_BenefitStatus _evaluateBenefit(_Benefit benefit, Map<String, dynamic> info) {
  final missing = benefit.fields
      .where((field) => field.requiredForStatus)
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
