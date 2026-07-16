package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.Senior;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class SeniorProfileUpdateRequest {
    private String name;
    private LocalDate birthDate;
    private String gender;
    private String phone;
    private String address;
    private String detailAddress;
    private Long guardianId;
    private String householdType;
    private String housingType;
    private Boolean livingAlone;
    private String disabilityGrade;
    private Boolean longTermCare;
    private Senior.IncomeLevel incomeLevel;
    private Boolean livelihoodBenefit;
    private Boolean medicalBenefit;
    private Boolean housingBenefit;
    private Boolean educationBenefit;
    private Boolean energyVoucherEligible;
    private Boolean energyVoucherApplied;
    private Boolean electricityDiscountEligible;
    private Boolean electricityDiscountApplied;
    private Boolean gasDiscountEligible;
    private Boolean gasDiscountApplied;
}
