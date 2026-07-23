package com.nuri.woorilink.dto;

/**
 * 보호자 홈 화면의 긴급 확인 요약 응답 DTO.
 *
 * 현재 집계 항목:
 * - 미처리 낙상 감지 알림
 * - 미처리 SOS 알림
 * - 생활안전 위험 알림
 * - 심각한 기상특보
 * - 오늘 안부 연속 3회 이상 미응답
 */
public record GuardianUrgentSummaryResponse(
        long totalCount,
        long fallCount,
        long sosCount,
        long lifeSafetyCount,
        long severeWeatherCount,
        long consecutiveMissedCheckInCount
) {
}