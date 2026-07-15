package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_risk_assessments")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RiskAssessment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private Integer totalScore;

    @Enumerated(EnumType.STRING)
    private RiskLevel level;

    private Boolean weatherRisk;
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

    public enum RiskLevel { LOW, MEDIUM, HIGH }
}
