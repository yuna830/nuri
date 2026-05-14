package com.nuri.woori.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "health_info")
public class HealthInfo {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private String healthStatus;
    private BigDecimal height;
    private BigDecimal weight;
    private String bloodPressure;
    private String smoking;
    private String drinking;
    private String allergies;
    private String medicineCount;

    @Column(columnDefinition = "TEXT")
    private String medicationsJson;

    private String diabetes;
    private String hypertension;
    private String heartDisease;
    private String jointDisease;
    private String stroke;
    private String kidneyDisease;
    private String lungDisease;
    private String liverDisease;
    private String cancer;
    private String walkingAid;
    private String dementia;
    private String vision;
    private String hearing;
    private String recentFall;
    private String hasSurgery;

    @Column(columnDefinition = "TEXT")
    private String surgeryDetail;

    @Column(columnDefinition = "TEXT")
    private String otherDisease;

    private String maxHours;
    private String maxDistance;

    @Column(columnDefinition = "TEXT")
    private String disabledWork;

    private LocalDateTime createdAt = LocalDateTime.now();
}
