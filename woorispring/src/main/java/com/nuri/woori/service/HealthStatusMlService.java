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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
public class HealthStatusMlService {

    private static final Duration PROCESS_TIMEOUT = Duration.ofSeconds(20);
    private static final int MAX_RISK_SCORE = 100;

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
        return evaluateWithDetails(senior, healthInfo).status();
    }

    public HealthEvaluation evaluateWithDetails(Senior senior, HealthInfo healthInfo) {
        if (healthInfo == null) {
            return new HealthEvaluation(
                    "양호",
                    "NO_HEALTH_INFO",
                    Map.of("양호", 1.0, "주의", 0.0, "위험", 0.0),
                    0,
                    MAX_RISK_SCORE,
                    "0~24점은 양호, 25~59점은 주의, 60점 이상은 위험 기준입니다.",
                    "등록된 건강 정보가 없어 기본 양호 상태로 표시합니다.",
                    List.of(new HealthEvaluationReason(
                            "건강 정보",
                            "미등록",
                            "양호",
                            0,
                            "건강 정보가 입력되면 모델 판정과 판정 근거가 함께 표시됩니다."))
            );
        }

        if (!isModelAvailable()) {
            return buildEvaluation(fallbackEvaluate(healthInfo), "RULE_FALLBACK", null, healthInfo);
        }

        try {
            HealthStatusPrediction prediction = runPrediction(senior, healthInfo);
            return buildEvaluation(
                    normalizeStatus(prediction.prediction()),
                    "ML",
                    prediction.probabilities(),
                    healthInfo
            );
        } catch (IllegalStateException error) {
            return buildEvaluation(fallbackEvaluate(healthInfo), "RULE_FALLBACK", null, healthInfo);
        }
    }

    public boolean isModelAvailable() {
        return Files.exists(modelDirectory.resolve("predict_health_status.py"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("stage1_model.joblib"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("stage2_model.joblib"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("feature_columns.json"));
    }

    private HealthStatusPrediction runPrediction(Senior senior, HealthInfo healthInfo) {
        Path inputPath = null;
        try {
            inputPath = Files.createTempFile("health-status-ml-", ".json");
            objectMapper.writeValue(inputPath.toFile(), List.of(toPredictionRow(senior, healthInfo)));

            ProcessBuilder builder = new ProcessBuilder(List.of(
                    resolvePythonCommand(),
                    "predict_health_status.py",
                    "--input",
                    inputPath.toAbsolutePath().toString()
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

            return response.predictions().get(0);
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
        row.put("walking_limited", healthInfo.getWalkingAid());
        row.put("fine_motor_limited", "");
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

    private HealthEvaluation buildEvaluation(
            String status,
            String source,
            Map<String, Double> probabilities,
            HealthInfo healthInfo
    ) {
        String normalizedStatus = normalizeStatus(status);
        List<HealthEvaluationReason> reasons = buildReasons(normalizedStatus, healthInfo);
        int riskScore = calculateRiskScore(healthInfo);

        return new HealthEvaluation(
                normalizedStatus,
                source,
                normalizeProbabilities(normalizedStatus, probabilities),
                riskScore,
                MAX_RISK_SCORE,
                buildGradeBasis(riskScore),
                buildSummary(normalizedStatus, riskScore, reasons),
                reasons
        );
    }

    private List<HealthEvaluationReason> buildReasons(String status, HealthInfo healthInfo) {
        List<HealthEvaluationReason> reasons = new ArrayList<>();

        addIf(reasons, "최근 낙상", healthInfo.getRecentFall(), "위험",
                "최근 낙상 이력이 있어 이동이 많은 업무나 계단 이동 업무는 주의가 필요합니다.",
                hasProblem(healthInfo.getRecentFall()));

        addSeriousDiseaseReason(reasons, "심장질환", healthInfo.getHeartDisease());
        addSeriousDiseaseReason(reasons, "뇌졸중", healthInfo.getStroke());
        addSeriousDiseaseReason(reasons, "신장질환", healthInfo.getKidneyDisease());
        addSeriousDiseaseReason(reasons, "호흡기질환", healthInfo.getLungDisease());
        addSeriousDiseaseReason(reasons, "암", healthInfo.getCancer());
        addSeriousDiseaseReason(reasons, "치매", healthInfo.getDementia());

        addDiseaseReason(reasons, "고혈압", healthInfo.getHypertension());
        addDiseaseReason(reasons, "당뇨", healthInfo.getDiabetes());
        addDiseaseReason(reasons, "관절질환", healthInfo.getJointDisease());
        addDiseaseReason(reasons, "간질환", healthInfo.getLiverDisease());
        addDiseaseReason(reasons, "기타 질환", healthInfo.getOtherDisease());

        int medicineCount = maxNumber(healthInfo.getMedicineCount());
        addIf(reasons, "복약 수", healthInfo.getMedicineCount(), medicineCount >= 6 ? "위험" : "주의",
                "복약 수가 많아 근무 전 건강 상태 확인과 복약 일정 조정이 필요합니다.",
                medicineCount >= 3);

        addIf(reasons, "보행 보조", healthInfo.getWalkingAid(), "주의",
                "이동이 많거나 장시간 서 있는 업무는 조정이 필요합니다.",
                hasLimitedValue(healthInfo.getWalkingAid()));
        addIf(reasons, "시각", healthInfo.getVision(), "주의",
                "시야 확인이 중요한 업무는 배치 전 확인이 필요합니다.",
                hasLimitedValue(healthInfo.getVision()));
        addIf(reasons, "청각", healthInfo.getHearing(), "주의",
                "안내 청취나 고객 응대가 많은 업무는 배치 전 확인이 필요합니다.",
                hasLimitedValue(healthInfo.getHearing()));
        addIf(reasons, "어려운 업무", healthInfo.getDisabledWork(), "주의",
                "입력된 제한 업무는 일자리 추천 시 제외하거나 조정해야 합니다.",
                hasLimitedText(healthInfo.getDisabledWork()));

        int maxHours = maxNumber(healthInfo.getMaxHours());
        addIf(reasons, "하루 활동 가능 시간", healthInfo.getMaxHours(), maxHours <= 2 ? "위험" : "주의",
                "하루 활동 가능 시간이 짧아 짧은 근무 시간의 공고가 우선입니다.",
                maxHours > 0 && maxHours <= 3);

        int seriousDiseaseCount = seriousDiseaseCount(healthInfo);
        if (seriousDiseaseCount >= 2) {
            reasons.add(new HealthEvaluationReason(
                    "주요 질환 수",
                    seriousDiseaseCount + "개",
                    "위험",
                    15,
                    "주요 질환이 복수로 확인되어 업무 강도와 근무 시간을 보수적으로 봅니다."
            ));
        }

        int limitationCount = inferPhysicalLimitationCount(healthInfo);
        if (limitationCount >= 2) {
            reasons.add(new HealthEvaluationReason(
                    "신체 제한 항목",
                    limitationCount + "개",
                    limitationCount >= 4 ? "위험" : "주의",
                    limitationCount >= 4 ? 20 : 10,
                    "보행, 감각, 어려운 업무 항목이 함께 확인되어 배치 조건 조정이 필요합니다."
            ));
        }

        if (reasons.isEmpty()) {
            reasons.add(new HealthEvaluationReason(
                    "주의/위험 조건",
                    "감지되지 않음",
                    "양호",
                    0,
                    "현재 입력된 건강 정보에서는 주요 위험 요인이 확인되지 않았습니다."
            ));
        }

        return reasons;
    }

    private void addDiseaseReason(List<HealthEvaluationReason> reasons, String label, String value) {
        addIf(reasons, label, value, "주의",
                "질환 항목이 확인되어 업무 강도와 근무 시간 조정이 필요할 수 있습니다.",
                hasProblem(value));
    }

    private void addSeriousDiseaseReason(List<HealthEvaluationReason> reasons, String label, String value) {
        addIf(reasons, label, value, hasSevereText(value) ? "위험" : "주의",
                "주요 질환 항목이 확인되어 고강도 업무 배치를 피하는 것이 좋습니다.",
                hasProblem(value));
    }

    private void addIf(
            List<HealthEvaluationReason> reasons,
            String label,
            String value,
            String level,
            String description,
            boolean condition
    ) {
        if (condition) {
            reasons.add(new HealthEvaluationReason(
                    label,
                    safe(value).isBlank() ? "입력값 있음" : value,
                    level,
                    reasonScore(label, value, level),
                    description
            ));
        }
    }

    private int calculateRiskScore(HealthInfo healthInfo) {
        int score = 0;

        if (hasProblem(healthInfo.getRecentFall())) {
            score += 40;
        }

        score += Math.min(60, seriousDiseaseCount(healthInfo) * 30);
        score += Math.min(30, generalDiseaseCount(healthInfo) * 15);

        int medicineCount = maxNumber(healthInfo.getMedicineCount());
        if (medicineCount >= 6) {
            score += 20;
        } else if (medicineCount >= 3) {
            score += 10;
        }

        if (hasLimitedValue(healthInfo.getWalkingAid())) {
            score += 20;
        }
        if (hasLimitedValue(healthInfo.getVision())) {
            score += 10;
        }
        if (hasLimitedValue(healthInfo.getHearing())) {
            score += 10;
        }
        if (hasLimitedText(healthInfo.getDisabledWork())) {
            score += 15;
        }

        int maxHours = maxNumber(healthInfo.getMaxHours());
        if (maxHours > 0 && maxHours <= 2) {
            score += 25;
        } else if (maxHours > 0 && maxHours <= 3) {
            score += 15;
        }

        if (seriousDiseaseCount(healthInfo) >= 2) {
            score += 15;
        }
        if (inferPhysicalLimitationCount(healthInfo) >= 2) {
            score += 10;
        }

        return Math.min(MAX_RISK_SCORE, Math.max(0, score));
    }

    private int reasonScore(String label, String value, String level) {
        if ("최근 낙상".equals(label)) {
            return 40;
        }
        if ("복약 수".equals(label)) {
            int count = maxNumber(value);
            return count >= 6 ? 20 : 10;
        }
        if ("보행 보조".equals(label)) {
            return 20;
        }
        if ("시각".equals(label) || "청각".equals(label)) {
            return 10;
        }
        if ("어려운 업무".equals(label)) {
            return 15;
        }
        if ("하루 활동 가능 시간".equals(label)) {
            int hours = maxNumber(value);
            return hours > 0 && hours <= 2 ? 25 : 15;
        }
        if ("위험".equals(level)) {
            return 30;
        }
        if ("주의".equals(level)) {
            return 15;
        }
        return 0;
    }

    private String buildGradeBasis(int riskScore) {
        String grade = gradeByRiskScore(riskScore);
        return riskScore + "점은 " + grade + " 기준입니다. 0~24점은 양호, 25~59점은 주의, 60점 이상은 위험으로 설명합니다.";
    }

    private String gradeByRiskScore(int riskScore) {
        if (riskScore >= 60) {
            return "위험";
        }
        if (riskScore >= 25) {
            return "주의";
        }
        return "양호";
    }

    private String buildSummary(String status, int riskScore, List<HealthEvaluationReason> reasons) {
        if ("양호".equals(status)) {
            return "위험 점수 " + riskScore + "점으로 주의 또는 위험으로 볼 만한 건강 조건이 감지되지 않아 양호로 판정되었습니다.";
        }

        String primaryLabels = reasons.stream()
                .filter(reason -> status.equals(reason.level()) || "위험".equals(reason.level()))
                .limit(2)
                .map(HealthEvaluationReason::label)
                .reduce((left, right) -> left + ", " + right)
                .orElse("입력 건강 정보");

        return "위험 점수 " + riskScore + "점입니다. " + primaryLabels + " 항목이 판정에 영향을 주어 " + status + "로 판정되었습니다.";
    }

    private Map<String, Double> normalizeProbabilities(String status, Map<String, Double> probabilities) {
        Map<String, Double> normalized = new LinkedHashMap<>();
        normalized.put("양호", 0.0);
        normalized.put("주의", 0.0);
        normalized.put("위험", 0.0);

        if (probabilities != null) {
            probabilities.forEach((key, value) -> {
                String normalizedKey = normalizeStatus(key);
                normalized.put(normalizedKey, value == null ? 0.0 : value);
            });
        }

        double total = normalized.values().stream().mapToDouble(Double::doubleValue).sum();
        if (total <= 0) {
            normalized.put(status, 1.0);
        }

        return normalized;
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

    private int generalDiseaseCount(HealthInfo healthInfo) {
        int count = 0;
        if (hasProblem(healthInfo.getHypertension())) count++;
        if (hasProblem(healthInfo.getDiabetes())) count++;
        if (hasProblem(healthInfo.getJointDisease())) count++;
        if (hasProblem(healthInfo.getLiverDisease())) count++;
        if (hasProblem(healthInfo.getOtherDisease())) count++;
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
        return containsAny(text, "불편", "보조", "지팡이", "보행", "어려", "제한", "필요", "사용", "힘듦", "yes", "true", "1");
    }

    private boolean hasLimitedText(String value) {
        String text = safe(value);
        return containsAny(text, "장시간", "계단", "무거운", "운반", "야외 불가", "어려움", "제한", "불편");
    }

    private boolean hasSevereText(String value) {
        String text = safe(value).toLowerCase();
        return containsAny(text, "위험", "중증", "치료", "제한", "활동 제한", "관리 필요", "danger", "severe");
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
        String text = safe(value);
        if (text.contains("위험") || text.contains("꾪뿕")) {
            return "위험";
        }
        if (text.contains("주의") || text.contains("二쇱쓽")) {
            return "주의";
        }
        if (text.contains("양호") || text.contains("묓샇")) {
            return "양호";
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

    public record HealthEvaluation(
            String status,
            String source,
            Map<String, Double> probabilities,
            Integer riskScore,
            Integer maxRiskScore,
            String gradeBasis,
            String summary,
            List<HealthEvaluationReason> reasons
    ) {
    }

    public record HealthEvaluationReason(
            String label,
            String value,
            String level,
            Integer score,
            String description
    ) {
    }
}
