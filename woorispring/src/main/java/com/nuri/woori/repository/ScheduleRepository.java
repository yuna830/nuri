package com.nuri.woori.repository;

import com.nuri.woori.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {
    List<Schedule> findBySeniorIdOrderByScheduleDateAscScheduleTimeAsc(Long seniorId);

    List<Schedule> findBySeniorIdAndScheduleDateOrderByScheduleTimeAsc(Long seniorId, LocalDate scheduleDate);
}
