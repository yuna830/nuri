package com.nuri.woori.repository;

import com.nuri.woori.entity.JobPostingCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JobPostingCacheRepository extends JpaRepository<JobPostingCache, Long> {
    Optional<JobPostingCache> findByCacheKey(String cacheKey);
    List<JobPostingCache> findTop3000ByOrderByUpdatedAtDesc();
}
