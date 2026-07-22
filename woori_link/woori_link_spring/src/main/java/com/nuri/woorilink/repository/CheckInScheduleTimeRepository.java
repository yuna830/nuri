package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.CheckInScheduleTime;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

public interface CheckInScheduleTimeRepository
        extends JpaRepository<CheckInScheduleTime, Long> {

    /**
     * 특정 자동 안부 설정의 모든 발송 시간을
     * 빠른 시간순으로 조회한다.
     */
    List<CheckInScheduleTime>
    findByScheduleIdOrderByRequestTimeAsc(
            Long scheduleId
    );

    /**
     * 특정 설정에 동일한 시간이 저장돼 있는지 조회한다.
     */
    Optional<CheckInScheduleTime>
    findByScheduleIdAndRequestTime(
            Long scheduleId,
            LocalTime requestTime
    );

    /**
     * 특정 설정의 동일 시간 존재 여부를 확인한다.
     */
    boolean existsByScheduleIdAndRequestTime(
            Long scheduleId,
            LocalTime requestTime
    );

    /**
     * 특정 자동 안부 설정에 포함된 시간을 모두 삭제한다.
     *
     * 설정 저장 시 기존 목록을 지운 후
     * 새 시간 목록으로 교체할 때 사용한다.
     */
    void deleteByScheduleId(
            Long scheduleId
    );
}