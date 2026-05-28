package com.nuri.woori.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.JobPostingCache;
import com.nuri.woori.repository.JobPostingCacheRepository;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/job-cache")
@CrossOrigin(origins = "*")
public class JobPostingCacheController {
    private final JobPostingCacheRepository jobPostingCacheRepository;
    private final ObjectMapper objectMapper;

    public JobPostingCacheController(
            JobPostingCacheRepository jobPostingCacheRepository,
            ObjectMapper objectMapper
    ) {
        this.jobPostingCacheRepository = jobPostingCacheRepository;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public List<Map<String, Object>> getCachedJobs() {
        List<Map<String, Object>> jobs = new ArrayList<>();

        for (JobPostingCache cache : jobPostingCacheRepository.findTop3000ByOrderByUpdatedAtDesc()) {
            try {
                jobs.add(objectMapper.readValue(cache.getPayload(), new TypeReference<>() {}));
            } catch (Exception ignored) {
                // Skip malformed cache rows instead of breaking the page.
            }
        }

        return jobs;
    }

    @PostMapping("/bulk")
    public Map<String, Integer> upsertCachedJobs(@RequestBody List<Map<String, Object>> jobs) {
        if (jobs == null || jobs.isEmpty()) {
            return Map.of("saved", 0);
        }

        int saved = 0;

        for (Map<String, Object> job : jobs) {
            String source = text(job.get("source"));
            String jobId = text(job.get("jobId"));

            if (source.isBlank() || jobId.isBlank()) {
                continue;
            }

            String cacheKey = source + ":" + jobId;
            JobPostingCache cache = jobPostingCacheRepository.findByCacheKey(cacheKey)
                    .orElseGet(JobPostingCache::new);

            cache.setCacheKey(cacheKey);
            cache.setSource(source);
            cache.setJobId(jobId);
            cache.setUpdatedAt(LocalDateTime.now());

            try {
                cache.setPayload(objectMapper.writeValueAsString(job));
                jobPostingCacheRepository.save(cache);
                saved += 1;
            } catch (Exception ignored) {
                // Keep going. A single bad posting should not block the rest.
            }
        }

        return Map.of("saved", saved);
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
