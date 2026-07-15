package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.EnergySupportCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EnergySupportCaseRepository extends JpaRepository<EnergySupportCase, Long> {
    Optional<EnergySupportCase> findBySeniorIdAndSupportType(
            Long seniorId,
            EnergySupportCase.SupportType supportType
    );
}
