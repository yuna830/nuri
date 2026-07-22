package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.CheckInSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CheckInScheduleRepository
        extends JpaRepository<CheckInSchedule, Long> {

    /**
     * 특정 님의 자동 안부 설정을 조회한다.
     */
    Optional<CheckInSchedule> findBySeniorId(
            Long seniorId
    );

    /**
     * 특정 님의 설정 존재 여부를 확인한다.
     */
    boolean existsBySeniorId(
            Long seniorId
    );

    /**
     * 자동 안부 요청이 활성화된 설정을 조회한다.
     *
     * 이후 자동 발송 스케줄러에서 사용한다.
     */
    List<CheckInSchedule> findByEnabledTrue();
}