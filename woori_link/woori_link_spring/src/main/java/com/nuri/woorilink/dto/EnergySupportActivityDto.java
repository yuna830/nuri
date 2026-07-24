package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergySupportCase;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EnergySupportActivityDto(
        Long id,
        EnergySupportCase.SupportStatus status,
        EnergySupportCase.ExistingApplicationStatus existingApplicationStatus,
        EnergySupportCase.ApplicationIntent applicationIntent,
        EnergySupportCase.DeclineReason declineReason,
        String contactMethod,
        LocalDate nextActionDate,
        String note,
        String updatedByRole,
        Long updatedById,
        String changeSummary,
        LocalDateTime createdAt
) {}
