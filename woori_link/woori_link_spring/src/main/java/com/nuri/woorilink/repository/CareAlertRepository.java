package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.CareAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface CareAlertRepository extends JpaRepository<CareAlert, Long> {
    List<CareAlert> findByGuardianIdOrderByCreatedAtDesc(Long guardianId);
    List<CareAlert> findBySeniorIdOrderByCreatedAtDesc(Long seniorId);
    List<CareAlert> findBySeniorIdAndGuardianIdIsNullOrderByCreatedAtDesc(Long seniorId);
    List<CareAlert> findBySeniorIdInAndTypeOrderByCreatedAtDesc(List<Long> seniorIds, com.nuri.woorilink.entity.CareEvent.EventType type);
    List<CareAlert> findByStatusAndCreatedAtBefore(CareAlert.AlertStatus status, LocalDateTime cutoff);
    Optional<CareAlert> findByIdAndGuardianId(Long id, Long guardianId);
    Optional<CareAlert> findByIdAndSeniorId(Long id, Long seniorId);
    Optional<CareAlert> findByIdAndSeniorIdAndGuardianIdIsNull(Long id, Long seniorId);
    Optional<CareAlert> findByIdAndType(Long id, com.nuri.woorilink.entity.CareEvent.EventType type);
}
