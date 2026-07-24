package com.nuri.woorilink.dto;

import java.time.LocalDateTime;

public record WelfareWorkAlertDto(
        String id,
        String category,
        String severity,
        String title,
        String message,
        Long seniorId,
        String actionType,
        String registrationSource,
        LocalDateTime createdAt
) {
}
