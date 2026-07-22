package com.nuri.woorilink.dto;

import com.fasterxml.jackson.annotation.JsonFormat;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Spring에서 FastAPI 안부 분석 서버로 전달하는 요청.
 *
 * 날짜와 시간은 FastAPI가 인식할 수 있도록
 * ISO-8601 문자열 형식으로 전송한다.
 */
public record CheckInAnalysisRequest(

        Long seniorId,

        int periodDays,

        @JsonFormat(
                shape = JsonFormat.Shape.STRING,
                pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS"
        )
        LocalDateTime periodStart,

        @JsonFormat(
                shape = JsonFormat.Shape.STRING,
                pattern = "yyyy-MM-dd'T'HH:mm:ss.SSS"
        )
        LocalDateTime periodEnd,

        List<CheckInAnalysisRecordRequest> checkIns

) {
}