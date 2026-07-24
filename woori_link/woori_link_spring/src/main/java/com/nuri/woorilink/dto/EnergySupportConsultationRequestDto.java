package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergySupportConsultationRequest;

import java.time.LocalDateTime;
import java.util.List;

public record EnergySupportConsultationRequestDto(
        Long id,
        Long seniorId,
        String seniorName,
        Long guardianId,
        Long welfareWorkerId,
        Integer missingCount,
        List<String> missingInformation,
        String requestMessage,
        EnergySupportConsultationRequest.ConsultationStatus status,
        Long resolvedBy,
        String resolutionNote,
        LocalDateTime resolvedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}