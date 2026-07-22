package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.CareEvent;
import com.nuri.woorilink.entity.CheckIn;
import com.nuri.woorilink.repository.CareEventRepository;
import com.nuri.woorilink.repository.CheckInRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * 응답 제한 시간이 지난 안부 요청을
 * 미응답 상태로 변경한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckInMissedService {

    private static final int DEFAULT_TIMEOUT_MINUTES =
            30;

    private static final int MIN_TIMEOUT_MINUTES =
            5;

    private static final int MAX_TIMEOUT_MINUTES =
            180;

    private final CheckInRepository
            checkInRepository;

    private final CareEventRepository
            careEventRepository;

    private final CareMonitoringService
            careMonitoringService;

    /**
     * 지정한 안부 요청이 응답 제한 시간을 넘겼다면
     * PENDING 상태를 MISSED로 변경한다.
     *
     * 스케줄러에서 조회한 뒤 실제 처리 직전에
     * DB 상태를 다시 확인하므로,
     * 그 사이 님이 응답했다면 변경하지 않는다.
     */
    @Transactional
    public boolean markMissedIfExpired(
            Long checkInId,
            LocalDateTime currentTime
    ) {
        CheckIn checkIn =
                checkInRepository
                        .findById(checkInId)
                        .orElse(null);

        if (checkIn == null) {
            return false;
        }

        /*
         * 이미 응답했거나 이전 실행에서
         * 미응답 처리된 요청은 건드리지 않는다.
         */
        if (checkIn.getStatus()
                != CheckIn.Status.PENDING) {

            return false;
        }

        if (checkIn.getRequestedAt() == null) {
            log.warn(
                    "Pending check-in has no requestedAt. "
                            + "checkInId={}, seniorId={}",
                    checkIn.getId(),
                    checkIn.getSeniorId()
            );

            return false;
        }

        int timeoutMinutes =
                normalizeTimeoutMinutes(
                        checkIn.getTimeoutMinutes()
                );

        LocalDateTime deadline =
                checkIn.getRequestedAt()
                        .plusMinutes(
                                timeoutMinutes
                        );

        /*
         * 아직 응답 제한 시간이 지나지 않았다.
         */
        if (currentTime.isBefore(deadline)) {
            return false;
        }

        checkIn.setStatus(
                CheckIn.Status.MISSED
        );

        /*
         * 같은 님에게 처리되지 않은
         * 안부 미응답 이벤트가 이미 있다면
         * 중복 이벤트와 알림을 만들지 않는다.
         */
        boolean existingMissedEvent =
                careEventRepository
                        .existsBySeniorIdAndTypeAndStatus(
                                checkIn.getSeniorId(),
                                CareEvent.EventType.CHECK_IN_MISSED,
                                CareEvent.EventStatus.PENDING
                        );

        if (!existingMissedEvent) {
            careMonitoringService.reportEvent(
                    checkIn.getSeniorId(),
                    CareEvent.EventType.CHECK_IN_MISSED,
                    null,
                    null,
                    "Check-in response overdue"
            );
        }

        log.info(
                "Check-in marked as missed. "
                        + "checkInId={}, seniorId={}, "
                        + "requestType={}, requestedAt={}, "
                        + "timeoutMinutes={}, deadline={}",
                checkIn.getId(),
                checkIn.getSeniorId(),
                checkIn.getRequestType(),
                checkIn.getRequestedAt(),
                timeoutMinutes,
                deadline
        );

        return true;
    }

    /**
     * DB에 비정상적인 제한 시간이 들어 있더라도
     * 안전한 범위로 보정한다.
     */
    private int normalizeTimeoutMinutes(
            Integer timeoutMinutes
    ) {
        if (timeoutMinutes == null) {
            return DEFAULT_TIMEOUT_MINUTES;
        }

        if (timeoutMinutes
                < MIN_TIMEOUT_MINUTES) {

            return MIN_TIMEOUT_MINUTES;
        }

        if (timeoutMinutes
                > MAX_TIMEOUT_MINUTES) {

            return MAX_TIMEOUT_MINUTES;
        }

        return timeoutMinutes;
    }
}