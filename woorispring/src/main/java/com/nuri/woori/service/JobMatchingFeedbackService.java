package com.nuri.woori.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.JobMatchingFeedback;
import com.nuri.woori.entity.JobPreference;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.JobMatchingFeedbackRepository;
import com.nuri.woori.repository.JobPreferenceRepository;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.service.JobMatchingService.JobCandidate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;

@Service
public class JobMatchingFeedbackService {

    private static final List<String> ALLOWED_LABELS = List.of("적합", "검토", "부적합");
    private static final List<String> TRAINING_COLUMNS = List.of(
            "label",
            "health_status",
            "medicine_count",
            "walking_aid",
            "recent_fall",
            "disabled_work",
            "max_hours",
            "max_distance",
            "disease_text",
            "hope_job_type",
            "hope_condition",
            "job_type",
            "work_environment",
            "physical_intensity",
            "daily_hours",
            "commute_level",
            "task_tags",
            "closed"
    );

    private final SeniorRepository seniorRepository;
    private final HealthInfoRepository healthInfoRepository;
    private final JobPreferenceRepository jobPreferenceRepository;
    private final JobMatchingFeedbackRepository feedbackRepository;
    private final ObjectMapper objectMapper;

    public JobMatchingFeedbackService(
            SeniorRepository seniorRepository,
            HealthInfoRepository healthInfoRepository,
            JobPreferenceRepository jobPreferenceRepository,
            JobMatchingFeedbackRepository feedbackRepository,
            ObjectMapper objectMapper
    ) {
        this.seniorRepository = seniorRepository;
        this.healthInfoRepository = healthInfoRepository;
        this.jobPreferenceRepository = jobPreferenceRepository;
        this.feedbackRepository = feedbackRepository;
        this.objectMapper = objectMapper;
    }

    public JobMatchingFeedback saveFeedback(FeedbackRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("feedback request is required.");
        }

        Long seniorId = request.seniorId();
        if (seniorId == null) {
            throw new IllegalArgumentException("seniorId is required.");
        }

        String label = normalizeLabel(request.label());
        seniorRepository.findById(seniorId)
                .orElseThrow(() -> new NoSuchElementException("Senior not found: " + seniorId));

        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(seniorId)
                .orElse(null);

        JobPreference jobPreference = jobPreferenceRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(seniorId)
                .orElse(null);

        JobCandidate job = request.job();
        if (job == null) {
            throw new IllegalArgumentException("job is required.");
        }

        JobMatchingFeedback feedback = new JobMatchingFeedback();
        feedback.setSeniorId(seniorId);
        feedback.setLabel(label);
        feedback.setSource(blankToDefault(request.source(), "MANUAL"));
        feedback.setJobId(job.jobId());
        feedback.setTitle(job.title());
        feedback.setOrganization(job.organization());
        feedback.setJobType(job.jobType());
        feedback.setWorkEnvironment(job.workEnvironment());
        feedback.setPhysicalIntensity(job.physicalIntensity());
        feedback.setDailyHours(job.dailyHours());
        feedback.setCommuteLevel(job.commuteLevel());
        feedback.setTaskTags(join(job.taskTags()));
        feedback.setClosed(Boolean.TRUE.equals(job.closed()));
        feedback.setWorkDays(join(job.workDays()));
        feedback.setWorkCondition(job.workCondition());
        feedback.setRuleScore(request.ruleScore());
        feedback.setRuleGrade(request.ruleGrade());
        feedback.setMlPrediction(request.mlPrediction());
        feedback.setMlScore(request.mlScore());
        feedback.setMlProbabilitiesJson(toJson(request.mlProbabilities()));
        feedback.setHealthStatus(healthInfo == null ? null : healthInfo.getHealthStatus());
        feedback.setMedicineCount(healthInfo == null ? null : healthInfo.getMedicineCount());
        feedback.setWalkingAid(healthInfo == null ? null : healthInfo.getWalkingAid());
        feedback.setRecentFall(healthInfo == null ? null : healthInfo.getRecentFall());
        feedback.setDisabledWork(healthInfo == null ? null : healthInfo.getDisabledWork());
        feedback.setMaxHours(healthInfo == null ? null : healthInfo.getMaxHours());
        feedback.setMaxDistance(healthInfo == null ? null : healthInfo.getMaxDistance());
        feedback.setDiseaseText(diseaseText(healthInfo));
        feedback.setHopeJobType(jobPreference == null ? null : jobPreference.getHopeJobType());
        feedback.setHopeCondition(jobPreference == null ? null : joinText(jobPreference.getHopeCondition(), jobPreference.getMemo()));

        return feedbackRepository.save(feedback);
    }

    public String exportTrainingCsv() {
        List<JobMatchingFeedback> rows = feedbackRepository.findAllByOrderByCreatedAtDesc();
        StringBuilder builder = new StringBuilder();
        builder.append(String.join(",", TRAINING_COLUMNS)).append("\n");

        for (JobMatchingFeedback row : rows) {
            builder.append(csv(row.getLabel())).append(",");
            builder.append(csv(row.getHealthStatus())).append(",");
            builder.append(csv(row.getMedicineCount())).append(",");
            builder.append(csv(row.getWalkingAid())).append(",");
            builder.append(csv(row.getRecentFall())).append(",");
            builder.append(csv(row.getDisabledWork())).append(",");
            builder.append(csv(row.getMaxHours())).append(",");
            builder.append(csv(row.getMaxDistance())).append(",");
            builder.append(csv(row.getDiseaseText())).append(",");
            builder.append(csv(row.getHopeJobType())).append(",");
            builder.append(csv(row.getHopeCondition())).append(",");
            builder.append(csv(row.getJobType())).append(",");
            builder.append(csv(row.getWorkEnvironment())).append(",");
            builder.append(csv(row.getPhysicalIntensity())).append(",");
            builder.append(csv(row.getDailyHours())).append(",");
            builder.append(csv(row.getCommuteLevel())).append(",");
            builder.append(csv(row.getTaskTags())).append(",");
            builder.append(csv(Boolean.TRUE.equals(row.getClosed()) ? "true" : "false")).append("\n");
        }

        return builder.toString();
    }

    private String normalizeLabel(String label) {
        String normalized = label == null ? "" : label.trim();
        if (!ALLOWED_LABELS.contains(normalized)) {
            throw new IllegalArgumentException("label must be one of: " + String.join(", ", ALLOWED_LABELS));
        }

        return normalized;
    }

    private String diseaseText(HealthInfo healthInfo) {
        if (healthInfo == null) {
            return "";
        }

        return joinText(
                healthInfo.getDiabetes(),
                healthInfo.getHypertension(),
                healthInfo.getHeartDisease(),
                healthInfo.getJointDisease(),
                healthInfo.getStroke(),
                healthInfo.getKidneyDisease(),
                healthInfo.getLungDisease(),
                healthInfo.getLiverDisease(),
                healthInfo.getCancer(),
                healthInfo.getDementia(),
                healthInfo.getOtherDisease()
        );
    }

    private String toJson(Map<String, Double> value) {
        if (value == null || value.isEmpty()) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException error) {
            throw new IllegalArgumentException("mlProbabilities cannot be serialized.", error);
        }
    }

    private String join(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }

        return values.stream()
                .filter(Objects::nonNull)
                .filter(value -> !value.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElse(null);
    }

    private String joinText(String... values) {
        if (values == null) {
            return "";
        }

        StringBuilder builder = new StringBuilder();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                if (!builder.isEmpty()) {
                    builder.append(' ');
                }
                builder.append(value);
            }
        }

        return builder.toString();
    }

    private String blankToDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }

    private String csv(String value) {
        String text = value == null ? "" : value;
        return "\"" + text.replace("\"", "\"\"") + "\"";
    }

    public record FeedbackRequest(
            Long seniorId,
            String label,
            String source,
            Integer ruleScore,
            String ruleGrade,
            String mlPrediction,
            Integer mlScore,
            Map<String, Double> mlProbabilities,
            JobCandidate job
    ) {
    }
}
