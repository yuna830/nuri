package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergySupportCompletionDto;
import com.nuri.woorilink.entity.ElectricityDiscountDetail;
import com.nuri.woorilink.entity.EnergySupportProfile;
import com.nuri.woorilink.entity.GasDiscountDetail;
import com.nuri.woorilink.repository.ElectricityDiscountDetailRepository;
import com.nuri.woorilink.repository.EnergySupportProfileRepository;
import com.nuri.woorilink.repository.GasDiscountDetailRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnergySupportCompletionService {

    private static final int COMMON_REQUIRED_COUNT = 11;
    private static final int VOUCHER_REQUIRED_COUNT = 1;

    private final SeniorRepository seniorRepository;
    private final EnergySupportProfileRepository profileRepository;
    private final ElectricityDiscountDetailRepository electricityRepository;
    private final GasDiscountDetailRepository gasRepository;

    public EnergySupportCompletionDto getCompletion(Long seniorId) {
        if (seniorId == null || !seniorRepository.existsById(seniorId)) {
            throw new IllegalArgumentException(
                    "대상자를 찾을 수 없습니다: " + seniorId);
        }

        EnergySupportProfile profile = profileRepository
                .findBySeniorId(seniorId)
                .orElse(null);
        ElectricityDiscountDetail electricity = electricityRepository
                .findBySeniorId(seniorId)
                .orElse(null);
        GasDiscountDetail gas = gasRepository
                .findBySeniorId(seniorId)
                .orElse(null);

        Map<String, List<String>> missing = new LinkedHashMap<>();
        List<String> commonMissing = new ArrayList<>();
        List<String> voucherMissing = new ArrayList<>();
        List<String> electricityMissing = new ArrayList<>();
        List<String> gasMissing = new ArrayList<>();

        addCommonMissing(profile, commonMissing, voucherMissing);
        int electricityRequiredCount =
                addElectricityMissing(electricity, electricityMissing);
        int gasRequiredCount = addGasMissing(gas, gasMissing);

        missing.put("COMMON", List.copyOf(commonMissing));
        missing.put("VOUCHER", List.copyOf(voucherMissing));
        missing.put("ELECTRICITY", List.copyOf(electricityMissing));
        missing.put("GAS", List.copyOf(gasMissing));

        int missingCount = missing.values().stream()
                .mapToInt(List::size)
                .sum();
        int requiredCount = COMMON_REQUIRED_COUNT
                + VOUCHER_REQUIRED_COUNT
                + electricityRequiredCount
                + gasRequiredCount;
        int completionRate = requiredCount == 0
                ? 100
                : (int) Math.round(
                (requiredCount - missingCount) * 100.0 / requiredCount
        );

        return new EnergySupportCompletionDto(
                seniorId,
                missingCount == 0,
                completionRate,
                missingCount,
                missing
        );
    }

    private void addCommonMissing(
            EnergySupportProfile profile,
            List<String> common,
            List<String> voucher
    ) {
        if (profile == null) {
            common.addAll(List.of(
                    "기초생활수급 여부",
                    "차상위계층 여부",
                    "장애인 세대 여부",
                    "국가유공자 세대 여부",
                    "노인 세대 여부",
                    "영유아 포함 여부",
                    "임산부 포함 여부",
                    "한부모 세대 여부",
                    "다자녀 세대 여부",
                    "세대원 수",
                    "난방 에너지원"
            ));
            voucher.add("에너지바우처 수급 여부");
            return;
        }

        addIfNull(common, profile.getBasicLivelihoodRecipient(),
                "기초생활수급 여부");
        addIfNull(common, profile.getNearPoverty(), "차상위계층 여부");
        addIfNull(common, profile.getDisabledHousehold(),
                "장애인 세대 여부");
        addIfNull(common, profile.getNationalMeritHousehold(),
                "국가유공자 세대 여부");
        addIfNull(common, profile.getSeniorHousehold(), "노인 세대 여부");
        addIfNull(common, profile.getInfantHousehold(), "영유아 포함 여부");
        addIfNull(common, profile.getPregnantHousehold(), "임산부 포함 여부");
        addIfNull(common, profile.getSingleParentHousehold(),
                "한부모 세대 여부");
        addIfNull(common, profile.getMultiChildHousehold(),
                "다자녀 세대 여부");
        addIfNull(common, profile.getHouseholdSize(), "세대원 수");
        if (isBlank(profile.getHeatingEnergyType())) {
            common.add("난방 에너지원");
        }
        addIfNull(voucher, profile.getEnergyVoucherRecipient(),
                "에너지바우처 수급 여부");
    }

    private int addElectricityMissing(
            ElectricityDiscountDetail detail,
            List<String> missing
    ) {
        if (detail == null) {
            missing.addAll(List.of(
                    "현재 전기요금 할인 여부",
                    "전기 공급사",
                    "전기 고객번호",
                    "계약자명",
                    "주소 일치 여부",
                    "최근 전기요금 고지서 확인 여부"
            ));
            return 6;
        }

        addIfNull(missing, detail.getCurrentDiscountStatus(),
                "현재 전기요금 할인 여부");
        if (isBlank(detail.getElectricityProvider())) {
            missing.add("전기 공급사");
        }
        if (isBlank(detail.getCustomerNumber())) {
            missing.add("전기 고객번호");
        }
        if (isBlank(detail.getContractorName())) {
            missing.add("계약자명");
        }
        addIfNull(missing, detail.getAddressSame(), "주소 일치 여부");
        if (Boolean.FALSE.equals(detail.getAddressSame())
                && isBlank(detail.getServiceAddress())) {
            missing.add("전기 사용 주소");
        }
        addIfNull(missing, detail.getRecentBillChecked(),
                "최근 전기요금 고지서 확인 여부");
        return Boolean.FALSE.equals(detail.getAddressSame()) ? 7 : 6;
    }

    private int addGasMissing(
            GasDiscountDetail detail,
            List<String> missing
    ) {
        if (detail == null || detail.getUsesCityGas() == null) {
            missing.add("도시가스 사용 여부");
            return 1;
        }
        if (Boolean.FALSE.equals(detail.getUsesCityGas())) {
            return 1;
        }

        if (isBlank(detail.getGasCompany())) {
            missing.add("도시가스 회사");
        }
        if (isBlank(detail.getGasCustomerNumber())) {
            missing.add("도시가스 고객번호");
        }
        if (isBlank(detail.getGasContractorName())) {
            missing.add("계약자명");
        }
        addIfNull(missing, detail.getAddressSame(), "주소 일치 여부");
        if (Boolean.FALSE.equals(detail.getAddressSame())
                && isBlank(detail.getGasServiceAddress())) {
            missing.add("도시가스 사용 주소");
        }
        addIfNull(missing, detail.getRecentBillChecked(),
                "최근 도시가스 고지서 확인 여부");
        return Boolean.FALSE.equals(detail.getAddressSame()) ? 7 : 6;
    }

    private void addIfNull(
            List<String> missing,
            Object value,
            String label
    ) {
        if (value == null) {
            missing.add(label);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
