package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.CareAlert;
import com.nuri.woorilink.entity.CareEvent;
import com.nuri.woorilink.entity.CheckIn;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.CareAlertRepository;
import com.nuri.woorilink.repository.CareEventRepository;
import com.nuri.woorilink.repository.CheckInRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 과거 안부 미응답 알림이 생성된 뒤
 * 새로운 정상 응답이 확인되면 해당 알림을 자동 해결한다.
 *
 * 미응답 이력 자체는 삭제하지 않고
 * 보호자가 확인해야 하는 현재 알림 상태만 정리한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class CheckInAlertResolutionScheduler {

    private final CareAlertRepository
            careAlertRepository;

    private final CareEventRepository
            careEventRepository;

    private final CheckInRepository
            checkInRepository;

    private final SeniorRepository
            seniorRepository;

    /**
     * 기본값으로 10초마다 실행한다.
     *
     * CHECK_IN_MISSED 알림이 생성된 이후
     * RESPONDED 안부 기록이 존재하면:
     *
     * 1. 알림 상태를 RESOLVED로 변경
     * 2. 연결된 CareEvent도 RESOLVED로 변경
     * 3. 알림 제목과 메시지를 현재 상태에 맞게 변경
     */
    @Scheduled(
            fixedDelayString =
                    "${care.check-in.alert-resolution-scan-interval-ms:10000}"
    )
    @Transactional
    public void resolveCheckInMissedAlerts() {
        List<CareAlert.AlertStatus> activeStatuses =
                List.of(
                        CareAlert.AlertStatus.UNREAD,
                        CareAlert.AlertStatus.ACKNOWLEDGED
                );

        List<CareAlert> unresolvedAlerts =
                careAlertRepository
                        .findByTypeAndStatusInOrderByCreatedAtAsc(
                                CareEvent.EventType.CHECK_IN_MISSED,
                                activeStatuses
                        );

        if (unresolvedAlerts.isEmpty()) {
            return;
        }

        LocalDateTime resolvedAt =
                LocalDateTime.now();

        int resolvedCount = 0;

        for (CareAlert alert : unresolvedAlerts) {
            try {
                boolean resolved =
                        resolveAlertIfResponded(
                                alert,
                                resolvedAt
                        );

                if (resolved) {
                    resolvedCount++;
                }

            } catch (RuntimeException exception) {
                /*
                 * 한 알림 처리에 실패해도
                 * 다른 님의 알림은 계속 확인한다.
                 */
                log.error(
                        "Failed to resolve check-in missed alert. "
                                + "alertId={}, seniorId={}",
                        alert.getId(),
                        alert.getSeniorId(),
                        exception
                );
            }
        }

        if (resolvedCount > 0) {
            log.info(
                    "Check-in missed alerts resolved. "
                            + "targetCount={}, resolvedCount={}",
                    unresolvedAlerts.size(),
                    resolvedCount
            );
        }
    }

    /**
     * 해당 미응답 알림이 생성된 이후에
     * 님의 정상 응답 기록이 있는지 확인한다.
     */
    private boolean resolveAlertIfResponded(
            CareAlert alert,
            LocalDateTime resolvedAt
    ) {
        if (alert.getSeniorId() == null) {
            return false;
        }

        if (alert.getCreatedAt() == null) {
            log.warn(
                    "Check-in missed alert has no createdAt. "
                            + "alertId={}, seniorId={}",
                    alert.getId(),
                    alert.getSeniorId()
            );

            return false;
        }

        boolean respondedAfterAlert =
                checkInRepository
                        .existsBySeniorIdAndStatusAndRespondedAtAfter(
                                alert.getSeniorId(),
                                CheckIn.Status.RESPONDED,
                                alert.getCreatedAt()
                        );

        if (!respondedAfterAlert) {
            return false;
        }

        String seniorName =
                seniorRepository
                        .findById(
                                alert.getSeniorId()
                        )
                        .map(Senior::getName)
                        .filter(name ->
                                name != null
                                        && !name.isBlank()
                        )
                        .orElse("님");

        /*
         * 과거 미응답 사실은 DB에 그대로 남긴다.
         * 이후 정상 응답이 확인됐으므로
         * 보호자 알림 상태를 RESOLVED로 변경한다.
         */
        alert.setStatus(
                CareAlert.AlertStatus.RESOLVED
        );

        alert.setAcknowledgedAt(
                resolvedAt
        );

        /*
         * 보호자 화면 상단에서 이미
         * "최숙희 님"처럼 대상자를 표시하므로
         * 제목과 본문은 중복되지 않도록 간단히 작성한다.
         */
        alert.setTitle(
                "안부 응답 확인"
        );

        alert.setMessage(
                seniorName
                        + "님이 정상적으로 응답했습니다."
        );

        /*
         * 알림과 연결된 CHECK_IN_MISSED 이벤트도
         * 현재는 확인된 상태로 변경한다.
         */
        if (alert.getCareEventId() != null) {
            careEventRepository
                    .findById(
                            alert.getCareEventId()
                    )
                    .filter(event ->
                            event.getType()
                                    == CareEvent.EventType.CHECK_IN_MISSED
                    )
                    .ifPresent(event ->
                            event.setStatus(
                                    CareEvent.EventStatus.RESOLVED
                            )
                    );
        }

        log.info(
                "Check-in missed alert resolved after response. "
                        + "alertId={}, seniorId={}, resolvedAt={}",
                alert.getId(),
                alert.getSeniorId(),
                resolvedAt
        );

        return true;
    }
}