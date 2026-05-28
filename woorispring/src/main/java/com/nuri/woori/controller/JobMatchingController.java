package com.nuri.woori.controller;

import com.nuri.woori.service.JobMatchingService;
import com.nuri.woori.service.JobMatchingService.JobCandidate;
import com.nuri.woori.service.JobMatchingService.JobRecommendation;
import com.nuri.woori.entity.JobMatchingFeedback;
import com.nuri.woori.service.JobMatchingFeedbackService;
import com.nuri.woori.service.JobMatchingMlService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.NoSuchElementException;

@RestController
@RequestMapping("/api/job-matching")
@CrossOrigin(origins = "*")
public class JobMatchingController {

    private final JobMatchingService jobMatchingService;
    private final JobMatchingMlService jobMatchingMlService;
    private final JobMatchingFeedbackService jobMatchingFeedbackService;

    public JobMatchingController(
            JobMatchingService jobMatchingService,
            JobMatchingMlService jobMatchingMlService,
            JobMatchingFeedbackService jobMatchingFeedbackService
    ) {
        this.jobMatchingService = jobMatchingService;
        this.jobMatchingMlService = jobMatchingMlService;
        this.jobMatchingFeedbackService = jobMatchingFeedbackService;
    }

    @PostMapping("/seniors/{seniorId}/recommendations")
    public ResponseEntity<JobRecommendationResponse> recommendJobs(
            @PathVariable Long seniorId,
            @RequestBody JobRecommendationRequest request
    ) {
        try {
            List<JobRecommendation> recommendations = jobMatchingService.recommend(
                    seniorId,
                    request == null ? null : request.jobs(),
                    request == null ? null : request.limit()
            );

            return ResponseEntity.ok(new JobRecommendationResponse(seniorId, recommendations));
        } catch (NoSuchElementException error) {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/seniors/{seniorId}/ml-recommendations")
    public ResponseEntity<JobMatchingMlService.MlRecommendationResponse> recommendJobsWithModel(
            @PathVariable Long seniorId,
            @RequestBody JobRecommendationRequest request
    ) {
        try {
            JobMatchingMlService.MlRecommendationResponse response = jobMatchingMlService.recommend(
                    seniorId,
                    request == null ? null : request.jobs(),
                    request == null ? null : request.limit()
            );

            return ResponseEntity.ok(response);
        } catch (NoSuchElementException error) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException error) {
            return ResponseEntity.status(503).body(new JobMatchingMlService.MlRecommendationResponse(
                    seniorId,
                    false,
                    List.of(),
                    error.getMessage()
            ));
        }
    }

    @PostMapping("/feedback")
    public ResponseEntity<JobMatchingFeedbackResponse> saveFeedback(
            @RequestBody JobMatchingFeedbackService.FeedbackRequest request
    ) {
        try {
            JobMatchingFeedback feedback = jobMatchingFeedbackService.saveFeedback(request);

            return ResponseEntity.ok(new JobMatchingFeedbackResponse(
                    feedback.getId(),
                    feedback.getSeniorId(),
                    feedback.getJobId(),
                    feedback.getLabel(),
                    feedback.getCreatedAt()
            ));
        } catch (NoSuchElementException error) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException error) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/training-data.csv")
    public ResponseEntity<String> exportTrainingData() {
        String csv = jobMatchingFeedbackService.exportTrainingCsv();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=job_matching_training_data.csv")
                .contentType(new MediaType("text", "csv"))
                .body(csv);
    }

    public record JobRecommendationRequest(
            Integer limit,
            List<JobCandidate> jobs
    ) {
    }

    public record JobRecommendationResponse(
            Long seniorId,
            List<JobRecommendation> recommendations
    ) {
    }

    public record JobMatchingFeedbackResponse(
            Long id,
            Long seniorId,
            String jobId,
            String label,
            java.time.LocalDateTime createdAt
    ) {
    }
}
