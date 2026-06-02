package com.nuri.woori.service;

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

        SeniorActivitySnapshot snapshot = snapshotRepository
                .findBySeniorIdAndSnapshotDate(senior.getId(), today)
                .orElseGet(SeniorActivitySnapshot::new);

        snapshot.setSeniorId(senior.getId());
        snapshot.setSnapshotDate(today);
        snapshot.setUpdatedAt(LocalDateTime.now());

        snapshot.setBaselineJson(fetchSafe(base + "/health/activity/baseline?days=14"));
        snapshot.setFallPatternJson(fetchSafe(base + "/health/activity/fall-pattern"));
        snapshot.setActivityTodayJson(fetchSafe(base + "/health/activity/today"));
        snapshot.setActivitySlotsJson(fetchSafe(base + "/health/activity/slots"));
        snapshot.setActivityTrendJson(fetchSafe(base + "/health/activity/trend?days=7"));

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
}
