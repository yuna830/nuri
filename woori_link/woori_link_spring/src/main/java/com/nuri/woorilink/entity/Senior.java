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
        BASIC_LIVELIHOOD, NEAR_POVERTY, LOWER_MIDDLE, MIDDLE, UPPER
    }
}
