package com.nuri.woori.controller;

import com.nuri.woori.entity.PoliceMissingAlert;
import com.nuri.woori.service.PoliceMissingAlertService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/police-missing-alerts")
@CrossOrigin(origins = "*")
public class PoliceMissingAlertController {

    private final PoliceMissingAlertService policeMissingAlertService;

    public PoliceMissingAlertController(PoliceMissingAlertService policeMissingAlertService) {
        this.policeMissingAlertService = policeMissingAlertService;
    }

    @GetMapping
    public List<PoliceMissingAlert> getLatestAlerts() {
        return policeMissingAlertService.getLatestAlerts();
    }

    @PostMapping("/sync")
    public List<PoliceMissingAlert> syncAlerts(@RequestParam(required = false) String date) {
        if (date == null || date.isBlank()) {
            return policeMissingAlertService.syncTodayAlerts();
        }

        return policeMissingAlertService.syncAlerts(LocalDate.parse(date));
    }
}
