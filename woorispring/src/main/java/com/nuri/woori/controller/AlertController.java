package com.nuri.woori.controller;

import com.nuri.woori.entity.Alert;
import com.nuri.woori.repository.AlertRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*")
public class AlertController {

    private final AlertRepository alertRepository;

    public AlertController(AlertRepository alertRepository) {
        this.alertRepository = alertRepository;
    }

    @GetMapping
    public List<Alert> getAlerts() {
        return alertRepository.findAll();
    }

    @GetMapping("/guardian/{guardianId}")
    public List<Alert> getGuardianAlerts(@PathVariable Long guardianId) {
        return alertRepository.findByGuardianIdOrderByCreatedAtDesc(guardianId);
    }

    @GetMapping("/senior/{seniorId}")
    public List<Alert> getSeniorAlerts(@PathVariable Long seniorId) {
        return alertRepository.findBySeniorIdOrderByCreatedAtDesc(seniorId);
    }

    @PatchMapping("/{id}/read")
    public Alert readAlert(@PathVariable Long id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found"));

        alert.setIsRead(true);
        return alertRepository.save(alert);
    }
}
