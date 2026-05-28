package com.nuri.woori.controller;

import com.nuri.woori.entity.PoliceMissingAlert;
import com.nuri.woori.repository.PoliceMissingAlertRepository;
import com.nuri.woori.service.PoliceMissingAlertService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;

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

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
    public List<PoliceMissingAlert> getLatestAlerts() {
        return policeMissingAlertService.getLatestAlerts();
    }

    @GetMapping("/{id}/photo")
    public ResponseEntity<byte[]> getPhoto(@PathVariable Long id) {
        PoliceMissingAlert alert = policeMissingAlertRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));

        String photoValue = alert.getPhotoUrl();

        if (photoValue == null || photoValue.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }

        try {
            byte[] imageBytes;

            if (photoValue.startsWith("/uploads/")) {
                String relativePath = photoValue.replaceFirst("^/uploads/", "");
                Path imagePath = Paths.get("uploads").resolve(relativePath).normalize();
                imageBytes = Files.readAllBytes(imagePath);
            } else {
                imageBytes = Base64.getMimeDecoder().decode(photoValue);
            }

            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_JPEG)
                    .body(imageBytes);
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
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
        return policeMissingAlertService.syncAlerts(
                LocalDate.parse(from),
                LocalDate.parse(to)
        );
    }

    @PostMapping("/sync-all")
    public List<PoliceMissingAlert> syncAllAlerts() {
        return policeMissingAlertService.syncAllAlerts();
    }
}
