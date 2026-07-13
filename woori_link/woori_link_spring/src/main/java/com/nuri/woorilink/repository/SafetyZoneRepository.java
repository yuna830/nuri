package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.SafetyZone;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SafetyZoneRepository extends JpaRepository<SafetyZone, Long> {
    Optional<SafetyZone> findBySeniorId(Long seniorId);
}
