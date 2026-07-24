package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergySupportConsultationRequest;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record EnergySupportConsultationRequestDto(
        Long id,

        Long seniorId,

        String seniorName,

        Long guardianId,

        String guardianDisplayName,

        Long welfareWorkerId,

        Integer missingCount,

        List<String> missingInformation,

        String requestMessage,

        EnergySupportConsultationRequest.ConsultationStatus status,

        LocalDate consultationDate,

        String availableStartTime,

        String availableEndTime,

        EnergySupportConsultationRequest.ConsultationMethod
        consultationMethod,

        EnergySupportConsultationRequest.ScheduleStatus
        scheduleStatus,

        EnergySupportConsultationRequest.ScheduleProposedBy
        scheduleProposedBy,

        String scheduleMessage,

        LocalDateTime scheduleProposedAt,

        LocalDateTime scheduleRespondedAt,

        Long resolvedBy,

        String resolutionNote,

        LocalDateTime resolvedAt,

        LocalDateTime createdAt,

        LocalDateTime updatedAt
) {
}