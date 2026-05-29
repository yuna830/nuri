package com.nuri.woori.repository;

import com.nuri.woori.entity.JobPostingCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface JobPostingCacheRepository extends JpaRepository<JobPostingCache, Long> {
    Optional<JobPostingCache> findByCacheKey(String cacheKey);
    List<JobPostingCache> findTop3000ByOrderByUpdatedAtDesc();

    @Query("SELECT MAX(j.updatedAt) FROM JobPostingCache j")
    Optional<LocalDateTime> findLatestUpdatedAt();
}
