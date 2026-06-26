package com.nuri.woorilink.domain.risk.repository;

import com.nuri.woorilink.domain.risk.entity.RiskAssessment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RiskAssessmentRepository extends JpaRepository<RiskAssessment, Long> {
    Optional<RiskAssessment> findTopBySeniorIdOrderByAssessedAtDesc(Long seniorId);
    List<RiskAssessment> findByLevel(RiskAssessment.RiskLevel level);
}
