package com.nuri.woori.repository;

import com.nuri.woori.entity.JobMatchingFeedback;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobMatchingFeedbackRepository extends JpaRepository<JobMatchingFeedback, Long> {
    List<JobMatchingFeedback> findAllByOrderByCreatedAtDesc();
}
