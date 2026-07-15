package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.EnergySupportActivity;
import com.nuri.woorilink.entity.EnergySupportCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface EnergySupportActivityRepository extends JpaRepository<EnergySupportActivity, Long> {
    List<EnergySupportActivity> findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(
            Long seniorId,
            EnergySupportCase.SupportType supportType
    );
}
