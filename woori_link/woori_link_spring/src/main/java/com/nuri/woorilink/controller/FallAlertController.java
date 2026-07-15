package com.nuri.woorilink.controller;

import com.nuri.woorilink.entity.CareEvent;
import com.nuri.woorilink.service.CareMonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class FallAlertController {
    private final CareMonitoringService careMonitoringService;

    @PostMapping("/fall")
    public Map<String, Object> receiveFall(@RequestBody FallAlertRequest request) {
        String note = "Fall model detected: score=" + request.score();
        CareEvent event = careMonitoringService.reportEvent(
                request.seniorId(), CareEvent.EventType.FALL_DETECTED, null, null, note);
        return Map.of("id", event.getId(), "status", "accepted", "eventType", event.getType().name());
    }

    public record FallAlertRequest(Long seniorId, Integer score, String imageUrl,
                                   Boolean notifyGuardian, Boolean escalationRequired,
                                   Map<String, Object> fallDetails) { }
}
