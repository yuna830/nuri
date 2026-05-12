package com.nuri.woori.controller;

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
            SeniorRepository seniorRepository
    ) {
        this.locationStatusRepository = locationStatusRepository;
        this.safeZonesRepository = safeZonesRepository;
        this.alertRepository = alertRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
        this.seniorRepository = seniorRepository;
    }

    @PostMapping
    public LocationStatus saveLocation(@RequestBody LocationSaveRequest request) {
        LocationStatus locationStatus = new LocationStatus();
        locationStatus.setSeniorId(request.seniorId());
        locationStatus.setLatitude(request.latitude());
        locationStatus.setLongitude(request.longitude());
        locationStatus.setAddress(request.address());
        locationStatus.setAccuracy(request.accuracy());

        LocationStatus savedLocation = locationStatusRepository.save(locationStatus);
        createSafeZoneExitAlertsIfNeeded(request);

        return savedLocation;
    }

    private void createSafeZoneExitAlertsIfNeeded(LocationSaveRequest request) {
        SafeZones safeZone = safeZonesRepository.findBySeniorId(request.seniorId()).orElse(null);

        if (safeZone == null || safeZone.getCenterLatitude() == null || safeZone.getCenterLongitude() == null) {
            return;
        }

        double distanceMeters = calculateDistanceMeters(
                safeZone.getCenterLatitude(),
                safeZone.getCenterLongitude(),
                request.latitude(),
                request.longitude()
        );

        if (distanceMeters <= safeZone.getRadiusMeters()) {
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

        List<GuardianSenior> guardians = guardianSeniorRepository.findBySeniorId(request.seniorId());

        for (GuardianSenior guardian : guardians) {
            Alert alert = new Alert();
            alert.setSeniorId(request.seniorId());
            alert.setGuardianId(guardian.getGuardianId());
            alert.setType("SAFE_ZONE_EXIT");
            alert.setTitle("안전 반경 이탈");
            alert.setMessage(seniorName + "님이 안전 반경을 벗어났습니다. 현재 거리: " + Math.round(distanceMeters) + "m");
            alert.setLatitude(request.latitude());
            alert.setLongitude(request.longitude());
            alert.setIsRead(false);

            alertRepository.save(alert);
        }
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
