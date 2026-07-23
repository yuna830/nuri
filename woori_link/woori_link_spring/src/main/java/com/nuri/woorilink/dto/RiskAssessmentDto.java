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
    private String weatherAlertName;

    /**
     * 기상청에서 내려준 특보 설명 또는 제목.
     */
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

    private String riskReason;

    private LocalDateTime assessedAt;
}