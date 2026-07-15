package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.RiskAssessment;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class RiskAssessmentDto {
    private Long id;
    private Long seniorId;
    private String seniorName;
    private Integer seniorAge;
    private Integer totalScore;
    private RiskAssessment.RiskLevel level;
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
    private String riskReason;
    private LocalDateTime assessedAt;
}
