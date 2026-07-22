package com.nuri.woorilink.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDateTime;

/**
 * Spring이 FastAPI에 전달하는 개별 안부 기록.
 *
 * 이름, 전화번호, 주소 등 개인정보는 포함하지 않는다.
 *
 * 날짜와 시간은 FastAPI가 인식할 수 있도록
 * ISO-8601 문자열 형식으로 전송한다.
 */
public record CheckInAnalysisRecordRequest(

        Long checkInId,

        String status,

        @JsonFormat(
                shape = JsonFormat.Shape.STRING,
                pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS"
        )
        LocalDateTime requestedAt,

        @JsonFormat(
                shape = JsonFormat.Shape.STRING,
                pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS"
        )
        LocalDateTime respondedAt

) {
}