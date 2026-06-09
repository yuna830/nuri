package com.nuri.woori.repository;

import com.nuri.woori.entity.Alert;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.time.LocalDateTime;
import java.util.Optional;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByGuardianIdOrderByCreatedAtDesc(Long guardianId, Pageable pageable);

    List<Alert> findBySeniorIdOrderByCreatedAtDesc(Long seniorId, Pageable pageable);

    Optional<Alert> findTopBySeniorIdAndTypeOrderByCreatedAtDesc(Long seniorId, String type);

    List<Alert> findByTypeInOrderByCreatedAtDesc(List<String> types);

    List<Alert> findByTypeAndIsReadFalseOrderByCreatedAtDesc(String type, Pageable pageable);

    boolean existsBySeniorIdAndTypeAndIsReadFalse(Long seniorId, String type);

    boolean existsByGuardianIdAndSeniorIdAndType(Long guardianId, Long seniorId, String type);

    boolean existsByGuardianIdAndSeniorIdAndTypeAndIsReadFalse(Long guardianId, Long seniorId, String type);

    long countBySeniorIdAndTypeAndIsReadFalse(Long seniorId, String type);

    List<Alert> findBySeniorIdAndTypeInAndCreatedAtBefore(Long seniorId, List<String> types, LocalDateTime cutoff);

    List<Alert> findByTypeAndCreatedAtAfterOrderByCreatedAtDesc(String type, LocalDateTime createdAt, Pageable pageable);

    List<Alert> findBySeniorIdAndTypeAndIsReadFalseOrderByCreatedAtDesc(Long seniorId, String type);

    List<Alert> findBySeniorIdInAndTypeAndCreatedAtAfterOrderByCreatedAtDesc(List<Long> seniorIds, String type, LocalDateTime createdAt);
}
