package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.RiskAssessment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RiskAssessmentRepository extends JpaRepository<RiskAssessment, Long> {
    Optional<RiskAssessment> findTopBySeniorIdOrderByAssessedAtDesc(Long seniorId);

    @Query("""
            select r
            from RiskAssessment r
            where r.level = :level
              and r.assessedAt = (
                  select max(r2.assessedAt)
                  from RiskAssessment r2
                  where r2.seniorId = r.seniorId
              )
            order by r.totalScore desc, r.assessedAt desc
            """)
    List<RiskAssessment> findLatestByLevel(@Param("level") RiskAssessment.RiskLevel level);
}
