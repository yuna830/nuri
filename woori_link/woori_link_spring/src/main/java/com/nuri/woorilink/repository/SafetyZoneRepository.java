package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.SafetyZone;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SafetyZoneRepository extends JpaRepository<SafetyZone, Long> {
    List<SafetyZone> findBySeniorIdOrderByIdAsc(Long seniorId);

    long countBySeniorId(Long seniorId);
}
