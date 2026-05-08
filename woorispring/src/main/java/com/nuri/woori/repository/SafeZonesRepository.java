package com.nuri.woori.repository;

import com.nuri.woori.entity.SafeZones;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SafeZonesRepository extends JpaRepository<SafeZones, Long> {
    Optional<SafeZones> findBySeniorId(Long seniorId);
}
