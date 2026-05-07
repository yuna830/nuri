package com.nuri.woori.repository;

import com.nuri.woori.entity.HealthInfo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface HealthInfoRepository extends JpaRepository<HealthInfo, Long> {
    Optional<HealthInfo> findTopBySeniorIdOrderByCreatedAtDesc(Long seniorId);
}
