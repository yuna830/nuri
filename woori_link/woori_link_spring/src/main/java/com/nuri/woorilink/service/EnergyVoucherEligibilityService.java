package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergyVoucherResult;
import com.nuri.woorilink.entity.Senior;
import org.springframework.stereotype.Service;

@Service
public class EnergyVoucherEligibilityService {

    public EnergyVoucherResult evaluate(Senior senior) {
        boolean incomeOk = senior.getIncomeLevel() == Senior.IncomeLevel.LIVELIHOOD
                || senior.getIncomeLevel() == Senior.IncomeLevel.MEDICAL
                || senior.getIncomeLevel() == Senior.IncomeLevel.HOUSING
                || senior.getIncomeLevel() == Senior.IncomeLevel.EDUCATION;

        boolean householdOk = isElderly(senior)
                || hasText(senior.getDisabilityGrade())
                || Boolean.TRUE.equals(senior.getPregnant())
                || Boolean.TRUE.equals(senior.getSevereDisease())
                || Boolean.TRUE.equals(senior.getRareDisease())
                || Boolean.TRUE.equals(senior.getSingleParentFamily())
                || Boolean.TRUE.equals(senior.getChildHeadedHousehold())
                || Boolean.TRUE.equals(senior.getMultiChildHousehold());

        if (!incomeOk) {
            return new EnergyVoucherResult(false, "소득기준 미충족");
        }

        if (!householdOk) {
            return new EnergyVoucherResult(false, "세대원 특성기준 미충족");
        }

        return new EnergyVoucherResult(true, "소득기준 및 세대원 특성기준 충족");
    }

    private boolean isElderly(Senior senior) {
        return senior.getAge() != null && senior.getAge() >= 65;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}