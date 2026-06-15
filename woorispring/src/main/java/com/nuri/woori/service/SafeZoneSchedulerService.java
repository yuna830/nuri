package com.nuri.woori.service;

import com.nuri.woori.entity.Alert;
import com.nuri.woori.entity.GuardianSenior;
import com.nuri.woori.entity.LocationStatus;
import com.nuri.woori.entity.SafeZones;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.LocationStatusRepository;
import com.nuri.woori.repository.SafeZonesRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

// TODO: 실시간성이 필요해지면 시니어 앱 ForegroundService로 교체 고려
@Service
public class SafeZoneSchedulerService {

    // 마지막 위치 데이터가 이 시간보다 오래됐으면 기기가 꺼진 것으로 보고 체크 건너뜀
    private static final int STALE_MINUTES = 30;

    // 같은 노인에게 이 시간 안에 이미 알림을 보냈으면 중복 발송 안 함
    private static final int COOLDOWN_MINUTES = 10;

    private final SeniorRepository seniorRepository;
    private final LocationStatusRepository locationStatusRepository;
    private final SafeZonesRepository safeZonesRepository;
    private final GuardianSeniorRepository guardianSeniorRepository;
    private final AlertRepository alertRepository;
    private final FcmPushService fcmPushService;

    public SafeZoneSchedulerService(
            SeniorRepository seniorRepository,
            LocationStatusRepository locationStatusRepository,
            SafeZonesRepository safeZonesRepository,
            GuardianSeniorRepository guardianSeniorRepository,
            AlertRepository alertRepository,
            FcmPushService fcmPushService
    ) {
        this.seniorRepository = seniorRepository;
        this.locationStatusRepository = locationStatusRepository;
        this.safeZonesRepository = safeZonesRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
        this.alertRepository = alertRepository;
        this.fcmPushService = fcmPushService;
    }

    @Scheduled(initialDelay = 30_000, fixedDelay = 60_000)
    public void checkSafeZoneViolations() {
        List<Senior> seniors = seniorRepository.findAll();
        for (Senior senior : seniors) {
            try {
                checkSenior(senior);
            } catch (Exception ignored) {
            }
        }
    }

    private void checkSenior(Senior senior) {
        Long seniorId = senior.getId();

        // 1. 마지막 위치 조회
        LocationStatus loc = locationStatusRepository
                .findTopBySeniorIdOrderByReceivedAtDesc(seniorId)
                .orElse(null);

        if (loc == null || loc.getLatitude() == null || loc.getLongitude() == null) return;

        // 2. 위치가 너무 오래됐으면 기기 꺼진 것으로 간주하고 스킵
        if (loc.getReceivedAt().isBefore(LocalDateTime.now().minusMinutes(STALE_MINUTES))) return;

        // 3. 안전구역 목록 조회 — 없으면 체크 불필요
        List<SafeZones> zones = safeZonesRepository.findBySeniorIdOrderByIdAsc(seniorId);
        if (zones.isEmpty()) return;

        // 4. 안전구역 중 하나라도 안에 있으면 정상
        boolean insideAnyZone = zones.stream().anyMatch(zone ->
                distanceMeters(loc.getLatitude(), loc.getLongitude(),
                        zone.getCenterLatitude(), zone.getCenterLongitude())
                        <= zone.getRadiusMeters()
        );
        if (insideAnyZone) {
            alertRepository
                    .findBySeniorIdAndTypeAndIsReadFalseOrderByCreatedAtDesc(seniorId, "SAFE_ZONE_EXIT")
                    .forEach(a -> {
                        a.setIsRead(true);
                        alertRepository.save(a);
                    });
            return;
        }

        // 5. 쿨다운 — 이미 최근에 알림 보냈으면 스킵
        Alert latest = alertRepository
                .findTopBySeniorIdAndTypeOrderByCreatedAtDesc(seniorId, "SAFE_ZONE_EXIT")
                .orElse(null);

        if (latest != null && latest.getCreatedAt() != null
                && latest.getCreatedAt().isAfter(LocalDateTime.now().minusMinutes(COOLDOWN_MINUTES))) {
            return;
        }

        // 6. 알림 생성 + 보호자 FCM 발송
        String title = senior.getName() + "님 안전구역 이탈";
        String message = senior.getName() + "님이 설정된 안전구역 밖에 있습니다. 위치를 확인해 주세요.";

        List<GuardianSenior> links = guardianSeniorRepository.findBySeniorId(seniorId);
        for (GuardianSenior link : links) {
            Alert alert = new Alert();
            alert.setSeniorId(seniorId);
            alert.setGuardianId(link.getGuardianId());
            alert.setType("SAFE_ZONE_EXIT");
            alert.setTitle(title);
            alert.setMessage(message);
            alert.setLatitude(loc.getLatitude());
            alert.setLongitude(loc.getLongitude());
            alert.setIsRead(false);
            alertRepository.save(alert);

            fcmPushService.sendToUser("GUARDIAN", link.getGuardianId(), title, message, "SAFE_ZONE_EXIT");
        }
    }

    private double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        final double R = 6378137.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
