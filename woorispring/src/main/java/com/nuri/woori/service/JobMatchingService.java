package com.nuri.woori.service;

import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.JobPreference;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.JobPreferenceRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class JobMatchingService {

    private static final int BASE_SCORE = 50;
    private static final Pattern NUMBER_PATTERN = Pattern.compile("\\d+");

    private final SeniorRepository seniorRepository;
    private final HealthInfoRepository healthInfoRepository;
    private final JobPreferenceRepository jobPreferenceRepository;

    public JobMatchingService(
            SeniorRepository seniorRepository,
            HealthInfoRepository healthInfoRepository,
            JobPreferenceRepository jobPreferenceRepository
    ) {
        this.seniorRepository = seniorRepository;
        this.healthInfoRepository = healthInfoRepository;
        this.jobPreferenceRepository = jobPreferenceRepository;
    }

    public List<JobRecommendation> recommend(Long seniorId, List<JobCandidate> jobs, Integer limit) {
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
            return List.of();
        }

        return jobs.stream()
                .filter(Objects::nonNull)
                .filter(job -> !Boolean.TRUE.equals(job.closed()))
                .map(job -> scoreJob(senior, healthInfo, jobPreference, job))
                .sorted(Comparator
                        .comparingInt(JobRecommendation::score)
                        .reversed()
                        .thenComparing(recommendation -> safe(recommendation.title())))
                .limit(resultLimit)
                .toList();
    }

    private JobRecommendation scoreJob(
            Senior senior,
            HealthInfo healthInfo,
            JobPreference jobPreference,
            JobCandidate job
    ) {
        int score = BASE_SCORE;
        List<String> reasons = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        if (matchesPreference(text(jobPreference == null ? null : jobPreference.getHopeJobType()), job.jobType(), job.title())) {
            score += 20;
            reasons.add("희망 직종과 공고 직종이 일치합니다.");
        }

        Integer maxHours = maxNumber(healthInfo == null ? null : healthInfo.getMaxHours());
        Integer dailyHours = maxNumber(job.dailyHours());
        if (maxHours != null && dailyHours != null) {
            if (dailyHours <= maxHours) {
                score += 20;
                reasons.add("하루 활동 가능 시간 안에 근무 시간이 들어옵니다.");
            } else {
                score -= 10;
                warnings.add("하루 활동 가능 시간보다 공고 근무 시간이 깁니다.");
            }
        }

        Integer maxCommuteRank = commuteRank(healthInfo == null ? null : healthInfo.getMaxDistance());
        Integer jobCommuteRank = commuteRank(job.commuteLevel());
        if (isLongDistanceCommute(job.commuteLevel())) {
            score -= 35;
            warnings.add("대상자 거주 지역과 공고 지역이 달라 이동 부담이 큽니다.");
        } else if (maxCommuteRank != null && jobCommuteRank != null) {
            if (jobCommuteRank <= maxCommuteRank) {
                score += 15;
                reasons.add("이동 가능 거리 조건을 충족합니다.");
            } else {
                score -= 20;
                warnings.add("이동 가능 거리보다 공고 이동 조건이 멉니다.");
            }
        }

        if (matchesHopeCondition(jobPreference, job)) {
            score += 10;
            reasons.add("희망 근무 조건과 공고 조건이 일부 일치합니다.");
        }

        if (prefersIndoorOrSafe(healthInfo, jobPreference) && isIndoorOrMixed(job.workEnvironment())) {
            score += 10;
            reasons.add("실내 또는 안전 근무 선호와 공고 환경이 맞습니다.");
        }

        if (hasOutdoorDifficulty(healthInfo, jobPreference) && containsAny(job.workEnvironment(), "야외")) {
            score -= 30;
            warnings.add("야외 작업이 어려운 조건인데 야외 공고입니다.");
        }

        if (hasStandingDifficulty(healthInfo, jobPreference) && hasTaskTag(job, "장시간 서있기", "서있기", "오래 서기")) {
            score -= 25;
            warnings.add("장시간 서있기 어려운 조건인데 해당 업무가 포함되어 있습니다.");
        }

        if (hasHeavyLiftingDifficulty(healthInfo, jobPreference) && hasTaskTag(job, "무거운 물건", "운반", "상하차")) {
            score -= 30;
            warnings.add("무거운 물건 운반이 어려운 조건인데 해당 업무가 포함되어 있습니다.");
        }

        if (hasWalkingDifficulty(senior, healthInfo) && hasMovementOrStairs(job)) {
            score -= 25;
            warnings.add("보행 상태를 고려하면 이동 또는 계단 업무에 주의가 필요합니다.");
        }

        if (containsAny(healthInfo == null ? null : healthInfo.getHealthStatus(), "위험")
                && containsAny(job.physicalIntensity(), "높음", "고강도")) {
            score -= 40;
            warnings.add("건강 상태가 위험인데 고강도 업무입니다.");
        }

        if (hasSevereDisease(healthInfo)
                && containsAny(job.physicalIntensity(), "중간", "높음", "고강도")) {
            score -= 20;
            warnings.add("주요 질환 상태를 고려하면 중간 이상 강도 업무는 검토가 필요합니다.");
        }

        if (hasMultipleRecentFalls(healthInfo == null ? null : healthInfo.getRecentFall()) && hasMovementOrStairs(job)) {
            score -= 15;
            warnings.add("최근 낙상 이력이 반복되어 이동 또는 계단 업무에 주의가 필요합니다.");
        }

        int finalScore = clamp(score);
        return new JobRecommendation(
                job.jobId(),
                job.title(),
                job.organization(),
                job.jobType(),
                finalScore,
                grade(finalScore),
                List.copyOf(reasons),
                List.copyOf(warnings)
        );
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null) {
            return 5;
        }

        return Math.max(0, Math.min(limit, 20));
    }

    private int clamp(int score) {
        return Math.max(0, Math.min(score, 100));
    }

    private String grade(int score) {
        if (score >= 80) {
            return "적합";
        }

        if (score >= 60) {
            return "검토";
        }

        return "부적합";
    }

    private boolean matchesHopeCondition(JobPreference jobPreference, JobCandidate job) {
        if (jobPreference == null) {
            return false;
        }

        String hopeCondition = joinText(jobPreference.getHopeCondition(), jobPreference.getMemo(), jobPreference.getHopeDays());
        String jobCondition = joinText(
                job.workCondition(),
                job.workEnvironment(),
                job.jobType(),
                job.title(),
                joinText(job.taskTags()),
                joinText(job.workDays())
        );

        return matchesPreference(hopeCondition, jobCondition);
    }

    private boolean prefersIndoorOrSafe(HealthInfo healthInfo, JobPreference jobPreference) {
        String condition = joinText(
                healthInfo == null ? null : healthInfo.getDisabledWork(),
                jobPreference == null ? null : jobPreference.getHopeCondition(),
                jobPreference == null ? null : jobPreference.getMemo()
        );

        return containsAny(condition, "실내", "안전", "가벼운", "무리 없는");
    }

    private boolean hasOutdoorDifficulty(HealthInfo healthInfo, JobPreference jobPreference) {
        String condition = joinText(
                healthInfo == null ? null : healthInfo.getDisabledWork(),
                jobPreference == null ? null : jobPreference.getHopeCondition(),
                jobPreference == null ? null : jobPreference.getMemo()
        );

        return containsAny(condition, "야외 불가", "야외 어려", "야외 힘", "실내 선호", "실내만", "실내 위주");
    }

    private boolean hasStandingDifficulty(HealthInfo healthInfo, JobPreference jobPreference) {
        String condition = joinText(
                healthInfo == null ? null : healthInfo.getDisabledWork(),
                healthInfo == null ? null : healthInfo.getJointDisease(),
                jobPreference == null ? null : jobPreference.getHopeCondition(),
                jobPreference == null ? null : jobPreference.getMemo()
        );

        return containsAny(condition, "장시간 서", "오래 서", "서있기 어려", "서기 어려", "관절 통증");
    }

    private boolean hasHeavyLiftingDifficulty(HealthInfo healthInfo, JobPreference jobPreference) {
        String condition = joinText(
                healthInfo == null ? null : healthInfo.getDisabledWork(),
                healthInfo == null ? null : healthInfo.getJointDisease(),
                healthInfo == null ? null : healthInfo.getHeartDisease(),
                jobPreference == null ? null : jobPreference.getHopeCondition(),
                jobPreference == null ? null : jobPreference.getMemo()
        );

        return containsAny(condition, "무거운", "운반 어려", "상하차 어려", "힘든 작업", "근력 제한");
    }

    private boolean hasWalkingDifficulty(Senior senior, HealthInfo healthInfo) {
        String walkingAid = healthInfo == null ? null : healthInfo.getWalkingAid();
        String disabilityType = senior == null ? null : senior.getDisabilityType();

        return isLimitedValue(walkingAid)
                || containsAny(disabilityType, "지체", "보행", "하지");
    }

    private boolean hasSevereDisease(HealthInfo healthInfo) {
        if (healthInfo == null) {
            return false;
        }

        String diseaseText = joinText(
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

        return containsAny(diseaseText, "중증", "활동 제한", "치료 필요", "작업 제한", "심함", "위험");
    }

    private boolean hasMultipleRecentFalls(String value) {
        if (value == null || value.isBlank() || containsAny(value, "없음", "없다", "0회", "아니오")) {
            return false;
        }

        Integer count = maxNumber(value);
        return count != null && count >= 2
                || containsAny(value, "2~3", "여러", "자주", "반복", "다수");
    }

    private boolean hasMovementOrStairs(JobCandidate job) {
        return hasTaskTag(job, "이동 많음", "계단", "순찰", "배달", "외근", "동선 많음");
    }

    private boolean hasTaskTag(JobCandidate job, String... keywords) {
        return containsAny(joinText(job.taskTags()), keywords)
                || containsAny(job.workCondition(), keywords)
                || containsAny(job.title(), keywords);
    }

    private boolean isIndoorOrMixed(String value) {
        return containsAny(value, "실내", "혼합");
    }

    private boolean isLimitedValue(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }

        if (containsAny(value, "없음", "없다", "미사용", "사용 안", "해당 없음")) {
            return false;
        }

        return containsAny(value, "어려", "불가", "보조", "불편", "느림", "제한", "필요", "사용", "의존");
    }

    private boolean matchesPreference(String preference, String... candidates) {
        if (preference == null || preference.isBlank()) {
            return false;
        }

        String normalizedPreference = normalize(preference);
        for (String token : normalizedPreference.split(" ")) {
            if (token.length() < 2) {
                continue;
            }

            for (String candidate : candidates) {
                String normalizedCandidate = normalize(candidate);
                if (!normalizedCandidate.isBlank()
                        && (normalizedCandidate.contains(token) || token.contains(normalizedCandidate))) {
                    return true;
                }
            }
        }

        return false;
    }

    private boolean containsAny(String value, String... keywords) {
        String normalizedValue = normalize(value);
        if (normalizedValue.isBlank()) {
            return false;
        }

        for (String keyword : keywords) {
            if (!normalize(keyword).isBlank() && normalizedValue.contains(normalize(keyword))) {
                return true;
            }
        }

        return false;
    }

    private Integer maxNumber(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        Matcher matcher = NUMBER_PATTERN.matcher(value);
        Integer result = null;
        while (matcher.find()) {
            int number = Integer.parseInt(matcher.group());
            result = result == null ? number : Math.max(result, number);
        }

        return result;
    }

    private boolean isLongDistanceCommute(String value) {
        String normalized = normalize(value);
        return normalized.contains("타지역")
                || normalized.contains("장거리")
                || (normalized.contains("1시간") && normalized.contains("초과"))
                || (normalized.contains("60") && normalized.contains("초과"));
    }

    private Integer commuteRank(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String normalized = normalize(value);
        if (isLongDistanceCommute(normalized)) {
            return 5;
        }

        if (normalized.contains("도보") && normalized.contains("10")) {
            return 1;
        }

        if (normalized.contains("도보") && normalized.contains("30")) {
            return 2;
        }

        if ((normalized.contains("대중교통") || normalized.contains("버스") || normalized.contains("지하철"))
                && normalized.contains("30")) {
            return 3;
        }

        if (normalized.contains("1시간") || normalized.contains("60")) {
            return 4;
        }

        Integer number = maxNumber(normalized);
        if (number == null) {
            return null;
        }

        if (number <= 10) {
            return 1;
        }

        if (number <= 30) {
            return 2;
        }

        if (number <= 60) {
            return 4;
        }

        return 4;
    }

    private String normalize(String value) {
        return text(value)
                .replace(",", " ")
                .replace("/", " ")
                .replace("|", " ")
                .replace("·", " ")
                .replace("-", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String text(String value) {
        return value == null ? "" : value.trim();
    }

    private String safe(String value) {
        return value == null ? "" : value;
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

    private String joinText(List<String> values) {
        if (values == null || values.isEmpty()) {
            return "";
        }

        return values.stream()
                .filter(Objects::nonNull)
                .filter(value -> !value.isBlank())
                .reduce((left, right) -> left + " " + right)
                .orElse("");
    }

    public record JobCandidate(
            String jobId,
            String title,
            String organization,
            String jobType,
            String workEnvironment,
            String physicalIntensity,
            String dailyHours,
            String commuteLevel,
            List<String> taskTags,
            Boolean closed,
            List<String> workDays,
            String workCondition
    ) {
    }

    public record JobRecommendation(
            String jobId,
            String title,
            String organization,
            String jobType,
            int score,
            String grade,
            List<String> reasons,
            List<String> warnings
    ) {
    }
}
