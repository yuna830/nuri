package com.nuri.woori.controller;

import com.nuri.woori.entity.JobInterest;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.JobInterestRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Objects;

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
        interest.setSource(trim(request.source()));
        interest.setDetailAddress(trim(request.detailAddress()));
        interest.setJobType(trim(request.jobType()));
        interest.setWorkTime(trim(request.workTime()));
        interest.setWeekHours(trim(request.weekHours()));
        interest.setWage(trim(request.wage()));
        interest.setRecruitCount(trim(request.recruitCount()));
        interest.setFromDate(trim(request.fromDate()));
        interest.setToDate(trim(request.toDate()));
        interest.setApplyMethod(trim(request.applyMethod()));
        interest.setContactInfo(trim(request.contactInfo()));
        interest.setDetail(trim(request.detail()));

        JobInterest saved = jobInterestRepository.save(interest);

        return ResponseEntity.ok(toResponse(saved));
    }

    @GetMapping("/welfare")
    public List<JobInterestResponse> getWelfareApplications(
            @RequestParam(required = false) Long welfareWorkerId
    ) {
        return jobInterestRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .filter(interest -> {
                    if (welfareWorkerId == null || interest.getSeniorId() == null) {
                        return true;
                    }

                    Senior senior = seniorRepository.findById(interest.getSeniorId()).orElse(null);
                    return senior != null && Objects.equals(senior.getWelfareWorkerId(), welfareWorkerId);
                })
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

    @GetMapping("/senior/{seniorId}")
    public List<JobInterestResponse> getBySenior(@PathVariable Long seniorId) {
        return jobInterestRepository.findBySeniorIdOrderByCreatedAtDesc(seniorId)
                .stream()
                .map(this::toResponse)
                .toList();
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
                        : interest.getCreatedAt().format(DateTimeFormatter.ofPattern("yyyy. MM. dd")),
                interest.getSource(),
                interest.getDetailAddress(),
                interest.getJobType(),
                interest.getWorkTime(),
                interest.getWeekHours(),
                interest.getWage(),
                interest.getRecruitCount(),
                interest.getFromDate(),
                interest.getToDate(),
                interest.getApplyMethod(),
                interest.getContactInfo(),
                interest.getDetail()
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
            String status,
            String source,
            String detailAddress,
            String jobType,
            String workTime,
            String weekHours,
            String wage,
            String recruitCount,
            String fromDate,
            String toDate,
            String applyMethod,
            String contactInfo,
            String detail
    ) {}

    public record JobInterestStatusRequest(
            String status
    ) {}

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
            String requestedAt,
            String source,
            String detailAddress,
            String jobType,
            String workTime,
            String weekHours,
            String wage,
            String recruitCount,
            String fromDate,
            String toDate,
            String applyMethod,
            String contactInfo,
            String detail
    ) {}
}
