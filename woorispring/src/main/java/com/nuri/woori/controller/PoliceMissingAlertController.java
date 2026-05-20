package com.nuri.woori.controller;

import com.nuri.woori.entity.PoliceMissingAlert;
import com.nuri.woori.service.PoliceMissingAlertService;
import org.springframework.web.bind.annotation.*;
import com.nuri.woori.repository.PoliceMissingAlertRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Base64;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/police-missing-alerts")
@CrossOrigin(origins = "*")
public class PoliceMissingAlertController {

    private final PoliceMissingAlertService policeMissingAlertService;
    private final PoliceMissingAlertRepository policeMissingAlertRepository;

    public PoliceMissingAlertController(
            PoliceMissingAlertService policeMissingAlertService,
            PoliceMissingAlertRepository policeMissingAlertRepository
    ) {
        this.policeMissingAlertService = policeMissingAlertService;
        this.policeMissingAlertRepository = policeMissingAlertRepository;
    }

    @GetMapping
    public List<PoliceMissingAlert> getLatestAlerts() {
        return policeMissingAlertService.getLatestAlerts();
    }

    @GetMapping("/{id}/photo")
    public ResponseEntity<byte[]> getPhoto(@PathVariable Long id) {
        PoliceMissingAlert alert = policeMissingAlertRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        if (alert.getPhotoUrl() == null || alert.getPhotoUrl().isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        byte[] imageBytes = Base64.getMimeDecoder().decode(alert.getPhotoUrl());

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .body(imageBytes);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteAllAlerts() {
        policeMissingAlertRepository.deleteAll();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/sync")
    public List<PoliceMissingAlert> syncAlerts(@RequestParam(required = false) String date) {
        if (date == null || date.isBlank()) {
            return policeMissingAlertService.syncTodayAlerts();
        }

        return policeMissingAlertService.syncAlerts(LocalDate.parse(date));
    }

    @PostMapping("/sync-range")
    public List<PoliceMissingAlert> syncRange(
            @RequestParam String from,
            @RequestParam String to
    ) {
        LocalDate start = LocalDate.parse(from);
        LocalDate end = LocalDate.parse(to);

        Map<String, PoliceMissingAlert> result = new LinkedHashMap<>();

        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            for (PoliceMissingAlert alert : policeMissingAlertService.syncAlerts(date)) {
                result.put(alert.getExternalKey(), alert);
            }
        }

        return new ArrayList<>(result.values());
    }
}
