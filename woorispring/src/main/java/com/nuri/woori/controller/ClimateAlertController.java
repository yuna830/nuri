package com.nuri.woori.controller;

import com.nuri.woori.entity.ClimateAlert;
import com.nuri.woori.repository.ClimateAlertRepository;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/climate-alerts")
@CrossOrigin(origins = "*")
public class ClimateAlertController {
    private final ClimateAlertRepository climateAlertRepository;

    public ClimateAlertController(ClimateAlertRepository climateAlertRepository) {
        this.climateAlertRepository = climateAlertRepository;
    }

    @GetMapping("/senior/{seniorId}/today")
    public List<ClimateAlert> getTodayAlerts(@PathVariable Long seniorId) {
        return climateAlertRepository.findTop6BySeniorIdAndAlertDateOrderByIssuedAtDesc(seniorId, LocalDate.now());
    }

    @GetMapping("/senior/{seniorId}/latest")
    public List<ClimateAlert> getLatestAlerts(@PathVariable Long seniorId) {
        return climateAlertRepository.findTop6BySeniorIdOrderByIssuedAtDesc(seniorId);
    }

    @PostMapping
    public ClimateAlert saveAlert(@RequestBody ClimateAlertRequest request) {
        ClimateAlert alert = climateAlertRepository
                .findBySeniorIdAndEventId(request.seniorId(), request.eventId())
                .orElseGet(ClimateAlert::new);

        alert.setSeniorId(request.seniorId());
        alert.setEventId(request.eventId());
        alert.setType(request.type());
        alert.setLevel(request.level());
        alert.setMessage(request.message());
        alert.setRegion(request.region());
        alert.setSource(request.source());
        alert.setAlertDate(request.alertDate() == null ? LocalDate.now() : LocalDate.parse(request.alertDate()));
        alert.setIssuedAt(request.issuedAt() == null ? LocalDateTime.now() : LocalDateTime.parse(request.issuedAt()));

        return climateAlertRepository.save(alert);
    }

    public record ClimateAlertRequest(
            Long seniorId,
            String eventId,
            String type,
            String level,
            String message,
            String region,
            String source,
            String alertDate,
            String issuedAt
    ) {
    }
}
