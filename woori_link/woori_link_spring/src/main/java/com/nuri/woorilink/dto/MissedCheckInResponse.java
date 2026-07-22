package com.nuri.woorilink.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.LocalDateTime;

/**
 * 미응답으로 종료된 안부 요청 정보.
 *
 * requestedAt은 미응답 처리 시각이 아니라
 * 보호자가 안부 요청을 보낸 시각이다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record MissedCheckInResponse(

        Long checkInId,

        LocalDateTime requestedAt

) {
}