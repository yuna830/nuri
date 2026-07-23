package com.nuri.woorilink.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_risk_assessments")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RiskAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;

    private Integer totalScore;

    @Enumerated(EnumType.STRING)
    private RiskLevel level;

    /**
     * 현재 유효한 심각 기상특보 존재 여부.
     */
    private Boolean weatherRisk;

    /**
     * 화면에 표시할 특보명.
     *
     * 예:
     * 폭염경보
     * 호우경보
     * 한파주의보
     */
    @Column(length = 100)
    private String weatherAlertName;

    /**
     * 기상청에서 내려준 특보 설명 또는 제목.
     *
     * 예:
     * 서울특별시 동작구 폭염경보 발표
     */
    @Column(length = 500)
    private String weatherDescription;

    /**
     * 기상특보 발표 시각.
     */
    private LocalDateTime weatherIssuedAt;

    private Boolean recallRisk;

    private Boolean recallUsageUnknown;

    private Boolean safetyRisk;

    private Boolean safetyInspectionOverdue;

    private Boolean overdueAction;

    private Boolean delayedVisit;

    private Boolean repeatedIssue;

    private Boolean aiNoResponse;

    private Boolean locationAnomaly;

    private Boolean livingAlone;

    private Boolean guardianMissing;

    private Boolean longTermCare;

    private Boolean severeDisability;

    private Boolean voucherUnapplied;

    private Boolean discountUnapplied;

    private Integer actualRiskScore;

    private Integer delayScore;

    private Integer vulnerabilityScore;

    @Column(length = 500)
    private String riskReason;

    @CreationTimestamp
    private LocalDateTime assessedAt;

    public enum RiskLevel {
        LOW,
        MEDIUM,
        HIGH
    }
}