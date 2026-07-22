package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.CheckInSchedule;

import java.time.LocalTime;
import java.util.List;

/**
 * 보호자가 자동 안부 확인 설정을
 * 저장하거나 수정할 때 사용하는 요청 DTO.
 *
 * DIRECT 예:
 * {
 *   "enabled": true,
 *   "scheduleMode": "DIRECT",
 *   "requestTimes": [
 *     "09:00",
 *     "12:00",
 *     "18:00"
 *   ],
 *   "intervalHours": null,
 *   "timeoutMinutes": 30,
 *   "timezone": "Asia/Seoul"
 * }
 *
 * INTERVAL 예:
 * {
 *   "enabled": true,
 *   "scheduleMode": "INTERVAL",
 *   "requestTimes": [],
 *   "intervalHours": 6,
 *   "timeoutMinutes": 30,
 *   "timezone": "Asia/Seoul"
 * }
 */
public record CheckInScheduleRequest(

        /**
         * 자동 안부 요청 사용 여부.
         */
        boolean enabled,

        /**
         * 발송 방식.
         *
         * DIRECT:
         * 보호자가 시간을 직접 여러 개 지정한다.
         *
         * INTERVAL:
         * 일정한 시간 간격으로 발송한다.
         */
        CheckInSchedule.ScheduleMode scheduleMode,

        /**
         * 직접 설정한 자동 요청 시간 목록.
         *
         * DIRECT 방식에서 사용한다.
         *
         * 예:
         * [
         *   "09:00",
         *   "12:00",
         *   "18:00"
         * ]
         */
        List<LocalTime> requestTimes,

        /**
         * 기존 단일 시간 요청과의 호환 필드.
         *
         * 이전 React 화면이 requestTime만 전송하는 경우
         * requestTimes가 비어 있으면 이 값을 사용한다.
         *
         * 새로운 화면에서는 requestTimes를 사용한다.
         */
        LocalTime requestTime,

        /**
         * 간격 발송 시간.
         *
         * INTERVAL 방식에서 사용한다.
         *
         * 예:
         * 6시간 간격이면 6
         */
        Integer intervalHours,

        /**
         * 응답을 기다릴 시간.
         *
         * 5분 이상 180분 이하만 허용한다.
         */
        Integer timeoutMinutes,

        /**
         * 시간대.
         *
         * 기본값:
         * Asia/Seoul
         */
        String timezone
) {
}