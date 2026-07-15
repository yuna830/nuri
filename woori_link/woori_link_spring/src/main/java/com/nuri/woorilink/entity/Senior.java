package com.nuri.woorilink.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;

@Entity
@Table(name = "wl_seniors")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Senior {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Transient
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    public Integer getAge() {
        if (birthDate == null) {
            return null;
        }

        return Period.between(birthDate, LocalDate.now()).getYears();
    }

    private String address;
    private Double latitude;
    private Double longitude;
    private String phone;
    private String gender;

    @Enumerated(EnumType.STRING)
    private IncomeLevel incomeLevel;

    private String disabilityGrade;
    private Boolean longTermCare;
    private Boolean livingAlone;
    private String householdType;
    private String gasType;
    private String housingType;

    private Boolean energyVoucherApplied;
    private Boolean electricityDiscountApplied;
    private Boolean gasDiscountApplied;
    private Boolean electricityDiscountEligible;
    private Boolean gasDiscountEligible;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private FeatureStatus aiCheckStatus = FeatureStatus.INACTIVE;
    private Boolean aiConsecutiveNoResponse;
    private Boolean aiCheckResolved;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private FeatureStatus locationStatus = FeatureStatus.INACTIVE;
    private Boolean unresolvedGeofenceExit;
    private Boolean locationEventResolved;

    private Long guardianId;
    private Long welfareWorkerId;

    // 에너지바우처 소득기준
    private Boolean livelihoodBenefit;
    private Boolean medicalBenefit;
    private Boolean housingBenefit;
    private Boolean educationBenefit;

    // 에너지바우처 세대원 특성기준
    private Boolean elderlyHouseholdMember;
    private Boolean infantHouseholdMember;
    private Boolean disabledHouseholdMember;
    private Boolean pregnantHouseholdMember;
    private Boolean severeDiseaseHouseholdMember;
    private Boolean rareDiseaseHouseholdMember;
    private Boolean intractableDiseaseHouseholdMember;
    private Boolean singleParentFamily;
    private Boolean childHeadedHousehold;
    private Boolean multiChildHousehold;

    // 지원 제외 / 중복지원
    private Boolean allMembersInFacility;
    private Boolean winterFuelSupport;
    private Boolean coalCoupon;
    private Boolean coalEnergyVoucher;

    // 판정 결과
    private Boolean energyVoucherEligible;
    private String energyVoucherReason;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum IncomeLevel {
        LIVELIHOOD,
        MEDICAL,
        HOUSING,
        EDUCATION,
        NONE
    }

    public enum FeatureStatus {
        INACTIVE, ACTIVE
    }
}
