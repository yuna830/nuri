package com.nuri.woorilink.controller;

import com.nuri.woorilink.entity.CareEvent;
import com.nuri.woorilink.service.CareMonitoringService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@RequiredArgsConstructor
public class FallAlertController {
    private final CareMonitoringService careMonitoringService;

    @Value("${fall-alert.api-key:}")
    private String fallAlertApiKey;

    @PostMapping("/fall")
    public Map<String, Object> receiveFall(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestBody FallAlertRequest request) {
        validateApiKey(authorization);
        String imageUrl = request.imageAccessUrl() == null || request.imageAccessUrl().isBlank()
                ? request.imageUrl()
                : request.imageAccessUrl();
        CareEvent event = careMonitoringService.reportFall(
                request.seniorId(), request.score(), imageUrl, request.fallDetails());
        return Map.of(
                "id", event.getId(),
                "status", "accepted",
                "eventType", event.getType().name(),
                "imageStored", event.getImageUrl() != null
        );
    }

    private void validateApiKey(String authorization) {
        if (!StringUtils.hasText(fallAlertApiKey)) {
            return;
        }
        if (!("Bearer " + fallAlertApiKey).equals(authorization)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Invalid fall alert API key"
            );
        }
    }

    public record FallAlertRequest(Long seniorId, Integer score, String imageUrl, String imageAccessUrl,
                                   Boolean notifyGuardian, Boolean escalationRequired,
                                   Map<String, Object> fallDetails) { }
}
