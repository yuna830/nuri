package com.nuri.woori.repository;

import com.nuri.woori.entity.JobInterest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobInterestRepository extends JpaRepository<JobInterest, Long> {

    List<JobInterest> findAllByOrderByCreatedAtDesc();
}
