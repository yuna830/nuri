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

    void deleteByGuardianId(Long guardianId);

    /**
     * 보호자에게 생성된 특정 상태의 알림을 최신순으로 조회한다.
     *
     * 예:
     * UNREAD, ACKNOWLEDGED 상태만 조회
     */
    List<CareAlert> findByGuardianIdAndStatusInOrderByCreatedAtDesc(
            Long guardianId,
            Collection<CareAlert.AlertStatus> statuses
    );

    /**
     * 보호자에게 생성된 특정 종류이면서
     * 특정 상태에 해당하는 알림을 조회한다.
     *
     * 긴급 확인 요약에서
     * 낙상, SOS 알림을 각각 집계할 때 사용한다.
     */
    List<CareAlert> findByGuardianIdAndTypeAndStatusIn(
            Long guardianId,
            CareEvent.EventType type,
            Collection<CareAlert.AlertStatus> statuses
    );

    /**
     * 보호자에게 생성된 여러 종류의 알림 중
     * 특정 상태에 해당하는 알림을 조회한다.
     *
     * 예:
     * FALL_SUSPECTED, FALL_DETECTED를 한 번에 조회
     */
    List<CareAlert> findByGuardianIdAndTypeInAndStatusIn(
            Long guardianId,
            Collection<CareEvent.EventType> types,
            Collection<CareAlert.AlertStatus> statuses
    );

    /**
     * 특정 어르신에게 생성된 알림을 최신순으로 조회한다.
     */
    List<CareAlert> findBySeniorIdOrderByCreatedAtDesc(
            Long seniorId
    );

    /**
     * 보호자에게 연결되지 않은
     * 어르신 본인의 알림을 조회한다.
     */
    List<CareAlert>
    findBySeniorIdAndGuardianIdIsNullOrderByCreatedAtDesc(
            Long seniorId
    );

    /**
     * 여러 어르신의 특정 종류 알림을 최신순으로 조회한다.
     */
    List<CareAlert> findBySeniorIdInAndTypeOrderByCreatedAtDesc(
            List<Long> seniorIds,
            CareEvent.EventType type
    );

    List<CareAlert> findBySeniorIdInOrderByCreatedAtDesc(
            List<Long> seniorIds
    );

    /**
     * 특정 어르신의 특정 종류 알림 중
     * 지정된 상태에 해당하는 알림을 조회한다.
     */
    List<CareAlert> findBySeniorIdAndTypeAndStatusIn(
            Long seniorId,
            CareEvent.EventType type,
            Collection<CareAlert.AlertStatus> statuses
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
     * 로그인한 보호자에게 속한 알림을 ID로 조회한다.
     */
    Optional<CareAlert> findByIdAndGuardianId(
            Long id,
            Long guardianId
    );

    /**
     * 어르신에게 속한 알림을 ID로 조회한다.
     */
    Optional<CareAlert> findByIdAndSeniorId(
            Long id,
            Long seniorId
    );

    /**
     * 보호자 연결 없이 생성된
     * 어르신 본인 알림을 ID로 조회한다.
     */
    Optional<CareAlert> findByIdAndSeniorIdAndGuardianIdIsNull(
            Long id,
            Long seniorId
    );

    /**
     * 특정 종류의 알림을 ID로 조회한다.
     */
    Optional<CareAlert> findByIdAndType(
            Long id,
            CareEvent.EventType type
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
