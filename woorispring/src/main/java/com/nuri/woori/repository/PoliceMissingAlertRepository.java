package com.nuri.woori.repository;

import com.nuri.woori.entity.PoliceMissingAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PoliceMissingAlertRepository extends JpaRepository<PoliceMissingAlert, Long> {
    Optional<PoliceMissingAlert> findByExternalKey(String externalKey);
    List<PoliceMissingAlert> findTop100ByOrderBySyncedAtDesc();
}
