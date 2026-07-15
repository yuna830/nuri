package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergySupportCase;
import com.nuri.woorilink.entity.Senior;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record EnergySupportCaseDto(
        Long caseId,
        Long seniorId,
        String seniorName,
        Integer seniorAge,
        String address,
        Senior.IncomeLevel incomeLevel,
        String disabilityGrade,
        EnergySupportCase.SupportType supportType,
        boolean eligibilityPossible,
        EnergySupportCase.EligibilityLevel eligibilityLevel,
        String eligibilityReason,
        List<String> missingInformation,
        EnergySupportCase.ExistingApplicationStatus existingApplicationStatus,
        EnergySupportCase.ApplicationIntent applicationIntent,
        EnergySupportCase.DeclineReason declineReason,
        EnergySupportCase.SupportStatus status,
        String contactMethod,
        LocalDate nextActionDate,
        String note,
        LocalDateTime updatedAt,
        List<EnergySupportActivityDto> history
) {}
