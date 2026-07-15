package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergySupportCase;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record EnergySupportActivityDto(
        Long id,
        EnergySupportCase.SupportStatus status,
        String contactMethod,
        LocalDate nextActionDate,
        String note,
        LocalDateTime createdAt
) {}
