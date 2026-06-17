package com.nuri.woori.controller;

import com.nuri.woori.entity.Alert;
import com.nuri.woori.entity.MissingReport;
import com.nuri.woori.entity.SightingReport;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.MissingReportRepository;
import com.nuri.woori.repository.SightingReportRepository;
import com.nuri.woori.service.FcmPushService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sighting-reports")
@CrossOrigin(origins = "*")
public class SightingReportController {

    private final SightingReportRepository sightingReportRepository;
    private final MissingReportRepository missingReportRepository;
    private final AlertRepository alertRepository;
    private final FcmPushService fcmPushService;

    public SightingReportController(SightingReportRepository sightingReportRepository,
                                    MissingReportRepository missingReportRepository,
                                    AlertRepository alertRepository,
                                    FcmPushService fcmPushService) {
        this.sightingReportRepository = sightingReportRepository;
        this.missingReportRepository = missingReportRepository;
        this.alertRepository = alertRepository;
        this.fcmPushService = fcmPushService;
    }

    @PostMapping
    public SightingReport createSightingReport(@RequestBody SightingReport sightingReport) {
        if (sightingReport.getSimilarityScore() != null && sightingReport.getSimilarityScore() >= 0.62) {
            sightingReport.setStatus("MATCHED");
        } else if (sightingReport.getSimilarityScore() != null && sightingReport.getSimilarityScore() >= 0.55) {
            sightingReport.setStatus("POSSIBLE");
        } else {
            sightingReport.setStatus("UNMATCHED");
        }

        SightingReport savedSightingReport = sightingReportRepository.save(sightingReport);

        if ("MATCHED".equals(savedSightingReport.getStatus())) {
            createMissingSightingAlert(savedSightingReport);
        }

        return savedSightingReport;
    }

    @GetMapping("/missing-report/{missingReportId}")
    public List<SightingReport> getSightings(@PathVariable Long missingReportId) {
        return sightingReportRepository.findByMissingReportIdOrderByCreatedAtDesc(missingReportId);
    }

    private void createMissingSightingAlert(SightingReport sightingReport) {
        MissingReport missingReport = missingReportRepository.findById(sightingReport.getMissingReportId())
                .orElseThrow(() -> new RuntimeException("Missing report not found"));

        Alert alert = new Alert();
        alert.setSeniorId(missingReport.getSeniorId());
        alert.setGuardianId(missingReport.getGuardianId());
        alert.setType("MISSING_SIGHTING");
        alert.setTitle("실종자 발견 후보");
        alert.setMessage("실종 노인과 유사한 인물이 발견되었습니다.");
        alert.setLatitude(sightingReport.getLatitude());
        alert.setLongitude(sightingReport.getLongitude());
        alert.setIsRead(false);

        alertRepository.save(alert);

        fcmPushService.sendToUser("GUARDIAN", missingReport.getGuardianId(),
                alert.getTitle(), alert.getMessage(), "MISSING_SIGHTING");
    }
}
