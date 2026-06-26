package com.nuri.woorilink.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_seniors")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Senior {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @JsonIgnore
    private String password;

    private Integer age;
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

    private Long guardianId;
    private Long welfareWorkerId;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum IncomeLevel {
        LIVELIHOOD,   // 생계급여
        MEDICAL,      // 의료급여
        HOUSING,      // 주거급여
        EDUCATION,    // 교육급여
        NONE
    }

    private Boolean energyVoucherEligible;
    private String energyVoucherReason;

    private Boolean severeDisease;
    private Boolean rareDisease;
    private Boolean pregnant;
    private Boolean singleParentFamily;
    private Boolean childHeadedHousehold;
    private Boolean multiChildHousehold;
}
