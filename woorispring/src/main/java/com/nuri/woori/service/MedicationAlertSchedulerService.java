package com.nuri.woori.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.Alert;
import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class MedicationAlertSchedulerService {

    private final AlertRepository alertRepository;
    private final SeniorRepository seniorRepository;
    private final HealthInfoRepository healthInfoRepository;
    private final FcmPushService fcmPushService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final boolean autoMedicationAlertsEnabled;

    public MedicationAlertSchedulerService(
            AlertRepository alertRepository,
            SeniorRepository seniorRepository,
            HealthInfoRepository healthInfoRepository,
            FcmPushService fcmPushService,
            @Value("${app.medication-alert.auto-enabled:false}") boolean autoMedicationAlertsEnabled
    ) {
        this.alertRepository = alertRepository;
        this.seniorRepository = seniorRepository;
        this.healthInfoRepository = healthInfoRepository;
        this.fcmPushService = fcmPushService;
        this.autoMedicationAlertsEnabled = autoMedicationAlertsEnabled;
    }

    @Scheduled(initialDelay = 10_000, fixedDelay = 3_600_000)
    public void checkMedicationAlerts() {
        if (!autoMedicationAlertsEnabled) {
            return;
        }

        List<Senior> seniors = seniorRepository.findAll();
        for (Senior senior : seniors) {
            try {
                checkSeniorMedication(senior);
            } catch (Exception ignored) {
            }
        }
    }

    private String buildMedMessage(String medName) {
        String lower = medName.toLowerCase();
        if (lower.contains("혈압")) return medName + " 복용 시간입니다. 혈압이 안정적으로 유지되도록 빠뜨리지 마세요.";
        if (lower.contains("당뇨") || lower.contains("인슐린") || lower.contains("혈당")) return medName + " 복용 시간입니다. 혈당 관리를 위해 식사 후 꼭 챙겨드세요.";
        if (lower.contains("심장") || lower.contains("아스피린") || lower.contains("항혈전")) return medName + " 복용 시간입니다. 심장 건강을 위해 정해진 시간에 복용해주세요.";
        if (lower.contains("골다공증") || lower.contains("칼슘")) return medName + " 복용 시간입니다. 뼈 건강을 위해 빠뜨리지 마세요.";
        if (lower.contains("콜레스테롤") || lower.contains("지질")) return medName + " 복용 시간입니다. 저녁 식사 후 복용을 권장합니다.";
        if (lower.contains("수면") || lower.contains("안정")) return medName + " 복용 시간입니다. 취침 전 복용해주세요.";
        if (lower.contains("갑상선")) return medName + " 복용 시간입니다. 공복에 물과 함께 복용해주세요.";
        return medName + " 복용 시간입니다. 정해진 시간에 꼭 챙겨드세요.";
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
        // alertEnabled = true 인 약만 수집
        List<String> alertNames = new java.util.ArrayList<>();

        for (JsonNode med : medications) {
            boolean ongoing = med.path("ongoing").asBoolean(true);
            boolean alertEnabled = med.path("alertEnabled").asBoolean(false);
            if (!ongoing || !alertEnabled) continue;

            String name = med.path("name").asText("").trim();
            if (!name.isEmpty()) alertNames.add(name);

            String intervalStr = med.path("interval").asText("8");
            try {
                int interval = Integer.parseInt(intervalStr.trim());
                if (interval > 0 && interval < minIntervalHours) minIntervalHours = interval;
            } catch (NumberFormatException ignored) {}
        }

        // 알림 설정한 약이 없으면 종료
        if (alertNames.isEmpty() || minIntervalHours == Integer.MAX_VALUE) return;

        Alert latest = alertRepository
                .findTopBySeniorIdAndTypeOrderByCreatedAtDesc(senior.getId(), "MEDICINE")
                .orElse(null);

        if (latest != null && latest.getCreatedAt() != null) {
            LocalDateTime nextAlertTime = latest.getCreatedAt().plusHours(minIntervalHours);
            if (LocalDateTime.now().isBefore(nextAlertTime)) return;
        }

        // 약 이름마다 알림 생성 + FCM 발송
        for (String medName : alertNames) {
            String title = "복약 알림 · " + medName;
            String message = senior.getName() + "님, " + buildMedMessage(medName);

            Alert alert = new Alert();
            alert.setSeniorId(senior.getId());
            alert.setGuardianId(null);
            alert.setType("MEDICINE");
            alert.setTitle(title);
            alert.setMessage(message);
            alert.setIsRead(false);
            alertRepository.save(alert);

            // 어르신 기기에 FCM 푸시 발송
            fcmPushService.sendToUser("SENIOR", senior.getId(), title, message, "MEDICINE");
        }
    }
}
