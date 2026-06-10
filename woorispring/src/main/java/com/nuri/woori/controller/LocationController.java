package com.nuri.woori.controller;

import com.nuri.woori.service.FcmPushService;
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
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/locations")
@CrossOrigin(origins = "*")
public class LocationController {
    private final FcmPushService fcmPushService;
    private final LocationStatusRepository locationStatusRepository;
    private final SafeZonesRepository safeZonesRepository;
    private final AlertRepository alertRepository;
    private final GuardianSeniorRepository guardianSeniorRepository;
    private final SeniorRepository seniorRepository;

    public LocationController(
            LocationStatusRepository locationStatusRepository,
            SafeZonesRepository safeZonesRepository,
            AlertRepository alertRepository,
            GuardianSeniorRepository guardianSeniorRepository,
            SeniorRepository seniorRepository,
            FcmPushService fcmPushService
    ) {
        this.locationStatusRepository = locationStatusRepository;
        this.safeZonesRepository = safeZonesRepository;
        this.alertRepository = alertRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
        this.seniorRepository = seniorRepository;
        this.fcmPushService = fcmPushService;
    }

    @PostMapping
    public LocationStatus saveLocation(@RequestBody LocationSaveRequest request) {
        LocationStatus latestLocation = locationStatusRepository
                .findTopBySeniorIdOrderByReceivedAtDesc(request.seniorId())
                .orElse(null);

        if (latestLocation != null
                && latestLocation.getLatitude() != null
                && latestLocation.getLongitude() != null
                && calculateDistanceMeters(
                latestLocation.getLatitude(),
                latestLocation.getLongitude(),
                request.latitude(),
                request.longitude()
        ) < 50) {
            latestLocation.setLatitude(request.latitude());
            latestLocation.setLongitude(request.longitude());
            latestLocation.setAddress(request.address());
            latestLocation.setAccuracy(request.accuracy());
            latestLocation.setReceivedAt(LocalDateTime.now());
            return locationStatusRepository.save(latestLocation);
        }

        LocationStatus locationStatus = new LocationStatus();
        locationStatus.setSeniorId(request.seniorId());
        locationStatus.setLatitude(request.latitude());
        locationStatus.setLongitude(request.longitude());
        locationStatus.setAddress(request.address());
        locationStatus.setAccuracy(request.accuracy());

        LocationStatus savedLocation = locationStatusRepository.save(locationStatus);
        createSafeZoneExitAlertsIfNeeded(request, latestLocation);

        return savedLocation;
    }

    private void createSafeZoneExitAlertsIfNeeded(LocationSaveRequest request, LocationStatus previousLocation) {
        List<SafeZones> safeZones = safeZonesRepository.findBySeniorIdOrderByIdAsc(request.seniorId());

        if (safeZones.isEmpty()) {
            return;
        }

        if (request.accuracy() != null && request.accuracy() > 100) {
            return;
        }

        double nearestDistanceMeters = Double.MAX_VALUE;
        SafeZones nearestSafeZone = null;

        for (SafeZones safeZone : safeZones) {
            if (safeZone.getCenterLatitude() == null || safeZone.getCenterLongitude() == null) {
                continue;
            }

            int radiusMeters = safeZone.getRadiusMeters() == null ? 500 : safeZone.getRadiusMeters();

            double distanceMeters = calculateDistanceMeters(
                    safeZone.getCenterLatitude(),
                    safeZone.getCenterLongitude(),
                    request.latitude(),
                    request.longitude()
            );

            double gpsToleranceMeters = request.accuracy() == null
                    ? 75
                    : Math.min(Math.max(request.accuracy(), 50), 150);
            double alertRadiusMeters = radiusMeters + gpsToleranceMeters + 30;

            if (distanceMeters <= alertRadiusMeters) {
                return;
            }

            if (distanceMeters < nearestDistanceMeters) {
                nearestDistanceMeters = distanceMeters;
                nearestSafeZone = safeZone;
            }
        }

        if (nearestSafeZone == null) {
            return;
        }

        if (previousLocation == null
                || previousLocation.getLatitude() == null
                || previousLocation.getLongitude() == null
                || !isOutsideAllSafeZones(previousLocation, safeZones)) {
            return;
        }

        boolean recentlyAlerted = alertRepository
                .findTopBySeniorIdAndTypeOrderByCreatedAtDesc(request.seniorId(), "SAFE_ZONE_EXIT")
                .map(alert -> alert.getCreatedAt().isAfter(LocalDateTime.now().minusMinutes(10)))
                .orElse(false);

        if (recentlyAlerted) {
            return;
        }

        Senior senior = seniorRepository.findById(request.seniorId()).orElse(null);
        String seniorName = senior == null ? "보호 대상자" : senior.getName();
        String safeZoneName = nearestSafeZone.getName() == null || nearestSafeZone.getName().isBlank()
                ? "안전 반경"
                : nearestSafeZone.getName();

        List<GuardianSenior> guardians = guardianSeniorRepository.findBySeniorId(request.seniorId());

        for (GuardianSenior guardian : guardians) {
            Alert alert = new Alert();
            alert.setSeniorId(request.seniorId());
            alert.setGuardianId(guardian.getGuardianId());
            alert.setType("SAFE_ZONE_EXIT");
            alert.setTitle("안전 반경 이탈");
            alert.setMessage(
                    seniorName + "님이 등록된 안전 반경을 모두 벗어났습니다. "
                            + "가장 가까운 반경: " + safeZoneName
                            + " · 현재 거리: " + Math.round(nearestDistanceMeters) + "m"
            );
            alert.setLatitude(request.latitude());
            alert.setLongitude(request.longitude());
            alert.setIsRead(false);

            Alert savedAlert = alertRepository.save(alert);

            fcmPushService.sendToUser(
                    "GUARDIAN",
                    savedAlert.getGuardianId(),
                    savedAlert.getTitle(),
                    savedAlert.getMessage(),
                    savedAlert.getType()
            );
        }
    }

    private boolean isOutsideAllSafeZones(LocationStatus location, List<SafeZones> safeZones) {
        for (SafeZones safeZone : safeZones) {
            if (safeZone.getCenterLatitude() == null || safeZone.getCenterLongitude() == null) {
                continue;
            }

            int radiusMeters = safeZone.getRadiusMeters() == null ? 500 : safeZone.getRadiusMeters();
            double distanceMeters = calculateDistanceMeters(
                    safeZone.getCenterLatitude(),
                    safeZone.getCenterLongitude(),
                    location.getLatitude(),
                    location.getLongitude()
            );
            double gpsToleranceMeters = location.getAccuracy() == null
                    ? 75
                    : Math.min(Math.max(location.getAccuracy(), 50), 150);
            double alertRadiusMeters = radiusMeters + gpsToleranceMeters + 30;

            if (distanceMeters <= alertRadiusMeters) {
                return false;
            }
        }

        return true;
    }

    private double calculateDistanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double earthRadius = 6371000;
        double latDistance = Math.toRadians(lat2 - lat1);
        double lngDistance = Math.toRadians(lng2 - lng1);

        double a = Math.sin(latDistance / 2) * Math.sin(latDistance / 2)
                + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2))
                * Math.sin(lngDistance / 2)
                * Math.sin(lngDistance / 2);

        return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    @GetMapping("/senior/{seniorId}/latest")
    public ResponseEntity<LocationStatus> getLatestLocation(@PathVariable Long seniorId) {
        return locationStatusRepository.findTopBySeniorIdOrderByReceivedAtDesc(seniorId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/senior/{seniorId}/today")
    public List<LocationStatus> getTodayLocations(@PathVariable Long seniorId) {
        LocalDateTime start = LocalDate.now().atStartOfDay();
        LocalDateTime end = start.plusDays(1);

        return locationStatusRepository.findBySeniorIdAndReceivedAtBetweenOrderByReceivedAtAsc(seniorId, start, end);
    }

    @GetMapping("/senior/{seniorId}/date")
    public List<LocationStatus> getLocationsByDate(@PathVariable Long seniorId, @RequestParam LocalDate date) {
        LocalDateTime start = date.atStartOfDay();
        LocalDateTime end = start.plusDays(1);

        return locationStatusRepository.findBySeniorIdAndReceivedAtBetweenOrderByReceivedAtAsc(seniorId, start, end);
    }

    public record LocationSaveRequest(
            Long seniorId,
            Double latitude,
            Double longitude,
            String address,
            Double accuracy
    ) {
    }
}
