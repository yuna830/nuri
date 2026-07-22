package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.CheckIn;
import com.nuri.woorilink.entity.CheckInSchedule;
import com.nuri.woorilink.entity.CheckInScheduleTime;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.CheckInRepository;
import com.nuri.woorilink.repository.CheckInScheduleRepository;
import com.nuri.woorilink.repository.CheckInScheduleTimeRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 설정된 여러 시간에 맞춰 자동 안부 요청을 생성한다.
 *
 * 설정 시간부터 허용 범위 안에서만 요청을 생성한다.
 *
 * 예:
 * 설정 시간 18:00
 * 허용 범위 5분
 *
 * 18:00 ~ 18:04:59 사이에만 요청 생성
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckInAutoRequestService {

    private static final String DEFAULT_TIMEZONE =
            "Asia/Seoul";

    private static final LocalTime DEFAULT_REQUEST_TIME =
            LocalTime.of(
                    9,
                    0
            );

    /**
     * 설정 시간 이후 자동 요청을 생성할 수 있는 허용 범위.
     *
     * 스케줄러가 매분 실행되므로 5분이면
     * 서버가 잠시 지연돼도 요청을 놓치지 않는다.
     */
    private static final long SEND_WINDOW_MINUTES =
            5L;

    private final CheckInScheduleRepository
            checkInScheduleRepository;

    private final CheckInScheduleTimeRepository
            checkInScheduleTimeRepository;

    private final CheckInRepository
            checkInRepository;

    private final SeniorRepository
            seniorRepository;

    private final FcmPushService
            fcmPushService;

    /**
     * 특정 자동 안부 설정에 포함된 모든 시간을 확인하고,
     * 현재 시각이 발송 허용 범위 안에 있는 요청만 생성한다.
     *
     * 예:
     * 설정 시간 = 09:00, 12:00, 18:00
     * 현재 시간 = 18:02
     *
     * 09:00 → 지난 요청, 생성 안 함
     * 12:00 → 지난 요청, 생성 안 함
     * 18:00 → 허용 범위 안, 생성
     */
    @Transactional
    public AutoRequestResult createIfDue(
            Long scheduleId
    ) {
        CheckInSchedule schedule =
                checkInScheduleRepository
                        .findById(
                                scheduleId
                        )
                        .orElse(null);

        if (schedule == null) {
            return AutoRequestResult.notCreated(
                    AutoRequestStatus.NOT_FOUND
            );
        }

        if (!Boolean.TRUE.equals(
                schedule.getEnabled()
        )) {
            return AutoRequestResult.notCreated(
                    AutoRequestStatus.DISABLED
            );
        }

        ZoneId zoneId = resolveZoneId(
                schedule.getTimezone()
        );

        ZonedDateTime now =
                ZonedDateTime.now(
                        zoneId
                );

        LocalDate today =
                now.toLocalDate();

        LocalTime currentTime =
                now.toLocalTime();

        List<CheckInScheduleTime> scheduleTimes =
                getOrCreateScheduleTimes(
                        schedule
                );

        if (scheduleTimes.isEmpty()) {
            log.warn(
                    "Automatic check-in schedule has no request times. "
                            + "scheduleId={}, seniorId={}",
                    schedule.getId(),
                    schedule.getSeniorId()
            );

            return AutoRequestResult.notCreated(
                    AutoRequestStatus.INVALID
            );
        }

        Senior senior =
                seniorRepository
                        .findById(
                                schedule.getSeniorId()
                        )
                        .orElseThrow(
                                () -> new IllegalArgumentException(
                                        "Senior not found: "
                                                + schedule.getSeniorId()
                                )
                        );

        int timeoutMinutes =
                normalizeTimeoutMinutes(
                        schedule.getTimeoutMinutes()
                );

        List<Long> createdCheckInIds =
                new ArrayList<>();

        boolean hasFutureTime =
                false;

        boolean hasAlreadySentTime =
                false;

        boolean hasExpiredTime =
                false;

        for (
                CheckInScheduleTime scheduleTime
                : scheduleTimes
        ) {
            LocalTime requestTime =
                    scheduleTime.getRequestTime();

            if (requestTime == null) {
                log.warn(
                        "Automatic check-in schedule time is invalid. "
                                + "scheduleTimeId={}, scheduleId={}",
                        scheduleTime.getId(),
                        schedule.getId()
                );

                continue;
            }

            /*
             * 아직 설정 시간이 되지 않은 경우.
             */
            if (currentTime.isBefore(
                    requestTime
            )) {
                hasFutureTime = true;

                continue;
            }

            /*
             * 오늘 이미 해당 시간의 요청을 처리한 경우.
             */
            if (today.equals(
                    scheduleTime.getLastSentDate()
            )) {
                hasAlreadySentTime = true;

                continue;
            }

            /*
             * 설정 시간으로부터 현재까지
             * 몇 분이 지났는지 계산한다.
             */
            long elapsedMinutes =
                    Duration.between(
                            requestTime,
                            currentTime
                    ).toMinutes();

            /*
             * 설정 시간으로부터 5분이 지났다면
             * 과거 요청을 몰아서 생성하지 않는다.
             *
             * 이 시간은 오늘 처리된 것으로 표시하여
             * 매분 반복 확인하지 않도록 한다.
             */
            if (elapsedMinutes
                    >= SEND_WINDOW_MINUTES) {

                scheduleTime.setLastSentDate(
                        today
                );

                checkInScheduleTimeRepository.save(
                        scheduleTime
                );

                hasExpiredTime = true;

                log.info(
                        "Automatic check-in skipped because send window expired. "
                                + "scheduleId={}, scheduleTimeId={}, "
                                + "seniorId={}, scheduledDate={}, "
                                + "scheduledTime={}, currentTime={}, "
                                + "elapsedMinutes={}",
                        schedule.getId(),
                        scheduleTime.getId(),
                        senior.getId(),
                        today,
                        requestTime,
                        currentTime,
                        elapsedMinutes
                );

                continue;
            }

            boolean alreadyExists =
                    checkInRepository
                            .existsBySeniorIdAndRequestTypeAndScheduledDateAndScheduledTime(
                                    senior.getId(),
                                    CheckIn.RequestType.AUTOMATIC,
                                    today,
                                    requestTime
                            );

            /*
             * 시간 테이블의 lastSentDate가 유실돼도
             * CheckIn 기록을 기준으로 중복 생성을 차단한다.
             */
            if (alreadyExists) {
                scheduleTime.setLastSentDate(
                        today
                );

                checkInScheduleTimeRepository.save(
                        scheduleTime
                );

                hasAlreadySentTime = true;

                continue;
            }

            CheckIn checkIn =
                    checkInRepository.save(
                            CheckIn.builder()
                                    .seniorId(
                                            senior.getId()
                                    )
                                    .status(
                                            CheckIn.Status.PENDING
                                    )
                                    .requestType(
                                            CheckIn.RequestType.AUTOMATIC
                                    )
                                    .scheduledDate(
                                            today
                                    )
                                    .scheduledTime(
                                            requestTime
                                    )
                                    .requestedAt(
                                            now.toLocalDateTime()
                                    )
                                    .timeoutMinutes(
                                            timeoutMinutes
                                    )
                                    .build()
                    );

            /*
             * 같은 날짜와 같은 시간으로
             * 다시 발송하지 않도록 처리 날짜를 기록한다.
             */
            scheduleTime.setLastSentDate(
                    today
            );

            checkInScheduleTimeRepository.save(
                    scheduleTime
            );

            /*
             * 기존 단일 시간 호환 컬럼도 갱신한다.
             *
             * 신규 중복 방지는 scheduleTime의
             * lastSentDate를 기준으로 처리한다.
             */
            schedule.setLastSentDate(
                    today
            );

            checkInScheduleRepository.save(
                    schedule
            );

            createdCheckInIds.add(
                    checkIn.getId()
            );

            /*
             * FCM 발송에 실패해도 CheckIn 기록은 유지한다.
             */
            sendPushSafely(
                    senior,
                    checkIn,
                    requestTime
            );

            log.info(
                    "Automatic check-in created. "
                            + "scheduleId={}, scheduleTimeId={}, "
                            + "seniorId={}, checkInId={}, "
                            + "scheduledDate={}, scheduledTime={}, "
                            + "currentTime={}",
                    schedule.getId(),
                    scheduleTime.getId(),
                    senior.getId(),
                    checkIn.getId(),
                    today,
                    requestTime,
                    currentTime
            );
        }

        if (!createdCheckInIds.isEmpty()) {
            return AutoRequestResult.created(
                    createdCheckInIds
            );
        }

        if (hasAlreadySentTime) {
            return AutoRequestResult.notCreated(
                    AutoRequestStatus.ALREADY_SENT
            );
        }

        if (hasExpiredTime) {
            return AutoRequestResult.notCreated(
                    AutoRequestStatus.EXPIRED
            );
        }

        if (hasFutureTime) {
            return AutoRequestResult.notCreated(
                    AutoRequestStatus.NOT_DUE
            );
        }

        return AutoRequestResult.notCreated(
                AutoRequestStatus.INVALID
        );
    }

    /**
     * 새 다중 시간 테이블을 조회한다.
     *
     * 시간 데이터가 아직 없다면 기존 requestTime을 사용해
     * 시간 행을 자동 생성하여 이전 데이터와 호환한다.
     */
    private List<CheckInScheduleTime> getOrCreateScheduleTimes(
            CheckInSchedule schedule
    ) {
        List<CheckInScheduleTime> scheduleTimes =
                checkInScheduleTimeRepository
                        .findByScheduleIdOrderByRequestTimeAsc(
                                schedule.getId()
                        );

        if (!scheduleTimes.isEmpty()) {
            return scheduleTimes;
        }

        LocalTime legacyRequestTime =
                schedule.getRequestTime() == null
                        ? DEFAULT_REQUEST_TIME
                        : schedule.getRequestTime();

        CheckInScheduleTime migratedTime =
                checkInScheduleTimeRepository.save(
                        CheckInScheduleTime
                                .builder()
                                .scheduleId(
                                        schedule.getId()
                                )
                                .requestTime(
                                        legacyRequestTime
                                )
                                .lastSentDate(
                                        schedule.getLastSentDate()
                                )
                                .build()
                );

        log.info(
                "Legacy check-in schedule time migrated. "
                        + "scheduleId={}, seniorId={}, requestTime={}",
                schedule.getId(),
                schedule.getSeniorId(),
                legacyRequestTime
        );

        return List.of(
                migratedTime
        );
    }

    /**
     * 어르신 앱으로 자동 안부 요청 푸시를 보낸다.
     */
    private void sendPushSafely(
            Senior senior,
            CheckIn checkIn,
            LocalTime scheduledTime
    ) {
        try {
            fcmPushService.sendToSenior(
                    senior.getId(),

                    "오늘의 안부 확인",

                    "현재 상태가 괜찮은지 알려주세요.",

                    Map.of(
                            "type",
                            "CHECK_IN_REQUEST",

                            "seniorId",
                            String.valueOf(
                                    senior.getId()
                            ),

                            "checkInId",
                            String.valueOf(
                                    checkIn.getId()
                            ),

                            "scheduledDate",
                            String.valueOf(
                                    checkIn.getScheduledDate()
                            ),

                            "scheduledTime",
                            String.valueOf(
                                    scheduledTime
                            )
                    )
            );

            log.info(
                    "Automatic check-in push sent. "
                            + "seniorId={}, checkInId={}, scheduledTime={}",
                    senior.getId(),
                    checkIn.getId(),
                    scheduledTime
            );

        } catch (RuntimeException exception) {
            log.warn(
                    "Automatic check-in was created, "
                            + "but push delivery failed. "
                            + "seniorId={}, checkInId={}, "
                            + "scheduledTime={}, reason={}",
                    senior.getId(),
                    checkIn.getId(),
                    scheduledTime,
                    exception.getMessage()
            );
        }
    }

    /**
     * 자동 안부 요청에 저장할 응답 제한 시간을 정리한다.
     */
    private int normalizeTimeoutMinutes(
            Integer timeoutMinutes
    ) {
        if (timeoutMinutes == null) {
            return 30;
        }

        if (timeoutMinutes < 5) {
            return 5;
        }

        if (timeoutMinutes > 180) {
            return 180;
        }

        return timeoutMinutes;
    }

    /**
     * 잘못된 시간대가 저장돼 있으면
     * Asia/Seoul을 사용한다.
     */
    private ZoneId resolveZoneId(
            String timezone
    ) {
        String normalizedTimezone =
                timezone == null
                        || timezone.isBlank()
                        ? DEFAULT_TIMEZONE
                        : timezone.trim();

        try {
            return ZoneId.of(
                    normalizedTimezone
            );

        } catch (DateTimeException exception) {
            log.warn(
                    "Invalid check-in timezone. "
                            + "timezone={}, fallback={}",
                    normalizedTimezone,
                    DEFAULT_TIMEZONE
            );

            return ZoneId.of(
                    DEFAULT_TIMEZONE
            );
        }
    }

    public enum AutoRequestStatus {
        CREATED,
        NOT_DUE,
        ALREADY_SENT,
        EXPIRED,
        DISABLED,
        NOT_FOUND,
        INVALID
    }

    public record AutoRequestResult(
            AutoRequestStatus status,
            List<Long> checkInIds
    ) {

        public static AutoRequestResult created(
                List<Long> checkInIds
        ) {
            return new AutoRequestResult(
                    AutoRequestStatus.CREATED,
                    List.copyOf(
                            checkInIds
                    )
            );
        }

        public static AutoRequestResult notCreated(
                AutoRequestStatus status
        ) {
            return new AutoRequestResult(
                    status,
                    List.of()
            );
        }

        public int createdCount() {
            return checkInIds.size();
        }
    }
}