package com.nuri.woori.repository;

import com.nuri.woori.entity.ClimateAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ClimateAlertRepository extends JpaRepository<ClimateAlert, Long> {
    List<ClimateAlert> findTop6BySeniorIdAndAlertDateOrderByIssuedAtDesc(Long seniorId, LocalDate alertDate);

    List<ClimateAlert> findTop6BySeniorIdOrderByIssuedAtDesc(Long seniorId);

    Optional<ClimateAlert> findBySeniorIdAndEventId(Long seniorId, String eventId);
}
