package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.CheckInScheduleRequest;
import com.nuri.woorilink.dto.CheckInScheduleResponse;
import com.nuri.woorilink.entity.CheckInSchedule;
import com.nuri.woorilink.entity.CheckInScheduleTime;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.CheckInScheduleRepository;
import com.nuri.woorilink.repository.CheckInScheduleTimeRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.DateTimeException;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 어르신별 자동 안부 확인 설정을 관리한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CheckInScheduleService {

    private static final int MIN_TIMEOUT_MINUTES =
            5;

    private static final int MAX_TIMEOUT_MINUTES =
            180;

    private static final int DEFAULT_TIMEOUT_MINUTES =
            30;

    private static final String DEFAULT_TIMEZONE =
            "Asia/Seoul";

    private static final LocalTime DEFAULT_REQUEST_TIME =
            LocalTime.of(
                    9,
                    0
            );

    /**
     * 직접 설정 방식에서 허용할 최대 요청 시간 개수.
     *
     * 지나치게 많은 자동 요청 생성을 막기 위해
     * 하루 최대 8회로 제한한다.
     */
    private static final int MAX_REQUEST_TIME_COUNT =
            8;

    /**
     * 간격 발송에서 허용할 시간 간격.
     *
     * 24시간을 정확히 나눌 수 있는 값만 허용한다.
     */
    private static final Set<Integer>
            ALLOWED_INTERVAL_HOURS =
            Set.of(
                    1,
                    2,
                    3,
                    4,
                    6,
                    8,
                    12,
                    24
            );

    private final CheckInScheduleRepository
            checkInScheduleRepository;

    private final CheckInScheduleTimeRepository
            checkInScheduleTimeRepository;

    private final SeniorRepository
            seniorRepository;

    /**
     * 자동 안부 확인 설정을 조회한다.
     *
     * 아직 저장된 설정이 없다면
     * 오전 9시, 응답 대기 30분을 기본값으로 반환한다.
     */
    public CheckInScheduleResponse getSchedule(
            Long seniorId,
            Long guardianId
    ) {
        Senior senior = requireSenior(
                seniorId
        );

        validateGuardianAccess(
                senior,
                guardianId
        );

        return checkInScheduleRepository
                .findBySeniorId(
                        seniorId
                )
                .map(
                        schedule -> {
                            List<CheckInScheduleTime>
                                    scheduleTimes =
                                    checkInScheduleTimeRepository
                                            .findByScheduleIdOrderByRequestTimeAsc(
                                                    schedule.getId()
                                            );

                            return CheckInScheduleResponse
                                    .from(
                                            schedule,
                                            scheduleTimes
                                    );
                        }
                )
                .orElseGet(
                        () -> CheckInScheduleResponse
                                .defaultSchedule(
                                        seniorId
                                )
                );
    }

    /**
     * 자동 안부 확인 설정을 새로 저장하거나 수정한다.
     *
     * 설정 기본 정보는 wl_check_in_schedules에 저장하고,
     * 실제 발송 시간은 wl_check_in_schedule_times에 저장한다.
     */
    @Transactional
    public CheckInScheduleResponse saveSchedule(
            Long seniorId,
            Long guardianId,
            CheckInScheduleRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Check-in schedule request is required"
            );
        }

        Senior senior = requireSenior(
                seniorId
        );

        validateGuardianAccess(
                senior,
                guardianId
        );

        CheckInSchedule.ScheduleMode
                scheduleMode =
                normalizeScheduleMode(
                        request.scheduleMode()
                );

        Integer timeoutMinutes =
                normalizeTimeoutMinutes(
                        request.timeoutMinutes()
                );

        String timezone =
                normalizeTimezone(
                        request.timezone()
                );

        Integer intervalHours =
                normalizeIntervalHours(
                        scheduleMode,
                        request.intervalHours()
                );

        List<LocalTime> requestTimes =
                resolveRequestTimes(
                        request,
                        scheduleMode,
                        intervalHours
                );

        CheckInSchedule schedule =
                checkInScheduleRepository
                        .findBySeniorId(
                                seniorId
                        )
                        .orElseGet(
                                () -> CheckInSchedule
                                        .builder()
                                        .seniorId(
                                                seniorId
                                        )
                                        .enabled(
                                                false
                                        )
                                        .scheduleMode(
                                                CheckInSchedule
                                                        .ScheduleMode
                                                        .DIRECT
                                        )
                                        .requestTime(
                                                DEFAULT_REQUEST_TIME
                                        )
                                        .timeoutMinutes(
                                                DEFAULT_TIMEOUT_MINUTES
                                        )
                                        .timezone(
                                                DEFAULT_TIMEZONE
                                        )
                                        .build()
                        );

        schedule.setEnabled(
                request.enabled()
        );

        schedule.setScheduleMode(
                scheduleMode
        );

        schedule.setIntervalHours(
                intervalHours
        );

        schedule.setTimeoutMinutes(
                timeoutMinutes
        );

        schedule.setTimezone(
                timezone
        );

        /*
         * 기존 request_time 컬럼이 아직 NOT NULL이므로
         * 새 시간 목록의 첫 번째 값을 함께 저장한다.
         *
         * 다중 시간 전환이 완료된 뒤
         * 별도 마이그레이션에서 기존 컬럼을 제거할 수 있다.
         */
        schedule.setRequestTime(
                requestTimes.get(0)
        );

        CheckInSchedule savedSchedule =
                checkInScheduleRepository.save(
                        schedule
                );

        /*
         * 기존 시간 목록을 전부 삭제하고
         * 새 요청 시간 목록으로 교체한다.
         */
        checkInScheduleTimeRepository
                .deleteByScheduleId(
                        savedSchedule.getId()
                );

        /*
         * DELETE SQL이 INSERT보다 먼저 실행되도록
         * 명시적으로 flush한다.
         *
         * 같은 시간을 다시 저장할 때
         * UNIQUE 제약조건 충돌이 발생하는 것을 방지한다.
         */
        checkInScheduleTimeRepository.flush();

        List<CheckInScheduleTime>
                savedScheduleTimes =
                requestTimes
                        .stream()
                        .map(
                                requestTime ->
                                        CheckInScheduleTime
                                                .builder()
                                                .scheduleId(
                                                        savedSchedule
                                                                .getId()
                                                )
                                                .requestTime(
                                                        requestTime
                                                )
                                                .lastSentDate(
                                                        null
                                                )
                                                .build()
                        )
                        .toList();

        savedScheduleTimes =
                checkInScheduleTimeRepository
                        .saveAll(
                                savedScheduleTimes
                        );

        return CheckInScheduleResponse.from(
                savedSchedule,
                savedScheduleTimes
        );
    }

    /**
     * 발송 방식을 정규화한다.
     *
     * 값이 없으면 기존 방식과 호환되도록
     * DIRECT를 사용한다.
     */
    private CheckInSchedule.ScheduleMode
    normalizeScheduleMode(
            CheckInSchedule.ScheduleMode
                    scheduleMode
    ) {
        if (scheduleMode == null) {
            return CheckInSchedule
                    .ScheduleMode
                    .DIRECT;
        }

        return scheduleMode;
    }

    /**
     * 최종 요청 시간 목록을 생성한다.
     */
    private List<LocalTime> resolveRequestTimes(
            CheckInScheduleRequest request,
            CheckInSchedule.ScheduleMode
                    scheduleMode,
            Integer intervalHours
    ) {
        if (scheduleMode
                == CheckInSchedule
                .ScheduleMode
                .INTERVAL) {

            return buildIntervalRequestTimes(
                    intervalHours
            );
        }

        return normalizeDirectRequestTimes(
                request.requestTimes(),
                request.requestTime()
        );
    }

    /**
     * 직접 입력한 시간 목록을 검증하고 정렬한다.
     *
     * requestTimes가 비어 있으면
     * 기존 단일 requestTime을 사용한다.
     */
    private List<LocalTime>
    normalizeDirectRequestTimes(
            List<LocalTime> requestTimes,
            LocalTime legacyRequestTime
    ) {
        List<LocalTime> sourceTimes =
                new ArrayList<>();

        if (requestTimes != null) {
            sourceTimes.addAll(
                    requestTimes
            );
        }

        /*
         * 기존 React 화면은 requestTime만 전송하므로
         * requestTimes가 없을 때만 호환 필드를 사용한다.
         */
        if (sourceTimes.isEmpty()
                && legacyRequestTime != null) {

            sourceTimes.add(
                    legacyRequestTime
            );
        }

        if (sourceTimes.isEmpty()) {
            throw new IllegalArgumentException(
                    "At least one request time is required"
            );
        }

        if (sourceTimes.stream().anyMatch(
                Objects::isNull
        )) {
            throw new IllegalArgumentException(
                    "Request time cannot be null"
            );
        }

        /*
         * 중복 제거 후 오름차순 정렬.
         */
        List<LocalTime> normalizedTimes =
                sourceTimes
                        .stream()
                        .distinct()
                        .sorted(
                                Comparator.naturalOrder()
                        )
                        .toList();

        if (normalizedTimes.size()
                > MAX_REQUEST_TIME_COUNT) {

            throw new IllegalArgumentException(
                    "Request times cannot exceed "
                            + MAX_REQUEST_TIME_COUNT
            );
        }

        return normalizedTimes;
    }

    /**
     * 간격 방식의 실제 요청 시간을 생성한다.
     *
     * 예:
     * intervalHours = 6
     *
     * 결과:
     * 00:00
     * 06:00
     * 12:00
     * 18:00
     */
    private List<LocalTime>
    buildIntervalRequestTimes(
            Integer intervalHours
    ) {
        if (intervalHours == null) {
            throw new IllegalArgumentException(
                    "Interval hours are required "
                            + "for interval mode"
            );
        }

        List<LocalTime> requestTimes =
                new ArrayList<>();

        for (
                int hour = 0;
                hour < 24;
                hour += intervalHours
        ) {
            requestTimes.add(
                    LocalTime.of(
                            hour,
                            0
                    )
            );
        }

        return requestTimes;
    }

    /**
     * INTERVAL 방식의 시간 간격을 검증한다.
     */
    private Integer normalizeIntervalHours(
            CheckInSchedule.ScheduleMode
                    scheduleMode,
            Integer intervalHours
    ) {
        if (scheduleMode
                == CheckInSchedule
                .ScheduleMode
                .DIRECT) {

            return null;
        }

        int normalizedInterval =
                intervalHours == null
                        ? 6
                        : intervalHours;

        if (!ALLOWED_INTERVAL_HOURS.contains(
                normalizedInterval
        )) {
            throw new IllegalArgumentException(
                    "Interval hours must be one of "
                            + ALLOWED_INTERVAL_HOURS
            );
        }

        return normalizedInterval;
    }

    /**
     * 응답 제한 시간을 검증한다.
     */
    private Integer normalizeTimeoutMinutes(
            Integer timeoutMinutes
    ) {
        int normalizedValue =
                timeoutMinutes == null
                        ? DEFAULT_TIMEOUT_MINUTES
                        : timeoutMinutes;

        if (normalizedValue
                < MIN_TIMEOUT_MINUTES
                || normalizedValue
                > MAX_TIMEOUT_MINUTES) {

            throw new IllegalArgumentException(
                    "Timeout minutes must be "
                            + "between 5 and 180"
            );
        }

        return normalizedValue;
    }

    /**
     * 시간대를 검증한다.
     */
    private String normalizeTimezone(
            String timezone
    ) {
        String normalizedTimezone =
                StringUtils.hasText(
                        timezone
                )
                        ? timezone.trim()
                        : DEFAULT_TIMEZONE;

        try {
            ZoneId.of(
                    normalizedTimezone
            );

            return normalizedTimezone;

        } catch (DateTimeException exception) {
            throw new IllegalArgumentException(
                    "Invalid timezone: "
                            + normalizedTimezone
            );
        }
    }

    /**
     * 어르신 존재 여부를 확인한다.
     */
    private Senior requireSenior(
            Long seniorId
    ) {
        if (seniorId == null
                || seniorId <= 0) {

            throw new IllegalArgumentException(
                    "Senior ID must be greater than zero"
            );
        }

        return seniorRepository
                .findById(
                        seniorId
                )
                .orElseThrow(
                        () -> new IllegalArgumentException(
                                "Senior not found: "
                                        + seniorId
                        )
                );
    }

    /**
     * 로그인한 보호자가 해당 어르신과
     * 연결되어 있는지 확인한다.
     */
    private void validateGuardianAccess(
            Senior senior,
            Long guardianId
    ) {
        if (guardianId == null) {
            throw new AccessDeniedException(
                    "Guardian authentication is required"
            );
        }

        if (!Objects.equals(
                senior.getGuardianId(),
                guardianId
        )) {
            throw new AccessDeniedException(
                    "You can only manage the schedule "
                            + "of your assigned senior"
            );
        }
    }
}