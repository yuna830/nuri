package com.nuri.woori.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.Senior;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
public class HealthStatusMlService {

    private static final Logger log = LoggerFactory.getLogger(HealthStatusMlService.class);
    private static final Duration PROCESS_TIMEOUT = Duration.ofSeconds(20);
    private static final int MAX_RISK_SCORE = 100;

    private final ObjectMapper objectMapper;
    private final Path modelDirectory;
    private final Path pythonExecutable;

    @Autowired
    public HealthStatusMlService(ObjectMapper objectMapper) {
        this(objectMapper, resolveDefaultModelDirectory(), null);
    }

    HealthStatusMlService(ObjectMapper objectMapper, Path modelDirectory, Path pythonExecutable) {
        this.objectMapper = objectMapper;
        this.modelDirectory = modelDirectory;
        this.pythonExecutable = pythonExecutable;
    }

    private static Path resolveDefaultModelDirectory() {
        Path userDir = Path.of(System.getProperty("user.dir", ".")).toAbsolutePath().normalize();
        Path parentDir = userDir.getParent();

        List<Path> candidates = new ArrayList<>();
        candidates.add(Path.of("ml", "health_status_model"));
        candidates.add(userDir.resolve("ml").resolve("health_status_model"));
        candidates.add(userDir.resolve("woorispring").resolve("ml").resolve("health_status_model"));
        if (parentDir != null) {
            candidates.add(parentDir.resolve("woorispring").resolve("ml").resolve("health_status_model"));
        }
        candidates.add(Path.of("D:", "nuri", "nuri-geonhee", "woorispring", "ml", "health_status_model"));

        return candidates.stream()
                .map(Path::toAbsolutePath)
                .map(Path::normalize)
                .filter(path -> Files.exists(path.resolve("predict_health_status.py")))
                .findFirst()
                .orElse(Path.of("ml", "health_status_model"));
    }

    public String evaluate(Senior senior, HealthInfo healthInfo) {
        return evaluateWithDetails(senior, healthInfo).status();
    }

    public List<HealthEvaluation> evaluateAllWithDetails(List<HealthEvaluationInput> inputs) {
        if (inputs == null || inputs.isEmpty()) {
            return List.of();
        }

        List<HealthEvaluation> evaluations = new ArrayList<>(inputs.size());
        List<HealthEvaluationInput> mlInputs = new ArrayList<>();
        List<Integer> mlIndexes = new ArrayList<>();
        boolean modelAvailable = isModelAvailable();

        for (int index = 0; index < inputs.size(); index++) {
            HealthEvaluationInput input = inputs.get(index);
            HealthInfo healthInfo = input == null ? null : input.healthInfo();

            if (healthInfo == null) {
                evaluations.add(evaluateWithDetails(input == null ? null : input.senior(), null));
                continue;
            }

            if (!modelAvailable) {
                evaluations.add(buildEvaluation(fallbackEvaluate(healthInfo), "RULE_FALLBACK", null, healthInfo, null));
                continue;
            }

            evaluations.add(null);
            mlInputs.add(input);
            mlIndexes.add(index);
        }

        if (mlInputs.isEmpty()) {
            return evaluations;
        }

        try {
            List<HealthStatusPrediction> predictions = runPredictions(mlInputs);
            if (predictions.size() != mlInputs.size()) {
                throw new IllegalStateException("Health status ML prediction returned unexpected result count.");
            }

            for (int index = 0; index < mlInputs.size(); index++) {
                HealthEvaluationInput input = mlInputs.get(index);
                HealthStatusPrediction prediction = predictions.get(index);
                evaluations.set(
                        mlIndexes.get(index),
                        buildEvaluation(
                                normalizeStatus(prediction.prediction()),
                                "ML",
                                prediction.probabilities(),
                                input.healthInfo(),
                                prediction.caseValidation()
                        )
                );
            }
        } catch (IllegalStateException error) {
            log.warn("Health status batch ML prediction failed. Falling back to rule-based evaluation. reason={}", error.getMessage());
            for (int index = 0; index < mlInputs.size(); index++) {
                HealthEvaluationInput input = mlInputs.get(index);
                evaluations.set(
                        mlIndexes.get(index),
                        buildEvaluation(fallbackEvaluate(input.healthInfo()), "RULE_FALLBACK", null, input.healthInfo(), null)
                );
            }
        }

        return evaluations;
    }

    public HealthEvaluation evaluateWithDetails(Senior senior, HealthInfo healthInfo) {
        if (healthInfo == null) {
            return new HealthEvaluation(
                    "양호",
                    "NO_HEALTH_INFO",
                    Map.of("양호", 1.0, "주의", 0.0, "위험", 0.0),
                    0,
                    MAX_RISK_SCORE,
                    "건강 정보가 입력되지 않아 주의 또는 위험 설명 조건을 확인할 수 없습니다.",
                    "등록된 건강 정보가 없어 기본 양호 상태로 표시합니다.",
                    List.of(new HealthEvaluationReason(
                            "건강 정보",
                            "미등록",
                            "양호",
                            0,
                            "건강 정보가 입력되면 모델 판정과 판정 근거가 함께 표시됩니다.")),
                    null
            );
        }

        if (!isModelAvailable()) {
            return buildEvaluation(fallbackEvaluate(healthInfo), "RULE_FALLBACK", null, healthInfo, null);
        }

        try {
            HealthStatusPrediction prediction = runPrediction(senior, healthInfo);
            return buildEvaluation(
                    normalizeStatus(prediction.prediction()),
                    "ML",
                    prediction.probabilities(),
                    healthInfo,
                    prediction.caseValidation()
            );
        } catch (IllegalStateException error) {
            log.warn("Health status ML prediction failed. Falling back to rule-based evaluation. reason={}", error.getMessage());
            return buildEvaluation(fallbackEvaluate(healthInfo), "RULE_FALLBACK", null, healthInfo, null);
        }
    }

    public boolean isModelAvailable() {
        return Files.exists(modelDirectory.resolve("predict_health_status.py"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("stage1_model.joblib"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("stage2_model.joblib"))
                && Files.exists(modelDirectory.resolve("artifacts").resolve("feature_columns.json"));
    }

    private HealthStatusPrediction runPrediction(Senior senior, HealthInfo healthInfo) {
        return runPredictions(List.of(new HealthEvaluationInput(senior, healthInfo))).get(0);
    }

    private List<HealthStatusPrediction> runPredictions(List<HealthEvaluationInput> inputs) {
        Path inputPath = null;
        try {
            inputPath = Files.createTempFile("health-status-ml-", ".json");
            objectMapper.writeValue(
                    inputPath.toFile(),
                    inputs.stream()
                            .map(input -> toPredictionRow(input.senior(), input.healthInfo()))
                            .toList()
            );

            ProcessBuilder builder = new ProcessBuilder(List.of(
                    resolvePythonCommand(),
                    "predict_health_status.py",
                    "--input",
                    inputPath.toAbsolutePath().toString(),
                    "--artifacts-dir",
                    "artifacts"
            ));
            builder.directory(modelDirectory.toFile());
            builder.environment().put("PYTHONIOENCODING", "utf-8");
            builder.environment().put("PYTHONUTF8", "1");

            Process process = builder.start();
            CompletableFuture<String> stdoutFuture = readProcessOutput(process.getInputStream());
            CompletableFuture<String> stderrFuture = readProcessOutput(process.getErrorStream());
            long timeoutSeconds = Math.min(120, Math.max(PROCESS_TIMEOUT.toSeconds(), PROCESS_TIMEOUT.toSeconds() + (long) (inputs.size() - 1) * 10));
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IllegalStateException("Health status ML prediction timed out.");
            }

            String stdout = stdoutFuture.join();
            String stderr = stderrFuture.join();
            if (process.exitValue() != 0) {
                throw new IllegalStateException("Health status ML prediction failed: " + stderr);
            }

            HealthStatusScriptResponse response = objectMapper.readValue(stdout, HealthStatusScriptResponse.class);
            if (response.predictions() == null || response.predictions().isEmpty()) {
                throw new IllegalStateException("Health status ML prediction returned no result.");
            }

            return response.predictions();
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

    private CompletableFuture<String> readProcessOutput(InputStream stream) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
            } catch (IOException error) {
                throw new IllegalStateException("Failed to read health status ML process output.", error);
            }
        });
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
        row.put("walking_limited", inferWalkingLimited(healthInfo));
        row.put("fine_motor_limited", inferFineMotorLimited(healthInfo));
        row.put("recent_fall", healthInfo.getRecentFall());
        row.put("max_hours", healthInfo.getMaxHours());
        row.put("vision", healthInfo.getVision());
        row.put("hearing", healthInfo.getHearing());
        row.put("walking_aid", healthInfo.getWalkingAid());
        SurgeryFeatures surgeryFeatures = buildSurgeryFeatures(healthInfo);
        row.put("has_surgery", surgeryFeatures.hasSurgery() ? "있음" : "없음");
        row.put("surgery_count", surgeryFeatures.count());
        row.put("recent_surgery_1y", surgeryFeatures.recentOneYear() ? "있음" : "없음");
        row.put("recent_surgery_3y", surgeryFeatures.recentThreeYears() ? "있음" : "없음");
        row.put("surgery_recovery", surgeryFeatures.recoveryStatus());
        row.put("surgery_detail", surgeryFeatures.detail());
        return row;
    }

    private SurgeryFeatures buildSurgeryFeatures(HealthInfo healthInfo) {
        if (healthInfo == null) {
            return new SurgeryFeatures(false, 0, false, false, "", "");
        }

        List<String> details = new ArrayList<>();
        String fallbackDetail = safe(healthInfo.getSurgeryDetail()).trim();
        if (!fallbackDetail.isBlank()) {
            details.add(fallbackDetail);
        }

        boolean hasSurgery = hasProblem(healthInfo.getHasSurgery()) || !fallbackDetail.isBlank();
        boolean recentOneYear = false;
        boolean recentThreeYears = false;
        String recoveryStatus = "";
        int count = 0;

        String raw = safe(healthInfo.getSurgeriesJson()).trim();
        if (!raw.isBlank()) {
            try {
                JsonNode root = objectMapper.readTree(raw);
                if (root.isArray()) {
                    for (JsonNode item : root) {
                        String name = textOf(item, "name");
                        String dateText = textOf(item, "date");
                        String recovery = textOf(item, "recovery");
                        boolean hasItemValue = !name.isBlank() || !dateText.isBlank() || !recovery.isBlank();
                        if (!hasItemValue) {
                            continue;
                        }
                        count++;
                        hasSurgery = true;
                        if (!name.isBlank()) {
                            details.add(name);
                        }
                        LocalDate surgeryDate = parseDate(dateText);
                        if (surgeryDate != null) {
                            LocalDate today = LocalDate.now();
                            if (!surgeryDate.isAfter(today)) {
                                recentOneYear = recentOneYear || !surgeryDate.isBefore(today.minusYears(1));
                                recentThreeYears = recentThreeYears || !surgeryDate.isBefore(today.minusYears(3));
                            }
                        }
                        recoveryStatus = mergeRecoveryStatus(recoveryStatus, recovery);
                    }
                }
            } catch (IOException error) {
                log.warn("Failed to parse surgeriesJson for health status ML input: {}", error.getMessage());
            }
        }

        if (count == 0 && hasSurgery) {
            count = 1;
        }

        return new SurgeryFeatures(
                hasSurgery,
                count,
                recentOneYear,
                recentThreeYears,
                recoveryStatus,
                String.join(", ", details.stream().filter(value -> !value.isBlank()).distinct().limit(4).toList())
        );
    }

    private String textOf(JsonNode node, String fieldName) {
        JsonNode value = node == null ? null : node.get(fieldName);
        if (value == null || value.isNull()) {
            return "";
        }
        return value.asText("").trim();
    }

    private LocalDate parseDate(String value) {
        String text = safe(value).trim();
        if (text.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(text);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }

    private String mergeRecoveryStatus(String current, String next) {
        String value = safe(next).trim();
        if (value.isBlank()) {
            return current;
        }
        if (isRecoveryIncomplete(value)) {
            return value;
        }
        return safe(current).isBlank() ? value : current;
    }

    private boolean isRecoveryIncomplete(String value) {
        String text = safe(value).toLowerCase();
        if (text.isBlank()) {
            return false;
        }
        if (containsAny(text, "회복완료", "완료", "recovered", "complete", "정상")) {
            return false;
        }
        return containsAny(text, "회복중", "미회복", "모름", "불완전", "치료", "재활", "중", "incomplete", "recovering", "unknown");
    }

    private boolean isSurgeryRisk(SurgeryFeatures surgeryFeatures, HealthInfo healthInfo) {
        if (surgeryFeatures == null || !surgeryFeatures.hasSurgery()) {
            return false;
        }
        int maxHours = maxNumber(healthInfo.getMaxHours());
        boolean activityLimited = isNonNormal(healthInfo.getWalkingAid())
                || hasLimitedText(healthInfo.getDisabledWork())
                || (maxHours > 0 && maxHours <= 4)
                || isHighImpactSurgery(surgeryFeatures.detail());
        return surgeryFeatures.recentOneYear()
                && isRecoveryIncomplete(surgeryFeatures.recoveryStatus())
                && activityLimited;
    }

    private boolean isSurgeryCaution(SurgeryFeatures surgeryFeatures) {
        if (surgeryFeatures == null || !surgeryFeatures.hasSurgery()) {
            return false;
        }
        return surgeryFeatures.recentOneYear()
                || surgeryFeatures.recentThreeYears()
                || isRecoveryIncomplete(surgeryFeatures.recoveryStatus())
                || isHighImpactSurgery(surgeryFeatures.detail());
    }

    private boolean isHighImpactSurgery(String value) {
        String text = safe(value).toLowerCase();
        if (text.isBlank()) {
            return false;
        }
        return containsAny(text,
                "관절", "무릎", "고관절", "척추", "허리", "디스크", "골절", "인공관절",
                "심장", "스텐트", "관상동맥", "뇌", "뇌졸중", "암", "폐", "신장",
                "다리", "발목", "발", "hip", "knee", "spine", "heart", "brain", "cancer");
    }

    private String surgeryReasonValue(SurgeryFeatures surgeryFeatures) {
        List<String> parts = new ArrayList<>();
        if (surgeryFeatures.recentOneYear()) {
            parts.add("최근 1년 이내");
        } else if (surgeryFeatures.recentThreeYears()) {
            parts.add("최근 3년 이내");
        } else {
            parts.add("이력 있음");
        }
        if (!safe(surgeryFeatures.recoveryStatus()).isBlank()) {
            parts.add(surgeryFeatures.recoveryStatus());
        }
        if (!safe(surgeryFeatures.detail()).isBlank()) {
            parts.add(surgeryFeatures.detail());
        }
        return String.join(" / ", parts);
    }

    private String inferWalkingLimited(HealthInfo healthInfo) {
        boolean limited = hasLimitedValue(healthInfo.getWalkingAid())
                || hasSevereText(healthInfo.getJointDisease())
                || containsAny(safe(healthInfo.getMaxDistance()), "10분", "짧은", "가까운")
                || containsAny(safe(healthInfo.getDisabledWork()), "장시간", "계단", "운반", "보행");
        return limited ? "있음" : "없음";
    }

    private String inferFineMotorLimited(HealthInfo healthInfo) {
        boolean limited = containsAny(safe(healthInfo.getDisabledWork()), "손", "수공예", "반복", "컴퓨터", "글씨", "정밀")
                || isNonNormal(healthInfo.getVision());
        return limited ? "있음" : "없음";
    }

    private String fallbackEvaluate(HealthInfo healthInfo) {
        int diseaseCount = diseaseCount(healthInfo);
        int seriousDiseaseCount = seriousDiseaseCount(healthInfo);
        int medicineCount = maxNumber(healthInfo.getMedicineCount());
        int limitationCount = inferPhysicalLimitationCount(healthInfo);
        int maxHours = maxNumber(healthInfo.getMaxHours());
        SurgeryFeatures surgeryFeatures = buildSurgeryFeatures(healthInfo);

        if (hasProblem(healthInfo.getRecentFall())
                || seriousDiseaseCount >= 2
                || limitationCount >= 4
                || (seriousDiseaseCount >= 1 && maxHours > 0 && maxHours <= 2)
                || (medicineCount >= 6 && diseaseCount >= 2)
                || isSurgeryRisk(surgeryFeatures, healthInfo)) {
            return "위험";
        }

        if (diseaseCount >= 1
                || medicineCount >= 3
                || limitationCount >= 1
                || (maxHours > 0 && maxHours <= 4)
                || isSurgeryCaution(surgeryFeatures)) {
            return "주의";
        }

        return "양호";
    }

    private HealthEvaluation buildEvaluation(
            String status,
            String source,
            Map<String, Double> probabilities,
            HealthInfo healthInfo,
            CaseValidation caseValidation
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
                buildGradeBasis(normalizedStatus),
                buildSummary(normalizedStatus, reasons, source, caseValidation),
                reasons,
                caseValidation
        );
    }

    private List<HealthEvaluationReason> buildReasons(String status, HealthInfo healthInfo) {
        List<HealthEvaluationReason> reasons = new ArrayList<>();

        addIf(reasons, "최근 낙상", healthInfo.getRecentFall(), "위험",
                "위험 설명 조건에 해당합니다. 최근 낙상 이력이 확인되어 이동이 많거나 계단을 오가는 업무는 피하는 것이 좋습니다.",
                hasProblem(healthInfo.getRecentFall()));

        SurgeryFeatures surgeryFeatures = buildSurgeryFeatures(healthInfo);
        if (isSurgeryRisk(surgeryFeatures, healthInfo)) {
            reasons.add(new HealthEvaluationReason(
                    "수술 이력",
                    surgeryReasonValue(surgeryFeatures),
                    "위험",
                    0,
                    "위험 설명 조건에 해당합니다. 최근 수술 후 회복이 끝나지 않았거나 활동 제한과 연결될 가능성이 있어 업무 강도와 근무 시간을 보수적으로 봅니다."
            ));
        } else if (isSurgeryCaution(surgeryFeatures)) {
            reasons.add(new HealthEvaluationReason(
                    "수술 이력",
                    surgeryReasonValue(surgeryFeatures),
                    "주의",
                    0,
                    "주의 설명 조건에 해당합니다. 수술 이력과 회복 상태를 확인해 무리한 업무 배치를 피하는 것이 좋습니다."
            ));
        }

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
        addIf(reasons, "복약 수", healthInfo.getMedicineCount(), "주의",
                "주의 설명 조건에 해당합니다. 복약 수가 3개 이상으로 확인되어 근무 전 건강 상태와 복약 일정을 확인해야 합니다.",
                medicineCount >= 3);

        addIf(reasons, "보행 보조", healthInfo.getWalkingAid(), "주의",
                "주의 설명 조건에 해당합니다. 보행 보조 또는 이동 제한이 확인되어 이동이 많거나 장시간 서 있는 업무는 조정이 필요합니다.",
                isNonNormal(healthInfo.getWalkingAid()));
        addIf(reasons, "시각", healthInfo.getVision(), "주의",
                "주의 설명 조건에 해당합니다. 시각 제한이 확인되어 시야 확인이 중요한 업무는 배치 전 확인이 필요합니다.",
                isNonNormal(healthInfo.getVision()));
        addIf(reasons, "청각", healthInfo.getHearing(), "주의",
                "주의 설명 조건에 해당합니다. 청각 제한이 확인되어 안내 청취나 고객 응대가 많은 업무는 배치 전 확인이 필요합니다.",
                isNonNormal(healthInfo.getHearing()));
        addIf(reasons, "어려운 업무", healthInfo.getDisabledWork(), "주의",
                "주의 설명 조건에 해당합니다. 입력된 제한 업무는 일자리 추천 시 제외하거나 조정해야 합니다.",
                hasLimitedText(healthInfo.getDisabledWork()));

        int maxHours = maxNumber(healthInfo.getMaxHours());
        addIf(reasons, "하루 활동 가능 시간", healthInfo.getMaxHours(), "주의",
                "주의 설명 조건에 해당합니다. 하루 활동 가능 시간이 짧아 짧은 근무 시간의 공고가 우선입니다.",
                maxHours > 0 && maxHours <= 4);

        int seriousDiseaseCount = seriousDiseaseCount(healthInfo);
        if (seriousDiseaseCount >= 2) {
            String seriousDiseaseDetails = String.join(", ", seriousDiseaseDetails(healthInfo));
            reasons.add(new HealthEvaluationReason(
                    "주요 질환 수",
                    seriousDiseaseCount + "개 (" + seriousDiseaseDetails + ")",
                    "위험",
                    0,
                    "위험 설명 조건에 해당합니다. " + seriousDiseaseDetails + " 같은 중증 질환이 함께 확인되어 업무 강도와 근무 시간을 보수적으로 봅니다."
            ));
        }

        int limitationCount = inferPhysicalLimitationCount(healthInfo);
        if (limitationCount >= 2) {
            String limitationDetails = String.join(", ", physicalLimitationDetails(healthInfo));
            reasons.add(new HealthEvaluationReason(
                    "신체 제한 항목",
                    limitationCount + "개 (" + limitationDetails + ")",
                    limitationCount >= 4 ? "위험" : "주의",
                    0,
                    limitationCount >= 4
                            ? "위험 설명 조건에 해당합니다. " + limitationDetails + " 항목이 함께 확인되어 배치 조건 조정이 필요합니다."
                            : "주의 설명 조건에 해당합니다. " + limitationDetails + " 항목이 함께 확인되어 배치 조건 조정이 필요합니다."
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
                "주의 설명 조건에 해당합니다. 질환 항목이 확인되어 업무 강도와 근무 시간 조정이 필요할 수 있습니다.",
                hasProblem(value));
    }

    private void addSeriousDiseaseReason(List<HealthEvaluationReason> reasons, String label, String value) {
        addIf(reasons, label, value, hasSevereText(value) ? "위험" : "주의",
                hasSevereText(value)
                        ? "위험 설명 조건에 해당합니다. 중증 질환 상태가 확인되어 고강도 업무 배치를 피하는 것이 좋습니다."
                        : "주의 설명 조건에 해당합니다. 주요 질환 항목이 확인되어 고강도 업무 배치를 피하는 것이 좋습니다.",
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
                    0,
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

        if (isNonNormal(healthInfo.getWalkingAid())) {
            score += 20;
        }
        if (isNonNormal(healthInfo.getVision())) {
            score += 10;
        }
        if (isNonNormal(healthInfo.getHearing())) {
            score += 10;
        }
        if (hasLimitedText(healthInfo.getDisabledWork())) {
            score += 15;
        }

        int maxHours = maxNumber(healthInfo.getMaxHours());
        if (maxHours > 0 && maxHours <= 2) {
            score += 25;
        } else if (maxHours > 0 && maxHours <= 4) {
            score += 15;
        }

        SurgeryFeatures surgeryFeatures = buildSurgeryFeatures(healthInfo);
        if (isSurgeryRisk(surgeryFeatures, healthInfo)) {
            score += 25;
        } else if (isSurgeryCaution(surgeryFeatures)) {
            score += 10;
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

    private String buildGradeBasis(String status) {
        if ("위험".equals(status)) {
            return "최근 낙상, 중증 질환, 기능 제한, 최근 수술 후 회복 상태처럼 안전 확인이 필요한 신호를 우선 확인합니다.";
        }
        if ("주의".equals(status)) {
            return "질환, 복약 수, 보행/감각 제한, 활동 가능 시간처럼 배치 전 확인이 필요한 신호를 함께 확인합니다.";
        }
        return "단일 불편 항목이 있어도 전체 건강 조건에서 크게 우려할 만한 신호가 뚜렷하지 않으면 양호로 설명합니다.";
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

    private String buildSummary(String status, List<HealthEvaluationReason> reasons, String source, CaseValidation caseValidation) {
        if ("ML".equalsIgnoreCase(source)) {
            if (caseValidation != null && Boolean.TRUE.equals(caseValidation.enabled())) {
                if ("CONFIRMED".equals(caseValidation.decision())) {
                    return "ML 모델의 1차 예측을 유사 사례 CSV와 비교했고, " + caseValidation.message();
                }
                if ("ADJUSTED_BY_SIMILAR_CASES".equals(caseValidation.decision())) {
                    return "ML 모델의 1차 예측과 유사 사례 CSV를 비교한 뒤, " + caseValidation.message();
                }
                if ("REVIEW_REQUIRED".equals(caseValidation.decision())) {
                    return "ML 모델의 1차 예측과 유사 사례 CSV가 완전히 일치하지 않아 추가 검토가 필요합니다. " + caseValidation.message();
                }
            }

            String primaryLabels = reasons.stream()
                    .filter(reason -> status.equals(reason.level()) || "위험".equals(reason.level()))
                    .limit(2)
                    .map(HealthEvaluationReason::label)
                    .reduce((left, right) -> left + ", " + right)
                    .orElse("입력 건강 정보");

            if ("양호".equals(status)) {
                return "ML 모델이 양호로 예측했습니다. 주의 또는 위험 설명 조건에 해당하는 주요 조건이 확인되지 않았습니다.";
            }

            return "ML 모델이 " + status + "로 예측했습니다. " + primaryLabels + " 조건이 판정 근거로 확인되었습니다.";
        }

        if ("양호".equals(status)) {
            return "주의 또는 위험 설명 조건에 해당하는 주요 조건이 확인되지 않아 양호로 판정되었습니다.";
        }

        String primaryLabels = reasons.stream()
                .filter(reason -> status.equals(reason.level()) || "위험".equals(reason.level()))
                .limit(2)
                .map(HealthEvaluationReason::label)
                .reduce((left, right) -> left + ", " + right)
                .orElse("입력 건강 정보");

        return primaryLabels + " 조건이 확인되어 " + status + "로 판정되었습니다.";
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

    private List<String> seriousDiseaseDetails(HealthInfo healthInfo) {
        List<String> details = new ArrayList<>();
        addDetailIfPresent(details, "심장질환", healthInfo.getHeartDisease(), true);
        addDetailIfPresent(details, "뇌졸중", healthInfo.getStroke(), true);
        addDetailIfPresent(details, "신장질환", healthInfo.getKidneyDisease(), true);
        addDetailIfPresent(details, "호흡기질환", healthInfo.getLungDisease(), true);
        addDetailIfPresent(details, "암", healthInfo.getCancer(), true);
        addDetailIfPresent(details, "치매", healthInfo.getDementia(), true);
        return details;
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
        if (isNonNormal(healthInfo.getWalkingAid())) count++;
        if (isNonNormal(healthInfo.getVision())) count++;
        if (isNonNormal(healthInfo.getHearing())) count++;
        if (hasLimitedText(healthInfo.getDisabledWork())) count++;
        return count;
    }

    private List<String> physicalLimitationDetails(HealthInfo healthInfo) {
        List<String> details = new ArrayList<>();
        addDetailIfPresent(details, "보행 보조", healthInfo.getWalkingAid(), false);
        addDetailIfPresent(details, "시각", healthInfo.getVision(), false);
        addDetailIfPresent(details, "청각", healthInfo.getHearing(), false);
        if (hasLimitedText(healthInfo.getDisabledWork())) {
            addDetail(details, "어려운 업무", healthInfo.getDisabledWork());
        }
        return details;
    }

    private void addDetailIfPresent(List<String> details, String label, String value, boolean diseaseValue) {
        boolean present = diseaseValue ? hasProblem(value) : isNonNormal(value);
        if (present) {
            if (diseaseValue) {
                details.add(label);
                return;
            }
            addDetail(details, label, value);
        }
    }

    private void addDetail(List<String> details, String label, String value) {
        String safeValue = safe(value).trim();
        if (safeValue.isBlank() || "입력값 있음".equals(safeValue)) {
            details.add(label);
            return;
        }
        details.add(label + ": " + safeValue);
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

    private boolean isNonNormal(String value) {
        String text = safe(value).toLowerCase();
        if (text.isBlank()) return false;
        return !containsAny(text, "없음", "없다", "정상", "양호", "미사용", "no", "none", "false", "0");
    }

    private boolean hasLimitedValue(String value) {
        String text = safe(value).toLowerCase();
        if (text.isBlank()) {
            return false;
        }
        if (containsAny(text, "없음", "없다", "정상", "양호", "미사용", "no", "none", "false", "0")) {
            return false;
        }
        return containsAny(text, "불편", "보조", "지팡이", "보행", "어려", "제한", "필요", "사용", "힘듦",
                "침침", "흐림", "저하", "안보", "안들", "보청기", "yes", "true", "1");
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
            String mlPrediction,
            Map<String, Double> probabilities,
            CaseValidation caseValidation
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
            List<HealthEvaluationReason> reasons,
            CaseValidation caseValidation
    ) {
    }

    public record HealthEvaluationInput(
            Senior senior,
            HealthInfo healthInfo
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

    public record CaseValidation(
            Boolean enabled,
            String decision,
            String source,
            String mlPrediction,
            String casePrediction,
            String finalPrediction,
            Double modelProbability,
            String supportLevel,
            String supportText,
            Double averageSimilarity,
            Integer similarCaseCount,
            Integer agreeingCaseCount,
            Boolean agreedWithModel,
            String message,
            List<SimilarCase> examples
    ) {
    }

    public record SimilarCase(
            String label,
            Double similarity,
            String summary
    ) {
    }

    private record SurgeryFeatures(
            boolean hasSurgery,
            int count,
            boolean recentOneYear,
            boolean recentThreeYears,
            String recoveryStatus,
            String detail
    ) {
    }
}
