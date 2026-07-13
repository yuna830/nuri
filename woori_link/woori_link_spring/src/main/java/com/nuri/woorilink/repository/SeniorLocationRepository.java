package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.SeniorLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface SeniorLocationRepository extends JpaRepository<SeniorLocation, Long> {
    Optional<SeniorLocation> findTopBySeniorIdOrderByRecordedAtDesc(Long seniorId);
}
