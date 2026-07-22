package com.nuri.woorilink.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDateTime;
import java.util.List;

/**
 * FastAPI가 계산한 안부 분석 결과.
 *
 * Spring은 이 값을 별도로 재계산하지 않고
 * 권한 검증을 거쳐 React에 반환한다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record CheckInAnalysisResponse(

        Long seniorId,

        int periodDays,

        LocalDateTime periodStart,

        LocalDateTime periodEnd,

        boolean hasData,

        boolean hasClosedData,

        long requestCount,

        long closedRequestCount,

        long respondedCount,

        long missedCount,

        long pendingCount,

        Double responseRate,

        Double averageResponseMinutes,

        int consecutiveMissedCount,

        List<MissedCheckInResponse> missedRecords,

        String latestStatus,

        LocalDateTime latestRequestedAt,

        LocalDateTime latestRespondedAt,

        CheckInAnalysisLevel riskLevel,

        String riskLabel,

        List<String> riskReasons,

        /**
         * 보호자에게 보여줄 최종 안내 문구.
         */
        String guardianSummary,

        /**
         * GEMINI 또는 RULE_BASED.
         */
        CheckInSummarySource summarySource,

        LocalDateTime calculatedAt

) {
}