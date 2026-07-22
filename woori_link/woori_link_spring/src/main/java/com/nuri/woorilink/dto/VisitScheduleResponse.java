package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.VisitSchedule;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record VisitScheduleResponse(
        Long id,
        Long seniorId,
        String seniorName,
        Long welfareWorkerId,
        LocalDate visitDate,
        String visitTime,
        String purpose,
        String note,
        VisitSchedule.VisitStatus status,
        LocalDateTime createdAt
) {
}
