package com.nuri.woori.repository;

import com.nuri.woori.entity.Alert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AlertRepository extends JpaRepository<Alert, Long> {

    List<Alert> findByGuardianIdOrderByCreatedAtDesc(Long guardianId);

    List<Alert> findBySeniorIdOrderByCreatedAtDesc(Long seniorId);
}
