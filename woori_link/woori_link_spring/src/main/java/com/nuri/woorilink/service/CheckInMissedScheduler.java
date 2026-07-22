package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.CheckIn;
import com.nuri.woorilink.repository.CheckInRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

/**
 * PENDING 안부 요청의 응답 제한 시간을
 * 주기적으로 확인한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CheckInMissedScheduler {

    private final CheckInRepository
            checkInRepository;

    private final CheckInMissedService
            checkInMissedService;

    /**
     * 기본값으로 30초마다 실행한다.
     *
     * 각 요청의 다음 값을 비교한다.
     *
     * requestedAt + timeoutMinutes
     *
     * 제한 시간이 지난 요청만 MISSED로 변경한다.
     */
    @Scheduled(
            fixedDelayString =
                    "${care.check-in.missed-scan-interval-ms:30000}"
    )
    public void markExpiredCheckIns() {
        List<CheckIn> pendingCheckIns =
                checkInRepository
                        .findByStatusOrderByRequestedAtAsc(
                                CheckIn.Status.PENDING
                        );

        if (pendingCheckIns.isEmpty()) {
            return;
        }

        LocalDateTime currentTime =
                LocalDateTime.now();

        int missedCount = 0;

        for (CheckIn checkIn : pendingCheckIns) {
            try {
                boolean marked =
                        checkInMissedService
                                .markMissedIfExpired(
                                        checkIn.getId(),
                                        currentTime
                                );

                if (marked) {
                    missedCount++;
                }

            } catch (RuntimeException exception) {
                /*
                 * 한 요청의 처리에 실패해도
                 * 나머지 요청은 계속 검사한다.
                 */
                log.error(
                        "Failed to process expired check-in. "
                                + "checkInId={}, seniorId={}",
                        checkIn.getId(),
                        checkIn.getSeniorId(),
                        exception
                );
            }
        }

        if (missedCount > 0) {
            log.info(
                    "Expired check-in scan completed. "
                            + "pendingCount={}, missedCount={}",
                    pendingCheckIns.size(),
                    missedCount
            );
        }
    }
}