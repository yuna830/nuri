package com.nuri.woorilink.domain.schedule.repository;

import com.nuri.woorilink.domain.schedule.entity.VisitSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface VisitScheduleRepository extends JpaRepository<VisitSchedule, Long> {
    List<VisitSchedule> findByWelfareWorkerId(Long welfareWorkerId);
    List<VisitSchedule> findBySeniorId(Long seniorId);

    @Query("SELECT v FROM VisitSchedule v WHERE v.welfareWorkerId = :welfareWorkerId " +
           "AND YEAR(v.visitDate) = :year AND MONTH(v.visitDate) = :month")
    List<VisitSchedule> findByWelfareWorkerIdAndMonth(
            @Param("welfareWorkerId") Long welfareWorkerId,
            @Param("year") int year,
            @Param("month") int month);
}
