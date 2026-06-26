package com.nuri.woorilink.domain.risk.dto;

import com.nuri.woorilink.domain.risk.entity.RiskAssessment;
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
    private Boolean voucherUnapplied;
    private String riskReason;
    private LocalDateTime assessedAt;
}
