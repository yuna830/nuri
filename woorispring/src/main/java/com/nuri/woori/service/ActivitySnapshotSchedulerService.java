package com.nuri.woori.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.entity.SeniorActivitySnapshot;
import com.nuri.woori.repository.SeniorActivitySnapshotRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class ActivitySnapshotSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(ActivitySnapshotSchedulerService.class);

    private final SeniorRepository seniorRepository;
    private final SeniorActivitySnapshotRepository snapshotRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ActivitySnapshotSchedulerService(
            SeniorRepository seniorRepository,
            SeniorActivitySnapshotRepository snapshotRepository) {
        this.seniorRepository = seniorRepository;
        this.snapshotRepository = snapshotRepository;
    }

    // 10분마다 Fall API 폴링
    @Scheduled(fixedDelay = 600_000, initialDelay = 15_000)
    public void syncActivitySnapshots() {
        List<Senior> seniors = seniorRepository.findByFallApiUrlIsNotNull();
        if (seniors.isEmpty()) return;

        for (Senior senior : seniors) {
            try {
                syncForSenior(senior);
            } catch (Exception e) {
                log.warn("Activity snapshot sync failed for senior {}: {}", senior.getId(), e.getMessage());
            }
        }
    }

    private void syncForSenior(Senior senior) {
        String base = senior.getFallApiUrl().replaceAll("/+$", "");
        LocalDate today = LocalDate.now();

        // 오늘 스냅샷이 없으면 이전 스냅샷에서 실제 데이터(pending이 아닌)만 복사
        SeniorActivitySnapshot snapshot = snapshotRepository
                .findTopBySeniorIdAndSnapshotDateOrderByIdDesc(senior.getId(), today)
                .orElseGet(() -> {
                    SeniorActivitySnapshot fresh = new SeniorActivitySnapshot();
                    snapshotRepository.findTopBySeniorIdOrderBySnapshotDateDesc(senior.getId())
                            .ifPresent(prev -> {
                                if (prev.getBaselineJson()       != null && !isPending(prev.getBaselineJson()))
                                    fresh.setBaselineJson(prev.getBaselineJson());
                                if (prev.getFallPatternJson()    != null && !isPending(prev.getFallPatternJson()))
                                    fresh.setFallPatternJson(prev.getFallPatternJson());
                                if (prev.getActivityTodayJson()  != null && !isPending(prev.getActivityTodayJson()))
                                    fresh.setActivityTodayJson(prev.getActivityTodayJson());
                                if (prev.getActivitySlotsJson()  != null && !isPending(prev.getActivitySlotsJson()))
                                    fresh.setActivitySlotsJson(prev.getActivitySlotsJson());
                                if (prev.getActivityTrendJson()  != null && !isPending(prev.getActivityTrendJson()))
                                    fresh.setActivityTrendJson(prev.getActivityTrendJson());
                            });
                    return fresh;
                });

        snapshot.setSeniorId(senior.getId());
        snapshot.setSnapshotDate(today);
        snapshot.setUpdatedAt(LocalDateTime.now());

        // FastAPI가 꺼져 있으면 null 반환 → 기존 데이터 유지 (덮어쓰지 않음)
        String baseline    = fetchSafe(base + "/health/activity/baseline?days=14");
        String fallPattern = fetchSafe(base + "/health/activity/fall-pattern");
        String actToday    = fetchSafe(base + "/health/activity/today");
        String slots       = fetchSafe(base + "/health/activity/slots");
        String trend       = fetchSafe(base + "/health/activity/trend?days=7");

        if (baseline    != null && !isPending(baseline))    snapshot.setBaselineJson(baseline);
        if (fallPattern != null && !isPending(fallPattern)) snapshot.setFallPatternJson(fallPattern);
        if (actToday    != null && !isPending(actToday))    snapshot.setActivityTodayJson(actToday);
        if (slots       != null && !isPending(slots))       snapshot.setActivitySlotsJson(slots);
        if (trend       != null && !isPending(trend))       snapshot.setActivityTrendJson(trend);

        snapshotRepository.save(snapshot);
        log.debug("Activity snapshot saved for senior {}", senior.getId());
    }

    private String fetchSafe(String url) {
        try {
            return restTemplate.getForObject(url, String.class);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean isPending(String json) {
        try {
            JsonNode node = objectMapper.readTree(json);
            return "pending".equals(node.path("status").asText(null));
        } catch (Exception e) {
            return false;
        }
    }
}
