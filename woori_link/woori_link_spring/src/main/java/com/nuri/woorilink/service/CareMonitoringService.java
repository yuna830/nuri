package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.*;
import com.nuri.woorilink.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.scheduling.annotation.Scheduled;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CareMonitoringService {
    private final SeniorRepository seniorRepository;
    private final CareEventRepository eventRepository;
    private final SeniorLocationRepository locationRepository;
    private final SafetyZoneRepository safetyZoneRepository;
    private final CareAlertRepository alertRepository;
    private final CheckInRepository checkInRepository;
    private final CheckInScheduleRepository checkInScheduleRepository;

    @Transactional
    public CareEvent reportEvent(Long seniorId, CareEvent.EventType type, Double latitude, Double longitude, String note) {
        return reportEvent(seniorId, type, latitude, longitude, note, null, null, Map.of());
    }

    @Transactional
    public CareEvent reportFall(Long seniorId, Integer score, String imageUrl, Map<String, Object> fallDetails) {
        String note = "Fall model detected" + (score == null ? "" : ": score=" + score);
        return reportEvent(
                seniorId,
                CareEvent.EventType.FALL_DETECTED,
                null,
                null,
                note,
                normalizeImageUrl(imageUrl),
                score,
                fallDetails == null ? Map.of() : new LinkedHashMap<>(fallDetails)
        );
    }

    private CareEvent reportEvent(Long seniorId, CareEvent.EventType type, Double latitude, Double longitude,
                                  String note, String imageUrl, Integer detectionScore,
                                  Map<String, Object> fallDetails) {
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("Senior not found: " + seniorId));
        CareEvent event = eventRepository.save(CareEvent.builder()
                .seniorId(seniorId).type(type).status(CareEvent.EventStatus.PENDING)
                .latitude(latitude).longitude(longitude).note(note)
                .imageUrl(imageUrl).detectionScore(detectionScore).fallDetails(fallDetails)
                .occurredAt(LocalDateTime.now()).build());
        createAlert(senior, event);
        return event;
    }

    @Transactional
    public SeniorLocation recordLocation(Long seniorId, double latitude, double longitude) {
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("Senior not found: " + seniorId));
        List<SafetyZone> enabledZones = safetyZoneRepository.findBySeniorIdOrderByIdAsc(seniorId).stream()
                .filter(zone -> Boolean.TRUE.equals(zone.getEnabled()))
                .toList();
        boolean outside = !enabledZones.isEmpty() && enabledZones.stream()
                .noneMatch(zone -> distanceMeters(latitude, longitude, zone.getLatitude(), zone.getLongitude()) <= zone.getRadiusMeters());
        SeniorLocation location = locationRepository.save(SeniorLocation.builder()
                .seniorId(seniorId).latitude(latitude).longitude(longitude).outsideSafetyZone(outside).build());
        if (outside && !eventRepository.existsBySeniorIdAndTypeAndStatus(seniorId, CareEvent.EventType.SAFETY_RADIUS_EXIT, CareEvent.EventStatus.PENDING)) {
            reportEvent(seniorId, CareEvent.EventType.SAFETY_RADIUS_EXIT, latitude, longitude, "Safety zone exited");
        } else if (!outside) {
            resolveSafetyRadiusExit(seniorId);
        }
        return location;
    }

    @Transactional
    public SafetyZone saveSafetyZone(Long seniorId, Long zoneId, int slotNumber, String name, double latitude, double longitude, int radiusMeters) {
        if (radiusMeters < 50 || radiusMeters > 10000) throw new IllegalArgumentException("radiusMeters must be between 50 and 10000");
        if (slotNumber < 1 || slotNumber > 3) throw new IllegalArgumentException("slotNumber must be between 1 and 3");
        seniorRepository.findById(seniorId).orElseThrow(() -> new IllegalArgumentException("Senior not found: " + seniorId));
        SafetyZone zone;
        if (zoneId != null) {
            zone = safetyZoneRepository.findById(zoneId)
                    .filter(existing -> existing.getSeniorId().equals(seniorId))
                    .orElseThrow(() -> new IllegalArgumentException("Safety zone not found: " + zoneId));
        } else {
            if (safetyZoneRepository.countBySeniorId(seniorId) >= 3) {
                throw new IllegalStateException("Safety zones can be registered up to 3");
            }
            zone = SafetyZone.builder().seniorId(seniorId).build();
        }
        String normalizedName = name == null ? "" : name.trim();
        if (normalizedName.isEmpty() || normalizedName.length() > 30) {
            throw new IllegalArgumentException("Safety zone name must be between 1 and 30 characters");
        }
        zone.setName(normalizedName);
        zone.setSlotNumber(slotNumber);
        zone.setLatitude(latitude); zone.setLongitude(longitude); zone.setRadiusMeters(radiusMeters); zone.setEnabled(true);
        SafetyZone saved = safetyZoneRepository.save(zone);
        reevaluateLatestLocation(seniorId);
        return saved;
    }

    @Transactional
    public void deleteSafetyZone(Long seniorId, Long zoneId) {
        SafetyZone zone = safetyZoneRepository.findById(zoneId)
                .filter(existing -> existing.getSeniorId().equals(seniorId))
                .orElseThrow(() -> new IllegalArgumentException("Safety zone not found: " + zoneId));
        safetyZoneRepository.delete(zone);
        safetyZoneRepository.flush();
        reevaluateLatestLocation(seniorId);
    }

    public Optional<SeniorLocation> latestLocation(Long seniorId) { return locationRepository.findTopBySeniorIdOrderByRecordedAtDesc(seniorId); }
    public List<SafetyZone> safetyZones(Long seniorId) { return safetyZoneRepository.findBySeniorIdOrderByIdAsc(seniorId); }
    public List<CareEvent> events(Long seniorId) { return eventRepository.findBySeniorIdOrderByOccurredAtDesc(seniorId); }

    @Transactional
    public CareEvent updateFallStatus(Long eventId, CareEvent.EventStatus status, Long guardianId) {
        CareEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new IllegalArgumentException("Event not found: " + eventId));
        if (event.getType() != CareEvent.EventType.FALL_DETECTED
                && event.getType() != CareEvent.EventType.FALL_SUSPECTED) {
            throw new IllegalArgumentException("Only fall event status can be changed here");
        }
        Senior senior = seniorRepository.findById(event.getSeniorId())
                .orElseThrow(() -> new IllegalArgumentException("Senior not found: " + event.getSeniorId()));
        if (!guardianId.equals(senior.getGuardianId())) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "You can only update your assigned senior's fall event"
            );
        }
        event.setStatus(status);
        return eventRepository.save(event);
    }
    public List<CareAlert> guardianAlerts(Long guardianId) { return alertRepository.findByGuardianIdOrderByCreatedAtDesc(guardianId); }

    public List<CareAlert> seniorAlerts(Long seniorId) { return alertRepository.findBySeniorIdAndGuardianIdIsNullOrderByCreatedAtDesc(seniorId); }

    public List<CareAlert> welfareNotices(Long welfareWorkerId) {
        List<Long> seniorIds = seniorRepository.findByWelfareWorkerId(welfareWorkerId)
                .stream()
                .map(Senior::getId)
                .toList();
        if (seniorIds.isEmpty()) return List.of();
        return alertRepository.findBySeniorIdInAndTypeOrderByCreatedAtDesc(
                seniorIds,
                CareEvent.EventType.WELFARE_NOTICE
        );
    }

    @Transactional
    public List<CareAlert> createWelfareNotice(Long seniorId, Long welfareWorkerId, String title, String message,
                                               boolean notifySenior, boolean notifyGuardian) {
        Senior senior = requireAssignedSenior(seniorId, welfareWorkerId);
        if (!notifySenior && !notifyGuardian) {
            throw new IllegalArgumentException("알림 수신 대상을 선택해 주세요.");
        }
        if (notifyGuardian && senior.getGuardianId() == null) {
            throw new IllegalArgumentException("연결된 보호자가 없어 보호자 알림을 보낼 수 없습니다.");
        }
        String normalizedTitle = title == null || title.isBlank() ? "복지사 알림" : title.trim();
        String normalizedMessage = message == null ? "" : message.trim();
        if (normalizedMessage.isEmpty()) {
            throw new IllegalArgumentException("알림 내용을 입력해 주세요.");
        }
        if (normalizedTitle.length() > 120) {
            throw new IllegalArgumentException("알림 제목은 120자 이하로 입력해 주세요.");
        }
        if (normalizedMessage.length() > 1000) {
            throw new IllegalArgumentException("알림 내용은 1000자 이하로 입력해 주세요.");
        }

        java.util.ArrayList<CareAlert> notices = new java.util.ArrayList<>();
        if (notifySenior) {
            notices.add(alertRepository.save(buildWelfareNotice(seniorId, null, normalizedTitle, normalizedMessage)));
        }
        if (notifyGuardian) {
            notices.add(alertRepository.save(buildWelfareNotice(seniorId, senior.getGuardianId(), normalizedTitle, normalizedMessage)));
        }
        return notices;
    }

    @Transactional
    public void cancelWelfareNotice(Long alertId, Long welfareWorkerId) {
        CareAlert alert = alertRepository.findByIdAndType(alertId, CareEvent.EventType.WELFARE_NOTICE)
                .orElseThrow(() -> new IllegalArgumentException("Alert not found: " + alertId));
        requireAssignedSenior(alert.getSeniorId(), welfareWorkerId);
        if (alert.getStatus() != CareAlert.AlertStatus.UNREAD) {
            throw new IllegalStateException("이미 확인한 알림은 전송취소할 수 없습니다.");
        }
        alertRepository.delete(alert);
    }

    private Senior requireAssignedSenior(Long seniorId, Long welfareWorkerId) {
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("Senior not found: " + seniorId));
        if (senior.getWelfareWorkerId() == null || !senior.getWelfareWorkerId().equals(welfareWorkerId)) {
            throw new org.springframework.security.access.AccessDeniedException("You can only notify assigned seniors");
        }
        return senior;
    }

    private CareAlert buildWelfareNotice(Long seniorId, Long guardianId, String title, String message) {
        return CareAlert.builder()
                .seniorId(seniorId)
                .guardianId(guardianId)
                .type(CareEvent.EventType.WELFARE_NOTICE)
                .severity(CareAlert.Severity.MEDIUM)
                .status(CareAlert.AlertStatus.UNREAD)
                .title(title)
                .message(message)
                .build();
    }

    @Transactional
    public CareAlert acknowledgeSeniorAlert(Long alertId, Long seniorId) {
        CareAlert alert = alertRepository.findByIdAndSeniorIdAndGuardianIdIsNull(alertId, seniorId)
                .orElseThrow(() -> new IllegalArgumentException("Alert not found: " + alertId));
        if (alert.getStatus() == CareAlert.AlertStatus.UNREAD) {
            alert.setStatus(CareAlert.AlertStatus.ACKNOWLEDGED);
            alert.setAcknowledgedAt(LocalDateTime.now());
        }
        return alert;
    }

    public List<CheckIn> checkIns(Long seniorId) { return checkInRepository.findBySeniorIdOrderByRequestedAtDesc(seniorId); }

    /**
     * 보호자가 수동으로 즉시 안부 확인을 요청한다.
     *
     * 수동 요청에도 해당 님에게 설정된
     * 응답 제한 시간을 적용한다.
     */
    @Transactional
    public CheckIn requestCheckIn(
            Long seniorId
    ) {
        seniorRepository
                .findById(seniorId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Senior not found: "
                                        + seniorId
                        )
                );

        int timeoutMinutes =
                checkInScheduleRepository
                        .findBySeniorId(seniorId)
                        .map(
                                CheckInSchedule::getTimeoutMinutes
                        )
                        .filter(
                                value ->
                                        value >= 5
                                                && value <= 180
                        )
                        .orElse(30);

        return checkInRepository.save(
                CheckIn.builder()
                        .seniorId(seniorId)
                        .status(
                                CheckIn.Status.PENDING
                        )
                        .requestType(
                                CheckIn.RequestType.MANUAL
                        )
                        .scheduledDate(null)
                        .requestedAt(
                                LocalDateTime.now()
                        )
                        .timeoutMinutes(
                                timeoutMinutes
                        )
                        .build()
        );
    }

    @Transactional
    public CheckIn respondCheckIn(Long checkInId, String message) {
        CheckIn checkIn = checkInRepository.findById(checkInId).orElseThrow(() -> new IllegalArgumentException("Check-in not found: " + checkInId));
        if (checkIn.getStatus() != CheckIn.Status.PENDING)
            throw new IllegalStateException("Check-in is already closed");
        checkIn.setStatus(CheckIn.Status.RESPONDED);
        checkIn.setRespondedAt(LocalDateTime.now());
        checkIn.setResponseMessage(message);
        return checkIn;
    }

    @Scheduled(fixedDelayString = "${care.alert.reminder-interval-ms:1800000}")
    @Transactional
    public void remindUnreadAlerts() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);
        for (CareAlert alert : alertRepository.findByStatusAndCreatedAtBefore(CareAlert.AlertStatus.UNREAD, cutoff)) {
            if (alert.getReminderCount() >= 3 || (alert.getLastReminderAt() != null && alert.getLastReminderAt().isAfter(cutoff))) continue;
            alert.setReminderCount(alert.getReminderCount() + 1);
            alert.setLastReminderAt(LocalDateTime.now());
        }
    }

    @Transactional
    public CareAlert acknowledgeAlert(Long alertId, boolean resolved, Long guardianId) {
        CareAlert alert = alertRepository.findByIdAndGuardianId(alertId, guardianId)
                .orElseThrow(() -> new IllegalArgumentException("Alert not found: " + alertId));
        alert.setStatus(resolved ? CareAlert.AlertStatus.RESOLVED : CareAlert.AlertStatus.ACKNOWLEDGED);
        alert.setAcknowledgedAt(LocalDateTime.now());
        if (resolved && alert.getCareEventId() != null) {
            eventRepository.findById(alert.getCareEventId())
                    .filter(event -> event.getType() == CareEvent.EventType.FALL_DETECTED
                            || event.getType() == CareEvent.EventType.FALL_SUSPECTED)
                    .ifPresent(event -> event.setStatus(CareEvent.EventStatus.RESOLVED));
        }
        return alert;
    }

    private void createAlert(Senior senior, CareEvent event) {
        String title = switch (event.getType()) {
            case FALL_SUSPECTED -> "낙상 의심 알림";
            case FALL_DETECTED -> "낙상 의심 알림";
            case SOS -> "SOS 긴급 호출";
            case SAFETY_RADIUS_EXIT -> "안전반경 이탈";
            case CHECK_IN_MISSED -> "안부 미응답";
            case WELFARE_NOTICE -> "복지사 알림";
        };
        CareAlert.Severity severity = event.getType() == CareEvent.EventType.SOS || event.getType() == CareEvent.EventType.FALL_DETECTED
                ? CareAlert.Severity.HIGH : CareAlert.Severity.MEDIUM;
        alertRepository.save(CareAlert.builder().seniorId(senior.getId()).guardianId(senior.getGuardianId())
                .careEventId(event.getId()).type(event.getType()).severity(severity).status(CareAlert.AlertStatus.UNREAD)
                .imageUrl(event.getImageUrl()).detectionScore(event.getDetectionScore())
                .fallDetails(event.getFallDetails())
                .title(title).message(senior.getName() + "님: " + title).build());
    }

    private String normalizeImageUrl(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) return null;
        String normalized = imageUrl.trim();
        if (normalized.length() > 2000) {
            throw new IllegalArgumentException("imageUrl must not exceed 2000 characters");
        }
        return normalized;
    }

    private double distanceMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1), dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private void reevaluateLatestLocation(Long seniorId) {
        locationRepository.findTopBySeniorIdOrderByRecordedAtDesc(seniorId)
                .ifPresent(location -> {
                    List<SafetyZone> enabledZones = safetyZoneRepository
                            .findBySeniorIdOrderByIdAsc(seniorId)
                            .stream()
                            .filter(zone -> Boolean.TRUE.equals(zone.getEnabled()))
                            .toList();

                    boolean outside = !enabledZones.isEmpty() && enabledZones.stream()
                            .noneMatch(zone -> distanceMeters(
                                    location.getLatitude(),
                                    location.getLongitude(),
                                    zone.getLatitude(),
                                    zone.getLongitude()
                            ) <= zone.getRadiusMeters());

                    location.setOutsideSafetyZone(outside);
                    if (!outside) {
                        resolveSafetyRadiusExit(seniorId);
                    }
                });
    }

    private void resolveSafetyRadiusExit(Long seniorId) {
        eventRepository.findBySeniorIdAndTypeAndStatus(
                seniorId,
                CareEvent.EventType.SAFETY_RADIUS_EXIT,
                CareEvent.EventStatus.PENDING
        ).forEach(event -> event.setStatus(CareEvent.EventStatus.RESOLVED));

        alertRepository.findBySeniorIdAndTypeAndStatusIn(
                seniorId,
                CareEvent.EventType.SAFETY_RADIUS_EXIT,
                List.of(CareAlert.AlertStatus.UNREAD, CareAlert.AlertStatus.ACKNOWLEDGED)
        ).forEach(alert -> {
            alert.setStatus(CareAlert.AlertStatus.RESOLVED);
            alert.setAcknowledgedAt(LocalDateTime.now());
        });
    }
}
