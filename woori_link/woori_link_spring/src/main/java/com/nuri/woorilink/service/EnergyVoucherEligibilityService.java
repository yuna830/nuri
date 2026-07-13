package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergyVoucherEvaluationResult;
import com.nuri.woorilink.entity.Senior;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class EnergyVoucherEligibilityService {

    public EnergyVoucherEvaluationResult evaluate(Senior senior) {
        List<String> reasons = new ArrayList<>();

        boolean incomeOk = hasIncomeCriteria(senior, reasons);
        boolean householdOk = hasHouseholdCriteria(senior, reasons);
        boolean excluded = hasExclusionCriteria(senior, reasons);
        boolean duplicate = hasDuplicateSupport(senior, reasons);

        boolean eligible = incomeOk && householdOk && !excluded && !duplicate;

        if (eligible) {
            return new EnergyVoucherEvaluationResult(
                    true,
                    "신청 가능: " + String.join(", ", reasons)
            );
        }

        return new EnergyVoucherEvaluationResult(
                false,
                "신청 불가: " + String.join(", ", reasons)
        );
    }

    private boolean hasIncomeCriteria(Senior senior, List<String> reasons) {
        if (Boolean.TRUE.equals(senior.getLivelihoodBenefit())) {
            reasons.add("생계급여 수급");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getMedicalBenefit())) {
            reasons.add("의료급여 수급");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getHousingBenefit())) {
            reasons.add("주거급여 수급");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getEducationBenefit())) {
            reasons.add("교육급여 수급");
            return true;
        }

        reasons.add("소득기준 미충족");
        return false;
    }

    private boolean hasHouseholdCriteria(Senior senior, List<String> reasons) {
        if (Boolean.TRUE.equals(senior.getElderlyHouseholdMember())) {
            reasons.add("노인 세대원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getInfantHouseholdMember())) {
            reasons.add("영유아 세대원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getDisabledHouseholdMember())) {
            reasons.add("장애인 세대원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getPregnantHouseholdMember())) {
            reasons.add("임산부 세대원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getSevereDiseaseHouseholdMember())) {
            reasons.add("중증질환자 세대원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getRareDiseaseHouseholdMember())) {
            reasons.add("희귀질환자 세대원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getIntractableDiseaseHouseholdMember())) {
            reasons.add("중증난치질환자 세대원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getSingleParentFamily())) {
            reasons.add("한부모가족");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getChildHeadedHousehold())) {
            reasons.add("소년소녀가정");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getMultiChildHousehold())) {
            reasons.add("다자녀세대");
            return true;
        }

        reasons.add("세대원 특성기준 미충족");
        return false;
    }

    private boolean hasExclusionCriteria(Senior senior, List<String> reasons) {
        if (Boolean.TRUE.equals(senior.getAllMembersInFacility())) {
            reasons.add("세대원 모두 보장시설 수급");
            return true;
        }
        return false;
    }

    private boolean hasDuplicateSupport(Senior senior, List<String> reasons) {
        if (Boolean.TRUE.equals(senior.getWinterFuelSupport())) {
            reasons.add("긴급복지 동절기 연료비 중복지원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getCoalCoupon())) {
            reasons.add("연탄쿠폰 중복지원");
            return true;
        }
        if (Boolean.TRUE.equals(senior.getCoalEnergyVoucher())) {
            reasons.add("연탄전환 에너지바우처 중복지원");
            return true;
        }
        return false;
    }
}