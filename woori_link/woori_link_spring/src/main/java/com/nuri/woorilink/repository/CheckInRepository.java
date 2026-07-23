package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.CheckIn;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public interface CheckInRepository
        extends JpaRepository<CheckIn, Long> {

    /**
     * 어르신의 전체 안부 기록을 최신순으로 조회한다.
     */
    List<CheckIn> findBySeniorIdOrderByRequestedAtDesc(
            Long seniorId
    );

    /**
     * 특정 시각 이후의 안부 기록을 최신순으로 조회한다.
     *
     * 최근 7일 안부 분석에서 사용한다.
     */
    List<CheckIn>
    findBySeniorIdAndRequestedAtGreaterThanEqualOrderByRequestedAtDesc(
            Long seniorId,
            LocalDateTime requestedAt
    );

    List<CheckIn> findBySeniorIdInAndRequestedAtGreaterThanEqualAndRequestedAtLessThan(
            List<Long> seniorIds,
            LocalDateTime start,
            LocalDateTime end
    );

    /**
     * 현재 PENDING 상태인 안부 요청을
     * 요청 시각이 오래된 순서로 조회한다.
     */
    List<CheckIn> findByStatusOrderByRequestedAtAsc(
            CheckIn.Status status
    );

    /**
     * 기존 하루 1회 자동 요청 호환용 조회.
     *
     * 신규 다중 시간 자동 요청에서는
     * scheduledTime까지 포함한 메서드를 사용한다.
     */
    boolean existsBySeniorIdAndRequestTypeAndScheduledDate(
            Long seniorId,
            CheckIn.RequestType requestType,
            LocalDate scheduledDate
    );

    /**
     * 같은 어르신에게 같은 날짜와 같은 예정 시간으로
     * 자동 안부 요청이 이미 생성됐는지 확인한다.
     *
     * 예:
     * 2026-07-22 09:00
     * 2026-07-22 12:00
     * 2026-07-22 18:00
     *
     * 위 세 요청은 서로 다른 요청으로 저장된다.
     */
    boolean existsBySeniorIdAndRequestTypeAndScheduledDateAndScheduledTime(
            Long seniorId,
            CheckIn.RequestType requestType,
            LocalDate scheduledDate,
            LocalTime scheduledTime
    );

    /**
     * 특정 시각 이후에 어르신이 정상 응답한
     * 안부 기록이 있는지 확인한다.
     *
     * 기존 미응답 알림이 생성된 후
     * 새로운 정상 응답이 있었는지 판단할 때 사용한다.
     */
    boolean existsBySeniorIdAndStatusAndRespondedAtAfter(
            Long seniorId,
            CheckIn.Status status,
            LocalDateTime respondedAt
    );
}
