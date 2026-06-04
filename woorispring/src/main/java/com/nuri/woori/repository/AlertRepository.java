package com.nuri.woori.repository;

import com.nuri.woori.entity.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.LocalDateTime;
import java.util.Optional;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByGuardianIdOrderByCreatedAtDesc(Long guardianId);

    List<Alert> findBySeniorIdOrderByCreatedAtDesc(Long seniorId);

    Optional<Alert> findTopBySeniorIdAndTypeOrderByCreatedAtDesc(Long seniorId, String type);

    List<Alert> findByTypeInOrderByCreatedAtDesc(List<String> types);

    List<Alert> findByTypeAndIsReadFalseOrderByCreatedAtDesc(String type);

    boolean existsBySeniorIdAndTypeAndIsReadFalse(Long seniorId, String type);

    long countBySeniorIdAndTypeAndIsReadFalse(Long seniorId, String type);

    List<Alert> findBySeniorIdAndTypeInAndCreatedAtBefore(Long seniorId, List<String> types, LocalDateTime cutoff);

    List<Alert> findByTypeAndCreatedAtAfterOrderByCreatedAtDesc(String type, LocalDateTime createdAt);

    List<Alert> findBySeniorIdAndTypeAndIsReadFalseOrderByCreatedAtDesc(Long seniorId, String type);
}
