package com.nuri.woori.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.JobPreference;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.JobPreferenceRepository;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.service.JobMatchingService.JobCandidate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Service
public class JobMatchingMlService {

    private static final Duration PROCESS_TIMEOUT = Duration.ofSeconds(30);

    private final SeniorRepository seniorRepository;
    private final HealthInfoRepository healthInfoRepository;
    private final JobPreferenceRepository jobPreferenceRepository;
    private final ObjectMapper objectMapper;
    private final Path modelDirectory;
    private final Path pythonExecutable;

    @Autowired
    public JobMatchingMlService(
            SeniorRepository seniorRepository,
            HealthInfoRepository healthInfoRepository,
            JobPreferenceRepository jobPreferenceRepository,
            ObjectMapper objectMapper
    ) {
        this(
                seniorRepository,
                healthInfoRepository,
                jobPreferenceRepository,
                objectMapper,
                Path.of("ml", "job_matching_model"),
                null
        );
    }

    JobMatchingMlService(
            SeniorRepository seniorRepository,
            HealthInfoRepository healthInfoRepository,
            JobPreferenceRepository jobPreferenceRepository,
            ObjectMapper objectMapper,
            Path modelDirectory,
            Path pythonExecutable
    ) {
        this.seniorRepository = seniorRepository;
        this.healthInfoRepository = healthInfoRepository;
        this.jobPreferenceRepository = jobPreferenceRepository;
        this.objectMapper = objectMapper;
        this.modelDirectory = modelDirectory;
        this.pythonExecutable = pythonExecutable;
    }

    public MlRecommendationResponse recommend(Long seniorId, List<JobCandidate> jobs, Integer limit) {
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new NoSuchElementException("Senior not found: " + seniorId));

        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(seniorId)
                .orElse(null);

        JobPreference jobPreference = jobPreferenceRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(seniorId)
                .orElse(null);

        int resultLimit = normalizeLimit(limit);
        if (resultLimit == 0 || jobs == null || jobs.isEmpty()) {
            return new MlRecommendationResponse(seniorId, isModelAvailable(), List.of(), null);
        }

        List<JobCandidate> openJobs = jobs.stream()
                .filter(Objects::nonNull)
                .filter(job -> !Boolean.TRUE.equals(job.closed()))
                .toList();

        if (openJobs.isEmpty()) {
            return new MlRecommendationResponse(seniorId, isModelAvailable(), List.of(), null);
        }

        if (!isModelAvailable()) {
            throw new IllegalStateException("ML model artifacts not found. Run train_job_matching_model.py first.");
        }

        List<Map<String, Object>> rows = openJobs.stream()
                .map(job -> toPredictionRow(senior, healthInfo, jobPreference, job))
                .toList();

        List<MlScriptPrediction> predictions = runPrediction(rows);
        Map<String, JobCandidate> jobsById = openJobs.stream()
                .filter(job -> job.jobId() != null)
                .collect(Collectors.toMap(JobCandidate::jobId, job -> job, (left, right) -> left, LinkedHashMap::new));

        List<MlJobRecommendation> recommendations = predictions.stream()
                .map(prediction -> toRecommendation(prediction, jobsById))
                .sorted(Comparator
                        .comparingInt(MlJobRecommendation::score)
                        .reversed()
                        .thenComparing(recommendation -> safe(recommendation.title())))
                .limit(resultLimit)
                .toList();

        return new MlRecommendationResponse(seniorId, true, recommendations, null);
    }

    public boolean isModelAvailable() {
        return Files.exists(modelDirectory.resolve("predict_job_match.py"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("job_matching_model.joblib"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("feature_columns.json"));
    }

    private List<MlScriptPrediction> runPrediction(List<Map<String, Object>> rows) {
        Path inputPath = null;
        try {
            inputPath = Files.createTempFile("job-matching-ml-", ".json");
            objectMapper.writeValue(inputPath.toFile(), rows);

            ProcessBuilder builder = new ProcessBuilder(List.of(
                    resolvePythonCommand(),
                    "predict_job_match.py",
                    "--input",
                    inputPath.toAbsolutePath().toString(),
                    "--model",
                    "artifacts/job_matching_model.joblib",
                    "--feature-columns",
                    "artifacts/feature_columns.json"
            ));
            builder.directory(modelDirectory.toFile());
            builder.environment().put("PYTHONIOENCODING", "utf-8");
            builder.environment().put("PYTHONUTF8", "1");

            Process process = builder.start();
            boolean finished = process.waitFor(PROCESS_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IllegalStateException("ML prediction timed out.");
            }

            String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.exitValue() != 0) {
                throw new IllegalStateException("ML prediction failed: " + stderr);
            }

            MlScriptResponse response = objectMapper.readValue(stdout, MlScriptResponse.class);
            return response.predictions() == null ? List.of() : response.predictions();
        } catch (IOException error) {
            throw new IllegalStateException("Failed to run ML prediction.", error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("ML prediction was interrupted.", error);
        } finally {
            if (inputPath != null) {
                try {
                    Files.deleteIfExists(inputPath);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private String resolvePythonCommand() {
        if (pythonExecutable != null) {
            return pythonExecutable.toAbsolutePath().normalize().toString();
        }

        Path windowsVenvPython = modelDirectory.resolve(".venv").resolve("Scripts").resolve("python.exe");
        if (Files.exists(windowsVenvPython)) {
            return windowsVenvPython.toAbsolutePath().normalize().toString();
        }

        Path unixVenvPython = modelDirectory.resolve(".venv").resolve("bin").resolve("python");
        if (Files.exists(unixVenvPython)) {
            return unixVenvPython.toAbsolutePath().normalize().toString();
        }

        return "python";
    }

    private Map<String, Object> toPredictionRow(
            Senior senior,
            HealthInfo healthInfo,
            JobPreference jobPreference,
            JobCandidate job
    ) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("jobId", job.jobId());
        row.put("title", job.title());
        row.put("health_status", healthInfo == null ? "" : healthInfo.getHealthStatus());
        row.put("medicine_count", healthInfo == null ? "" : healthInfo.getMedicineCount());
        row.put("walking_aid", healthInfo == null ? "" : healthInfo.getWalkingAid());
        row.put("recent_fall", healthInfo == null ? "" : healthInfo.getRecentFall());
        row.put("disabled_work", healthInfo == null ? "" : healthInfo.getDisabledWork());
        row.put("max_hours", healthInfo == null ? "" : healthInfo.getMaxHours());
        row.put("max_distance", healthInfo == null ? "" : healthInfo.getMaxDistance());
        row.put("disease_text", diseaseText(healthInfo));
        row.put("hope_job_type", jobPreference == null ? "" : jobPreference.getHopeJobType());
        row.put("hope_condition", jobPreference == null ? "" : joinText(jobPreference.getHopeCondition(), jobPreference.getMemo()));
        row.put("job_type", job.jobType());
        row.put("work_environment", job.workEnvironment());
        row.put("physical_intensity", job.physicalIntensity());
        row.put("daily_hours", job.dailyHours());
        row.put("commute_level", job.commuteLevel());
        row.put("task_tags", job.taskTags() == null ? "" : String.join(" ", job.taskTags()));
        row.put("closed", Boolean.TRUE.equals(job.closed()));
        row.put("senior_disability_type", senior == null ? "" : senior.getDisabilityType());
        return row;
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

    private MlJobRecommendation toRecommendation(
            MlScriptPrediction prediction,
            Map<String, JobCandidate> jobsById
    ) {
        JobCandidate job = jobsById.get(prediction.jobId());
        Map<String, Double> probabilities = prediction.probabilities() == null
                ? Map.of()
                : prediction.probabilities();

        return new MlJobRecommendation(
                prediction.jobId(),
                prediction.title(),
                job == null ? null : job.organization(),
                job == null ? null : job.jobType(),
                prediction.prediction(),
                probabilityScore(probabilities),
                probabilities
        );
    }

    private int probabilityScore(Map<String, Double> probabilities) {
        double fitProbability = Optional.ofNullable(probabilities.get("적합")).orElse(0.0);
        if (fitProbability == 0.0 && !probabilities.isEmpty()) {
            fitProbability = probabilities.values()
                    .stream()
                    .mapToDouble(Double::doubleValue)
                    .max()
                    .orElse(0.0);
        }

        return (int) Math.round(fitProbability * 100);
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return 5;
        }

        return Math.max(0, Math.min(limit, 20));
    }

    private String joinText(String... values) {
        List<String> parts = new ArrayList<>();
        if (values != null) {
            for (String value : values) {
                if (value != null && !value.isBlank()) {
                    parts.add(value);
                }
            }
        }

        return String.join(" ", parts);
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    public record MlRecommendationResponse(
            Long seniorId,
            boolean modelAvailable,
            List<MlJobRecommendation> recommendations,
            String message
    ) {
    }

    public record MlJobRecommendation(
            String jobId,
            String title,
            String organization,
            String jobType,
            String prediction,
            int score,
            Map<String, Double> probabilities
    ) {
    }

    private record MlScriptResponse(
            List<MlScriptPrediction> predictions
    ) {
    }

    private record MlScriptPrediction(
            String jobId,
            String title,
            String prediction,
            Map<String, Double> probabilities
    ) {
    }
}
