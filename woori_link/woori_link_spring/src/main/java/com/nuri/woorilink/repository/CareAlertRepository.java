package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.CareAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.time.LocalDateTime;

public interface CareAlertRepository extends JpaRepository<CareAlert, Long> {
    List<CareAlert> findByGuardianIdOrderByCreatedAtDesc(Long guardianId);
    List<CareAlert> findBySeniorIdOrderByCreatedAtDesc(Long seniorId);
    List<CareAlert> findByStatusAndCreatedAtBefore(CareAlert.AlertStatus status, LocalDateTime cutoff);
}
