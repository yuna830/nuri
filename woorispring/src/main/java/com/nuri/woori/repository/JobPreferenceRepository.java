package com.nuri.woori.repository;

import com.nuri.woori.entity.JobPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface JobPreferenceRepository extends JpaRepository<JobPreference, Long> {
    Optional<JobPreference> findTopBySeniorIdOrderByCreatedAtDesc(Long seniorId);
}
