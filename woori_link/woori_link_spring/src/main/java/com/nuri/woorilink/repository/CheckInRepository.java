package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.CheckIn;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface CheckInRepository extends JpaRepository<CheckIn, Long> {
    List<CheckIn> findBySeniorIdOrderByRequestedAtDesc(Long seniorId);
    List<CheckIn> findByStatusAndRequestedAtBefore(CheckIn.Status status, LocalDateTime cutoff);
}
