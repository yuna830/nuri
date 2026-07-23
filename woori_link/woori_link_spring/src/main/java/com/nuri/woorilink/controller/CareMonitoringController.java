package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.entity.*;
import com.nuri.woorilink.service.CareMonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    @PatchMapping("/events/{eventId}/fall-status")
    public CareEvent updateFallStatus(@PathVariable Long eventId,
                                      @RequestBody FallStatusRequest request,
                                      Authentication authentication) {
        return careMonitoringService.updateFallStatus(
                eventId, request.status(), requireGuardian(authentication));
    }

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

    @PostMapping("/seniors/{seniorId}/notifications")
    @ResponseStatus(HttpStatus.CREATED)
    public List<CareAlert> createSeniorNotification(@PathVariable Long seniorId,
                                                  @RequestBody WelfareNoticeRequest request,
                                                  @AuthenticationPrincipal AuthenticatedUser user) {
        return careMonitoringService.createWelfareNotice(
                seniorId,
                requireWelfareWorker(user),
                request.title(),
                request.message(),
                request.notifySenior(),
                request.notifyGuardian()
        );
    }

    @GetMapping("/welfare-notices")
    public List<CareAlert> welfareNotices(@AuthenticationPrincipal AuthenticatedUser user) {
        return careMonitoringService.welfareNotices(requireWelfareWorker(user));
    }

    @DeleteMapping("/welfare-notices/{alertId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancelWelfareNotice(@PathVariable Long alertId, @AuthenticationPrincipal AuthenticatedUser user) {
        careMonitoringService.cancelWelfareNotice(alertId, requireWelfareWorker(user));
    }

    @GetMapping("/seniors/{seniorId}/alerts")
    public List<CareAlert> seniorAlerts(@PathVariable Long seniorId, Authentication authentication) {
        Long authenticatedSeniorId = requireSenior(authentication);
        if (!authenticatedSeniorId.equals(seniorId)) {
            throw new AccessDeniedException("You can only view your own alerts");
        }
        return careMonitoringService.seniorAlerts(authenticatedSeniorId);
    }

    @PatchMapping("/senior-alerts/{alertId}")
    public CareAlert acknowledgeSeniorAlert(@PathVariable Long alertId, Authentication authentication) {
        return careMonitoringService.acknowledgeSeniorAlert(alertId, requireSenior(authentication));
    }

    @PatchMapping("/seniors/{seniorId}/alerts/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void acknowledgeAllSeniorAlerts(@PathVariable Long seniorId, Authentication authentication) {
        Long authenticatedSeniorId = requireSenior(authentication);
        if (!authenticatedSeniorId.equals(seniorId)) {
            throw new AccessDeniedException("You can only update your own alerts");
        }
        careMonitoringService.acknowledgeAllSeniorAlerts(authenticatedSeniorId);
    }

    @DeleteMapping("/senior-alerts/{alertId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSeniorAlert(@PathVariable Long alertId, Authentication authentication) {
        careMonitoringService.deleteSeniorAlert(alertId, requireSenior(authentication));
    }

    @DeleteMapping("/seniors/{seniorId}/alerts")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAllSeniorAlerts(@PathVariable Long seniorId, Authentication authentication) {
        Long authenticatedSeniorId = requireSenior(authentication);
        if (!authenticatedSeniorId.equals(seniorId)) {
            throw new AccessDeniedException("You can only delete your own alerts");
        }
        careMonitoringService.deleteAllSeniorAlerts(authenticatedSeniorId);
    }

    @GetMapping("/guardians/{guardianId}/alerts")
    public List<CareAlert> guardianAlerts(@PathVariable Long guardianId, Authentication authentication) {
        Long authenticatedGuardianId = requireGuardian(authentication);
        if (!authenticatedGuardianId.equals(guardianId)) {
            throw new AccessDeniedException("You can only view your own alerts");
        }
        return careMonitoringService.guardianAlerts(authenticatedGuardianId);
    }

    @PatchMapping("/alerts/{alertId}")
    public CareAlert acknowledge(@PathVariable Long alertId, @RequestBody AlertStatusRequest request,
                                 Authentication authentication) {
        return careMonitoringService.acknowledgeAlert(
                alertId, request.resolved(), requireGuardian(authentication));
    }

    private Long requireWelfareWorker(AuthenticatedUser user) {
        if (user == null || !"WELFARE_WORKER".equals(user.getRole())) {
            throw new AccessDeniedException("Welfare worker authentication is required");
        }
        return user.getUserId();
    }
    private Long requireWelfareWorker(Authentication authentication) {
        if (authentication == null
                || !(authentication.getPrincipal() instanceof AuthenticatedUser user)
                || !"WELFARE_WORKER".equals(user.getRole())) {
            throw new AccessDeniedException("Welfare worker authentication is required");
        }
        return user.getUserId();
    }

    private Long requireSenior(Authentication authentication) {
        if (authentication == null
                || !(authentication.getPrincipal() instanceof AuthenticatedUser user)
                || !"SENIOR".equals(user.getRole())) {
            throw new AccessDeniedException("Senior authentication is required");
        }
        return user.getUserId();
    }

    private Long requireGuardian(Authentication authentication) {
        if (authentication == null
                || !(authentication.getPrincipal() instanceof AuthenticatedUser user)
                || !"GUARDIAN".equals(user.getRole())) {
            throw new AccessDeniedException("Guardian authentication is required");
        }
        return user.getUserId();
    }

    public record EventRequest(CareEvent.EventType type, Double latitude, Double longitude, String note) { }
    public record LocationRequest(double latitude, double longitude) { }
    public record SafetyZoneRequest(Long id, int slotNumber, String name, double latitude, double longitude, int radiusMeters) { }
    public record AlertStatusRequest(boolean resolved) { }
    public record FallStatusRequest(CareEvent.EventStatus status) { }
    public record CheckInResponse(String message) { }
    public record WelfareNoticeRequest(String title, String message, boolean notifySenior, boolean notifyGuardian) { }
}
