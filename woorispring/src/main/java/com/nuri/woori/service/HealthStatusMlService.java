package com.nuri.woori.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.Senior;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class HealthStatusMlService {

    private static final Duration PROCESS_TIMEOUT = Duration.ofSeconds(20);

    private final ObjectMapper objectMapper;
    private final Path modelDirectory;
    private final Path pythonExecutable;

    @Autowired
    public HealthStatusMlService(ObjectMapper objectMapper) {
        this(objectMapper, Path.of("ml", "health_status_model"), null);
    }

    HealthStatusMlService(ObjectMapper objectMapper, Path modelDirectory, Path pythonExecutable) {
        this.objectMapper = objectMapper;
        this.modelDirectory = modelDirectory;
        this.pythonExecutable = pythonExecutable;
    }

    public String evaluate(Senior senior, HealthInfo healthInfo) {
        if (healthInfo == null) {
            return "양호";
        }

        if (!isModelAvailable()) {
            return fallbackEvaluate(healthInfo);
        }

        try {
            return runPrediction(senior, healthInfo);
        } catch (IllegalStateException error) {
            return fallbackEvaluate(healthInfo);
        }
    }

    public boolean isModelAvailable() {
        return Files.exists(modelDirectory.resolve("predict_health_status.py"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("health_status_model.joblib"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("feature_columns.json"));
    }

    private String runPrediction(Senior senior, HealthInfo healthInfo) {
        Path inputPath = null;
        try {
            inputPath = Files.createTempFile("health-status-ml-", ".json");
            objectMapper.writeValue(inputPath.toFile(), List.of(toPredictionRow(senior, healthInfo)));

            ProcessBuilder builder = new ProcessBuilder(List.of(
                    resolvePythonCommand(),
                    "predict_health_status.py",
                    "--input",
                    inputPath.toAbsolutePath().toString(),
                    "--model",
                    "artifacts/health_status_model.joblib",
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
                throw new IllegalStateException("Health status ML prediction timed out.");
            }

            String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Health status ML prediction failed: " + stderr);
            }

            HealthStatusScriptResponse response = objectMapper.readValue(stdout, HealthStatusScriptResponse.class);
            if (response.predictions() == null || response.predictions().isEmpty()) {
                throw new IllegalStateException("Health status ML prediction returned no result.");
            }

            return normalizeStatus(response.predictions().get(0).prediction());
        } catch (IOException error) {
            throw new IllegalStateException("Failed to run health status ML prediction.", error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Health status ML prediction was interrupted.", error);
        } finally {
            if (inputPath != null) {
                try {
                    Files.deleteIfExists(inputPath);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private Map<String, Object> toPredictionRow(Senior senior, HealthInfo healthInfo) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("age", senior == null ? "" : senior.getAge());
        row.put("gender", senior == null ? "" : senior.getGender());
        row.put("height", toPlainString(healthInfo.getHeight()));
        row.put("weight", toPlainString(healthInfo.getWeight()));
        row.put("medicine_count", healthInfo.getMedicineCount());
        row.put("hypertension", healthInfo.getHypertension());
        row.put("diabetes", healthInfo.getDiabetes());
        row.put("heart_disease", healthInfo.getHeartDisease());
        row.put("joint_disease", healthInfo.getJointDisease());
        row.put("stroke", healthInfo.getStroke());
        row.put("kidney_disease", healthInfo.getKidneyDisease());
        row.put("lung_disease", healthInfo.getLungDisease());
        row.put("liver_disease", healthInfo.getLiverDisease());
        row.put("cancer", healthInfo.getCancer());
        row.put("dementia", healthInfo.getDementia());
        row.put("walking_aid", healthInfo.getWalkingAid());
        row.put("vision", healthInfo.getVision());
        row.put("hearing", healthInfo.getHearing());
        row.put("recent_fall", healthInfo.getRecentFall());
        row.put("has_surgery", healthInfo.getHasSurgery());
        row.put("physical_limitation_count", inferPhysicalLimitationCount(healthInfo));
        row.put("max_hours", healthInfo.getMaxHours());
        return row;
    }

    private String fallbackEvaluate(HealthInfo healthInfo) {
        int diseaseCount = diseaseCount(healthInfo);
        int seriousDiseaseCount = seriousDiseaseCount(healthInfo);
        int medicineCount = maxNumber(healthInfo.getMedicineCount());
        int limitationCount = inferPhysicalLimitationCount(healthInfo);
        int maxHours = maxNumber(healthInfo.getMaxHours());

        if (hasProblem(healthInfo.getRecentFall())
                || seriousDiseaseCount >= 2
                || limitationCount >= 4
                || (seriousDiseaseCount >= 1 && maxHours > 0 && maxHours <= 2)
                || (medicineCount >= 6 && diseaseCount >= 2)) {
            return "위험";
        }

        if (diseaseCount >= 1
                || medicineCount >= 3
                || limitationCount >= 1
                || (maxHours > 0 && maxHours <= 3)) {
            return "주의";
        }

        return "양호";
    }

    private int diseaseCount(HealthInfo healthInfo) {
        int count = 0;
        if (hasProblem(healthInfo.getHypertension())) count++;
        if (hasProblem(healthInfo.getDiabetes())) count++;
        if (hasProblem(healthInfo.getHeartDisease())) count++;
        if (hasProblem(healthInfo.getJointDisease())) count++;
        if (hasProblem(healthInfo.getStroke())) count++;
        if (hasProblem(healthInfo.getKidneyDisease())) count++;
        if (hasProblem(healthInfo.getLungDisease())) count++;
        if (hasProblem(healthInfo.getLiverDisease())) count++;
        if (hasProblem(healthInfo.getCancer())) count++;
        if (hasProblem(healthInfo.getDementia())) count++;
        if (hasProblem(healthInfo.getOtherDisease())) count++;
        return count;
    }

    private int seriousDiseaseCount(HealthInfo healthInfo) {
        int count = 0;
        if (hasProblem(healthInfo.getHeartDisease())) count++;
        if (hasProblem(healthInfo.getStroke())) count++;
        if (hasProblem(healthInfo.getKidneyDisease())) count++;
        if (hasProblem(healthInfo.getLungDisease())) count++;
        if (hasProblem(healthInfo.getCancer())) count++;
        if (hasProblem(healthInfo.getDementia())) count++;
        return count;
    }

    private int inferPhysicalLimitationCount(HealthInfo healthInfo) {
        int count = 0;
        if (hasLimitedValue(healthInfo.getWalkingAid())) count++;
        if (hasLimitedValue(healthInfo.getVision())) count++;
        if (hasLimitedValue(healthInfo.getHearing())) count++;
        if (hasLimitedText(healthInfo.getDisabledWork())) count++;
        return count;
    }

    private boolean hasProblem(String value) {
        String text = safe(value).toLowerCase();
        if (text.isBlank()) {
            return false;
        }
        if (containsAny(text, "없음", "없다", "정상", "양호", "아니오", "no", "none", "false", "0")) {
            return false;
        }
        return containsAny(text, "있음", "있다", "주의", "위험", "질환", "진단", "치료", "관리", "제한", "중증", "경증", "yes", "true", "1");
    }

    private boolean hasLimitedValue(String value) {
        String text = safe(value).toLowerCase();
        if (text.isBlank()) {
            return false;
        }
        if (containsAny(text, "없음", "없다", "정상", "양호", "미사용", "no", "none", "false", "0")) {
            return false;
        }
        return containsAny(text, "불편", "보조", "지팡이", "보행", "어려", "제한", "필요", "사용", "약함", "yes", "true", "1");
    }

    private boolean hasLimitedText(String value) {
        String text = safe(value);
        return containsAny(text, "장시간", "계단", "무거운", "운반", "야외 불가", "어려움", "제한", "불편");
    }

    private int maxNumber(String value) {
        String text = safe(value);
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("\\d+").matcher(text);
        int max = 0;
        while (matcher.find()) {
            max = Math.max(max, Integer.parseInt(matcher.group()));
        }
        return max;
    }

    private String resolvePythonCommand() {
        if (pythonExecutable != null) {
            return pythonExecutable.toAbsolutePath().normalize().toString();
        }

        Path healthModelVenvPython = modelDirectory.resolve(".venv").resolve("Scripts").resolve("python.exe");
        if (Files.exists(healthModelVenvPython)) {
            return healthModelVenvPython.toAbsolutePath().normalize().toString();
        }

        Path sharedWindowsVenvPython = Path.of("ml", "job_matching_model", ".venv", "Scripts", "python.exe");
        if (Files.exists(sharedWindowsVenvPython)) {
            return sharedWindowsVenvPython.toAbsolutePath().normalize().toString();
        }

        Path healthModelUnixVenvPython = modelDirectory.resolve(".venv").resolve("bin").resolve("python");
        if (Files.exists(healthModelUnixVenvPython)) {
            return healthModelUnixVenvPython.toAbsolutePath().normalize().toString();
        }

        return "python";
    }

    private String normalizeStatus(String value) {
        if ("위험".equals(value) || "주의".equals(value) || "양호".equals(value)) {
            return value;
        }
        return "양호";
    }

    private String toPlainString(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    private boolean containsAny(String text, String... keywords) {
        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }
        return false;
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }

    private record HealthStatusScriptResponse(
            List<HealthStatusPrediction> predictions
    ) {
    }

    private record HealthStatusPrediction(
            String prediction,
            Map<String, Double> probabilities
    ) {
    }
}
