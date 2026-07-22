package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.CheckInSchedule;
import com.nuri.woorilink.entity.CheckInScheduleTime;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * 보호자 화면에 반환할 자동 안부 확인 설정.
 */
public record CheckInScheduleResponse(

        Long id,

        Long seniorId,

        /**
         * 아직 DB에 설정이 저장되지 않았다면 false.
         */
        boolean configured,

        boolean enabled,

        /**
         * DIRECT 또는 INTERVAL.
         */
        CheckInSchedule.ScheduleMode scheduleMode,

        /**
         * 실제 자동 요청에 사용되는 시간 목록.
         *
         * DIRECT 방식:
         * 보호자가 입력한 시간 목록
         *
         * INTERVAL 방식:
         * 간격을 기준으로 시스템이 생성한 시간 목록
         */
        List<LocalTime> requestTimes,

        /**
         * 기존 React 화면 호환을 위한 단일 시간.
         *
         * requestTimes의 첫 번째 시간을 반환한다.
         */
        LocalTime requestTime,

        /**
         * INTERVAL 방식의 시간 간격.
         *
         * DIRECT 방식에서는 null일 수 있다.
         */
        Integer intervalHours,

        Integer timeoutMinutes,

        String timezone,

        /**
         * 기존 단일 시간 구조 호환 필드.
         */
        LocalDate lastSentDate,

        LocalDateTime createdAt,

        LocalDateTime updatedAt
) {

    private static final LocalTime DEFAULT_REQUEST_TIME =
            LocalTime.of(9, 0);

    private static final int DEFAULT_TIMEOUT_MINUTES =
            30;

    private static final String DEFAULT_TIMEZONE =
            "Asia/Seoul";

    /**
     * 아직 설정이 저장되지 않은 어르신에게
     * 보여줄 기본값.
     */
    public static CheckInScheduleResponse defaultSchedule(
            Long seniorId
    ) {
        return new CheckInScheduleResponse(
                null,
                seniorId,
                false,
                false,
                CheckInSchedule.ScheduleMode.DIRECT,
                List.of(
                        DEFAULT_REQUEST_TIME
                ),
                DEFAULT_REQUEST_TIME,
                null,
                DEFAULT_TIMEOUT_MINUTES,
                DEFAULT_TIMEZONE,
                null,
                null,
                null
        );
    }

    /**
     * 설정 Entity와 시간 목록을 응답 DTO로 변환한다.
     */
    public static CheckInScheduleResponse from(
            CheckInSchedule schedule,
            List<CheckInScheduleTime> scheduleTimes
    ) {
        List<LocalTime> requestTimes =
                scheduleTimes == null
                        ? List.of()
                        : scheduleTimes
                        .stream()
                        .map(
                                CheckInScheduleTime
                                        ::getRequestTime
                        )
                        .sorted()
                        .toList();

        /*
         * 새 시간 테이블에 데이터가 없다면
         * 기존 단일 requestTime을 임시로 사용한다.
         */
        if (requestTimes.isEmpty()
                && schedule.getRequestTime() != null) {

            requestTimes = List.of(
                    schedule.getRequestTime()
            );
        }

        LocalTime firstRequestTime =
                requestTimes.isEmpty()
                        ? DEFAULT_REQUEST_TIME
                        : requestTimes.get(0);

        CheckInSchedule.ScheduleMode scheduleMode =
                schedule.getScheduleMode() == null
                        ? CheckInSchedule
                        .ScheduleMode
                        .DIRECT
                        : schedule.getScheduleMode();

        return new CheckInScheduleResponse(
                schedule.getId(),
                schedule.getSeniorId(),
                true,
                Boolean.TRUE.equals(
                        schedule.getEnabled()
                ),
                scheduleMode,
                requestTimes,
                firstRequestTime,
                schedule.getIntervalHours(),
                schedule.getTimeoutMinutes(),
                schedule.getTimezone(),
                schedule.getLastSentDate(),
                schedule.getCreatedAt(),
                schedule.getUpdatedAt()
        );
    }

    /**
     * 기존 코드와의 호환을 위한 변환 메서드.
     *
     * 신규 서비스에서는 시간 목록을 받는
     * from(schedule, scheduleTimes)를 사용한다.
     */
    public static CheckInScheduleResponse from(
            CheckInSchedule schedule
    ) {
        return from(
                schedule,
                List.of()
        );
    }
}