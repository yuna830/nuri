package com.nuri.woorilink.controller;

import com.nuri.woorilink.entity.*;
import com.nuri.woorilink.service.CareMonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/care")
@RequiredArgsConstructor
public class CareMonitoringController {
    private final CareMonitoringService careMonitoringService;

    @PostMapping("/seniors/{seniorId}/events")
    @ResponseStatus(HttpStatus.CREATED)
    public CareEvent reportEvent(@PathVariable Long seniorId, @RequestBody EventRequest request) {
        return careMonitoringService.reportEvent(seniorId, request.type(), request.latitude(), request.longitude(), request.note());
    }

    @GetMapping("/seniors/{seniorId}/events")
    public List<CareEvent> events(@PathVariable Long seniorId) { return careMonitoringService.events(seniorId); }

    @PostMapping("/seniors/{seniorId}/check-ins")
    @ResponseStatus(HttpStatus.CREATED)
    public CheckIn requestCheckIn(@PathVariable Long seniorId) { return careMonitoringService.requestCheckIn(seniorId); }

    @GetMapping("/seniors/{seniorId}/check-ins")
    public List<CheckIn> checkIns(@PathVariable Long seniorId) { return careMonitoringService.checkIns(seniorId); }

    @PatchMapping("/check-ins/{checkInId}/response")
    public CheckIn respondCheckIn(@PathVariable Long checkInId, @RequestBody CheckInResponse request) {
        return careMonitoringService.respondCheckIn(checkInId, request.message());
    }

    @PostMapping("/seniors/{seniorId}/locations")
    @ResponseStatus(HttpStatus.CREATED)
    public SeniorLocation recordLocation(@PathVariable Long seniorId, @RequestBody LocationRequest request) {
        return careMonitoringService.recordLocation(seniorId, request.latitude(), request.longitude());
    }

    @GetMapping("/seniors/{seniorId}/locations/latest")
    public SeniorLocation latestLocation(@PathVariable Long seniorId) {
        return careMonitoringService.latestLocation(seniorId).orElse(null);
    }

    @PutMapping("/seniors/{seniorId}/safety-zone")
    public SafetyZone saveSafetyZone(@PathVariable Long seniorId, @RequestBody SafetyZoneRequest request) {
        return careMonitoringService.saveSafetyZone(seniorId, request.id(), request.slotNumber(), request.name(), request.latitude(), request.longitude(), request.radiusMeters());
    }

    @DeleteMapping("/seniors/{seniorId}/safety-zone/{zoneId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSafetyZone(@PathVariable Long seniorId, @PathVariable Long zoneId) {
        careMonitoringService.deleteSafetyZone(seniorId, zoneId);
    }

    @GetMapping("/seniors/{seniorId}/safety-zone")
    public List<SafetyZone> safetyZones(@PathVariable Long seniorId) { return careMonitoringService.safetyZones(seniorId); }

    @GetMapping("/guardians/{guardianId}/alerts")
    public List<CareAlert> guardianAlerts(@PathVariable Long guardianId) { return careMonitoringService.guardianAlerts(guardianId); }

    @PatchMapping("/alerts/{alertId}")
    public CareAlert acknowledge(@PathVariable Long alertId, @RequestBody AlertStatusRequest request) {
        return careMonitoringService.acknowledgeAlert(alertId, request.resolved());
    }

    public record EventRequest(CareEvent.EventType type, Double latitude, Double longitude, String note) { }
    public record LocationRequest(double latitude, double longitude) { }
    public record SafetyZoneRequest(Long id, int slotNumber, String name, double latitude, double longitude, int radiusMeters) { }
    public record AlertStatusRequest(boolean resolved) { }
    public record CheckInResponse(String message) { }
}
