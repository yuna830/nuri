package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.CheckInSchedule;
import com.nuri.woorilink.repository.CheckInScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 자동 안부 설정을 주기적으로 확인한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CheckInAutoScheduler {

    private final CheckInScheduleRepository
            checkInScheduleRepository;

    private final CheckInAutoRequestService
            checkInAutoRequestService;

    /**
     * 기본적으로 매분 0초마다 실행한다.
     *
     * 예:
     * 09:00:00
     * 09:01:00
     * 09:02:00
     *
     * 각 스케줄에 설정된 여러 발송 시간을 확인하고,
     * 아직 생성되지 않은 시간의 요청을 만든다.
     */
    @Scheduled(
            cron =
                    "${care.check-in.auto-scan-cron:0 * * * * *}"
    )
    public void createAutomaticCheckIns() {
        List<CheckInSchedule> schedules =
                checkInScheduleRepository
                        .findByEnabledTrue();

        if (schedules.isEmpty()) {
            return;
        }

        int totalCreatedCount = 0;

        for (
                CheckInSchedule schedule
                : schedules
        ) {
            try {
                CheckInAutoRequestService
                        .AutoRequestResult result =
                        checkInAutoRequestService
                                .createIfDue(
                                        schedule.getId()
                                );

                if (result.status()
                        == CheckInAutoRequestService
                        .AutoRequestStatus
                        .CREATED) {

                    totalCreatedCount +=
                            result.createdCount();

                    log.info(
                            "Automatic check-in scheduler created requests. "
                                    + "scheduleId={}, seniorId={}, "
                                    + "createdCount={}, checkInIds={}",
                            schedule.getId(),
                            schedule.getSeniorId(),
                            result.createdCount(),
                            result.checkInIds()
                    );
                }

            } catch (RuntimeException exception) {
                /*
                 * 한 어르신의 발송이 실패해도
                 * 나머지 어르신의 스케줄은 계속 처리한다.
                 */
                log.error(
                        "Automatic check-in scheduler failed. "
                                + "scheduleId={}, seniorId={}",
                        schedule.getId(),
                        schedule.getSeniorId(),
                        exception
                );
            }
        }

        if (totalCreatedCount > 0) {
            log.info(
                    "Automatic check-in scan completed. "
                            + "scheduleCount={}, createdCount={}",
                    schedules.size(),
                    totalCreatedCount
            );
        }
    }
}