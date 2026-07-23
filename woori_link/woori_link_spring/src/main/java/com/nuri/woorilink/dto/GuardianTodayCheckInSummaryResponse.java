package com.nuri.woorilink.dto;

public record GuardianTodayCheckInSummaryResponse(
        long seniorCountWithMissed,
        long requestCount,
        long respondedCount,
        long missedCount
) {
}
