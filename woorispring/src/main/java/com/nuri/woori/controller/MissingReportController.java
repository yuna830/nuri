package com.nuri.woori.controller;

import com.nuri.woori.entity.MissingReport;
import com.nuri.woori.repository.MissingReportRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/missing-reports")
@CrossOrigin(origins = "*")
public class MissingReportController {

    private final MissingReportRepository missingReportRepository;

    public MissingReportController(MissingReportRepository missingReportRepository) {
        this.missingReportRepository = missingReportRepository;
    }

    @PostMapping
    public MissingReport createMissingReport(@RequestBody MissingReport missingReport) {
        missingReport.setStatus("ACTIVE");
        return missingReportRepository.save(missingReport);
    }

    @GetMapping
    public List<MissingReport> getMissingReports() {
        return missingReportRepository.findAll();
    }

    @GetMapping("/guardian/{guardianId}")
    public List<MissingReport> getMissingReportsByGuardian(@PathVariable Long guardianId) {
        return missingReportRepository.findByGuardianId(guardianId);
    }

    @GetMapping("/{id}")
    public MissingReport getMissingReport(@PathVariable Long id) {
        return missingReportRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Missing report not found"));
    }

    @PatchMapping("/{id}/resolve")
    public MissingReport resolveMissingReport(@PathVariable Long id) {
        MissingReport report = missingReportRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Missing report not found"));

        report.setStatus("RESOLVED");
        return missingReportRepository.save(report);
    }

    @GetMapping("/face-targets")
    public List<MissingReport> getFaceTargets() {
        return missingReportRepository.findByStatus("ACTIVE")
                .stream()
                .filter(report -> report.getImageUrl() != null && !report.getImageUrl().isBlank())
                .toList();
    }
}
