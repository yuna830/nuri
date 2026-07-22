package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.CareAlert;
import com.nuri.woorilink.entity.CareEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface CareAlertRepository
        extends JpaRepository<CareAlert, Long> {

    /**
     * 보호자에게 생성된 전체 알림을 최신순으로 조회한다.
     */
    List<CareAlert> findByGuardianIdOrderByCreatedAtDesc(
            Long guardianId
    );

    /**
     * 특정 님에게 생성된 알림을 최신순으로 조회한다.
     */
    List<CareAlert> findBySeniorIdOrderByCreatedAtDesc(
            Long seniorId
    );

    /**
     * 일정 시간이 지난 특정 상태의 알림을 조회한다.
     *
     * 미확인 알림 반복 안내에서 사용한다.
     */
    List<CareAlert> findByStatusAndCreatedAtBefore(
            CareAlert.AlertStatus status,
            LocalDateTime createdAt
    );

    /**
     * 로그인한 보호자에게 속한 알림을 조회한다.
     */
    Optional<CareAlert> findByIdAndGuardianId(
            Long id,
            Long guardianId
    );

    /**
     * 특정 종류이며 아직 해결되지 않은 알림을 조회한다.
     *
     * 예:
     * CHECK_IN_MISSED이면서
     * UNREAD 또는 ACKNOWLEDGED 상태인 알림
     */
    List<CareAlert> findByTypeAndStatusInOrderByCreatedAtAsc(
            CareEvent.EventType type,
            Collection<CareAlert.AlertStatus> statuses
    );
}