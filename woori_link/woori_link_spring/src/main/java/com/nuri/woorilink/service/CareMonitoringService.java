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
        return safetyZoneRepository.save(zone);
    }

    @Transactional
    public void deleteSafetyZone(Long seniorId, Long zoneId) {
        SafetyZone zone = safetyZoneRepository.findById(zoneId)
                .filter(existing -> existing.getSeniorId().equals(seniorId))
                .orElseThrow(() -> new IllegalArgumentException("Safety zone not found: " + zoneId));
        safetyZoneRepository.delete(zone);
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

    public List<CheckIn> checkIns(Long seniorId) { return checkInRepository.findBySeniorIdOrderByRequestedAtDesc(seniorId); }

    @Transactional
    public CheckIn requestCheckIn(Long seniorId) {
        seniorRepository.findById(seniorId).orElseThrow(() -> new IllegalArgumentException("Senior not found: " + seniorId));
        return checkInRepository.save(CheckIn.builder().seniorId(seniorId).status(CheckIn.Status.PENDING)
                .requestedAt(LocalDateTime.now()).build());
    }

    @Transactional
    public CheckIn respondCheckIn(Long checkInId, String message) {
        CheckIn checkIn = checkInRepository.findById(checkInId).orElseThrow(() -> new IllegalArgumentException("Check-in not found: " + checkInId));
        if (checkIn.getStatus() != CheckIn.Status.PENDING) throw new IllegalStateException("Check-in is already closed");
        checkIn.setStatus(CheckIn.Status.RESPONDED);
        checkIn.setRespondedAt(LocalDateTime.now());
        checkIn.setResponseMessage(message);
        return checkIn;
    }

    @Scheduled(fixedDelayString = "${care.check-in.missed-after-ms:1800000}")
    @Transactional
    public void markMissedCheckIns() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);
        for (CheckIn checkIn : checkInRepository.findByStatusAndRequestedAtBefore(CheckIn.Status.PENDING, cutoff)) {
            checkIn.setStatus(CheckIn.Status.MISSED);
            if (!eventRepository.existsBySeniorIdAndTypeAndStatus(checkIn.getSeniorId(), CareEvent.EventType.CHECK_IN_MISSED, CareEvent.EventStatus.PENDING)) {
                reportEvent(checkIn.getSeniorId(), CareEvent.EventType.CHECK_IN_MISSED, null, null, "Check-in response overdue");
            }
        }
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
}
