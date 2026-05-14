package com.nuri.woori.controller;

import com.nuri.woori.entity.JobInterest;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.JobInterestRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/job-interests")
@CrossOrigin(origins = "*")
public class JobInterestController {

    private final JobInterestRepository jobInterestRepository;
    private final SeniorRepository seniorRepository;

    public JobInterestController(
            JobInterestRepository jobInterestRepository,
            SeniorRepository seniorRepository
    ) {
        this.jobInterestRepository = jobInterestRepository;
        this.seniorRepository = seniorRepository;
    }

    @PostMapping
    public ResponseEntity<JobInterestResponse> create(@RequestBody JobInterestRequest request) {
        JobInterest interest = new JobInterest();
        interest.setSeniorId(request.seniorId());
        interest.setJobId(trim(request.jobId()));
        interest.setJobTitle(trim(request.jobTitle()));
        interest.setCompany(trim(request.company()));
        interest.setLocation(trim(request.location()));
        interest.setApplicationType(
                request.applicationType() == null || request.applicationType().isBlank()
                        ? "ONLINE"
                        : request.applicationType().trim()
        );
        interest.setStatus(
                request.status() == null || request.status().isBlank()
                        ? "검토 대기"
                        : request.status().trim()
        );

        JobInterest saved = jobInterestRepository.save(interest);

        return ResponseEntity.ok(toResponse(saved));
    }

    @GetMapping("/welfare")
    public List<JobInterestResponse> getWelfareApplications() {
        return jobInterestRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<JobInterestResponse> updateStatus(
            @PathVariable Long id,
            @RequestBody JobInterestStatusRequest request
    ) {
        return jobInterestRepository.findById(id)
                .map(interest -> {
                    interest.setStatus(trim(request.status()));
                    JobInterest saved = jobInterestRepository.save(interest);
                    return ResponseEntity.ok(toResponse(saved));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private JobInterestResponse toResponse(JobInterest interest) {
        Senior senior = interest.getSeniorId() == null
                ? null
                : seniorRepository.findById(interest.getSeniorId()).orElse(null);

        return new JobInterestResponse(
                interest.getId(),
                interest.getSeniorId(),
                senior == null ? "대상자 정보 없음" : senior.getName(),
                senior == null ? "" : senior.getPhone(),
                interest.getJobId(),
                interest.getJobTitle(),
                interest.getCompany(),
                interest.getLocation(),
                interest.getApplicationType(),
                interest.getStatus(),
                interest.getCreatedAt() == null
                        ? ""
                        : interest.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy. MM. dd"))
        );
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    public record JobInterestRequest(
            Long seniorId,
            String jobId,
            String jobTitle,
            String company,
            String location,
            String applicationType,
            String status
    ) {
    }

    public record JobInterestStatusRequest(
            String status
    ) {
    }

    public record JobInterestResponse(
            Long id,
            Long seniorId,
            String seniorName,
            String phone,
            String jobId,
            String jobTitle,
            String organization,
            String location,
            String applicationType,
            String status,
            String requestedAt
    ) {
    }
}
