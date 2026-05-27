package com.nuri.woori.repository;

import com.nuri.woori.entity.SafeZones;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SafeZonesRepository extends JpaRepository<SafeZones, Long> {
    List<SafeZones> findBySeniorIdOrderByIdAsc(Long seniorId);
    Optional<SafeZones> findByIdAndSeniorId(Long id, Long seniorId);
}