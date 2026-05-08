package com.nuri.woori.repository;

import com.nuri.woori.entity.LocationStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface LocationStatusRepository extends JpaRepository<LocationStatus, Long> {
    Optional<LocationStatus> findTopBySeniorIdOrderByReceivedAtDesc(Long seniorId);

    List<LocationStatus> findBySeniorIdAndReceivedAtBetweenOrderByReceivedAtAsc(
            Long seniorId,
            LocalDateTime start,
            LocalDateTime end
    );
}