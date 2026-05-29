package com.nuri.woori.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.Alert;
import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class MedicationAlertSchedulerService {

    private final AlertRepository alertRepository;
    private final SeniorRepository seniorRepository;
    private final HealthInfoRepository healthInfoRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public MedicationAlertSchedulerService(
            AlertRepository alertRepository,
            SeniorRepository seniorRepository,
            HealthInfoRepository healthInfoRepository
    ) {
        this.alertRepository = alertRepository;
        this.seniorRepository = seniorRepository;
        this.healthInfoRepository = healthInfoRepository;
    }

    @Scheduled(initialDelay = 10_000, fixedDelay = 3_600_000)
    public void checkMedicationAlerts() {
        List<Senior> seniors = seniorRepository.findAll();
        for (Senior senior : seniors) {
            try {
                checkSeniorMedication(senior);
            } catch (Exception ignored) {
            }
        }
    }

    private void checkSeniorMedication(Senior senior) throws Exception {
        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        if (healthInfo == null
                || healthInfo.getMedicationsJson() == null
                || healthInfo.getMedicationsJson().isBlank()) {
            return;
        }

        JsonNode medications = objectMapper.readTree(healthInfo.getMedicationsJson());
        if (!medications.isArray() || medications.isEmpty()) return;

        int minIntervalHours = Integer.MAX_VALUE;
        for (JsonNode med : medications) {
            boolean ongoing = med.path("ongoing").asBoolean(true);
            if (!ongoing) continue;
            String intervalStr = med.path("interval").asText("8");
            try {
                int interval = Integer.parseInt(intervalStr.trim());
                if (interval > 0 && interval < minIntervalHours) {
                    minIntervalHours = interval;
                }
            } catch (NumberFormatException ignored) {
            }
        }

        if (minIntervalHours == Integer.MAX_VALUE) return;

        Alert latest = alertRepository
                .findTopBySeniorIdAndTypeOrderByCreatedAtDesc(senior.getId(), "MEDICINE")
                .orElse(null);

        if (latest != null && latest.getCreatedAt() != null) {
            LocalDateTime nextAlertTime = latest.getCreatedAt().plusHours(minIntervalHours);
            if (LocalDateTime.now().isBefore(nextAlertTime)) {
                return;
            }
        }

        Alert alert = new Alert();
        alert.setSeniorId(senior.getId());
        alert.setGuardianId(null);
        alert.setType("MEDICINE");
        alert.setTitle("복약 알림");
        alert.setMessage(senior.getName() + "님, 복용 중인 약을 확인하고 제때 복용해주세요.");
        alert.setIsRead(false);

        alertRepository.save(alert);
    }
}
