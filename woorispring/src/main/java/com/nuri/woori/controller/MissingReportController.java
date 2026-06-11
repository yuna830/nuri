package com.nuri.woori.controller;

import com.nuri.woori.entity.MissingReport;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.MissingReportRepository;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.entity.MissingReportImage;
import com.nuri.woori.repository.MissingReportImageRepository;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.time.Duration;

@RestController
@RequestMapping("/api/missing-reports")
@CrossOrigin(origins = "*")
public class MissingReportController {

    private final MissingReportRepository missingReportRepository;
    private final SeniorRepository seniorRepository;
    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final MissingReportImageRepository missingReportImageRepository;

    @Value("${app.face-server-url:http://localhost:8000}")
    private String faceServerUrl;

    public MissingReportController(
            MissingReportRepository missingReportRepository,
            SeniorRepository seniorRepository,
            MissingReportImageRepository missingReportImageRepository
    ) {
        this.missingReportRepository = missingReportRepository;
        this.seniorRepository = seniorRepository;
        this.missingReportImageRepository = missingReportImageRepository;
    }

    @PostMapping
    public MissingReport createMissingReport(@RequestBody MissingReportCreateRequest request) {
        MissingReport missingReport = new MissingReport();
        missingReport.setSeniorId(request.seniorId());
        missingReport.setGuardianId(request.guardianId());
        missingReport.setLastSeenAddress(request.lastSeenAddress());
        missingReport.setLastSeenLatitude(request.lastSeenLatitude());
        missingReport.setLastSeenLongitude(request.lastSeenLongitude());
        missingReport.setDescription(request.description());
        missingReport.setStatus("ACTIVE");

        List<String> imageUrls = normalizeImageUrls(request.imageUrl(), request.imageUrls());
        if (!imageUrls.isEmpty()) {
            missingReport.setImageUrl(imageUrls.get(0));
        }

        MissingReport savedReport = missingReportRepository.save(missingReport);

        for (int i = 0; i < imageUrls.size(); i++) {
            MissingReportImage image = new MissingReportImage();
            image.setMissingReportId(savedReport.getId());
            image.setImageUrl(imageUrls.get(i));
            image.setSortOrder(i);
            missingReportImageRepository.save(image);
        }

        reloadFaceServer();

        return savedReport;
    }

    @GetMapping
    public List<MissingReport> getMissingReports() {
        return missingReportRepository.findAll();
    }

    @GetMapping("/guardian/{guardianId}")
    public List<MissingReportResponse> getMissingReportsByGuardian(@PathVariable Long guardianId) {
        return missingReportRepository.findByGuardianId(guardianId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @GetMapping("/face-targets")
    public List<MissingFaceTargetResponse> getFaceTargets() {
        return missingReportRepository.findByStatus("ACTIVE")
                .stream()
                .map(report -> {
                    List<String> imageUrls = missingReportImageRepository
                            .findByMissingReportIdOrderBySortOrderAscIdAsc(report.getId())
                            .stream()
                            .map(MissingReportImage::getImageUrl)
                            .filter(url -> url != null && !url.isBlank())
                            .toList();

                    if (imageUrls.isEmpty()
                            && report.getImageUrl() != null
                            && !report.getImageUrl().isBlank()) {
                        imageUrls = List.of(report.getImageUrl());
                    }

                    String seniorName = report.getSeniorId() == null
                            ? extractExternalPersonName(report.getDescription())
                            : seniorRepository.findById(report.getSeniorId())
                            .map(Senior::getName)
                            .orElse("실종 신고");

                    return new MissingFaceTargetResponse(
                            report.getId(),
                            report.getSeniorId(),
                            seniorName,
                            report.getDescription(),
                            imageUrls.isEmpty() ? null : imageUrls.get(0),
                            imageUrls
                    );
                })
                .filter(report -> report.imageUrls() != null && !report.imageUrls().isEmpty())
                .toList();
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
        MissingReport savedReport = missingReportRepository.save(report);

        reloadFaceServer();

        return savedReport;
    }

    // 신고 취소
    @PatchMapping("/{id}/cancel")
    public MissingReportResponse cancelMissingReport(@PathVariable Long id) {
        MissingReport report = missingReportRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Missing report not found"));
        report.setStatus("CANCELLED");
        report.setCancelledAt(java.time.LocalDateTime.now());
        return toResponse(missingReportRepository.save(report));
    }

    private void reloadFaceServer() {
        try {
            String baseUrl = faceServerUrl == null ? "" : faceServerUrl.trim();

            if (baseUrl.endsWith("/")) {
                baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/face/reload"))
                    .timeout(Duration.ofSeconds(30))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();

            HttpResponse<String> response = httpClient.send(
                    request,
                    HttpResponse.BodyHandlers.ofString()
            );

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                System.out.println("Face server reload failed: status=" + response.statusCode());
            } else {
                System.out.println("Face server reload success: " + response.body());
            }
        } catch (Exception error) {
            System.out.println("Face server reload failed: " + error.getMessage());
        }
    }

    private String extractExternalPersonName(String description) {
        if (description == null || description.isBlank()) {
            return "외부 신고";
        }

        String prefix = "대상자 이름:";
        String[] lines = description.split("\\R");

        for (String line : lines) {
            String trimmed = line.trim();

            if (trimmed.startsWith(prefix)) {
                String name = trimmed.substring(prefix.length()).trim();
                if (!name.isBlank()) {
                    return name;
                }
            }
        }

        return "외부 신고";
    }

    public record MissingFaceTargetResponse(
            Long missingReportId,
            Long seniorId,
            String name,
            String description,
            String imageUrl,
            List<String> imageUrls
    ) {
    }

    public record MissingReportCreateRequest(
            Long seniorId,
            Long guardianId,
            Double lastSeenLatitude,
            Double lastSeenLongitude,
            String lastSeenAddress,
            String description,
            String imageUrl,
            List<String> imageUrls
    ) {
    }

    public record MissingReportResponse(
            Long id,
            Long seniorId,
            String seniorName,
            Long guardianId,
            String status,
            String lastSeenAddress,
            Double lastSeenLatitude,
            Double lastSeenLongitude,
            String description,
            java.time.LocalDateTime reportedAt,
            String imageUrl,
            List<String> imageUrls
    ) {
    }

    // 헬퍼 메서드 추가
    private MissingReportResponse toResponse(MissingReport report) {
        List<String> imageUrls = missingReportImageRepository
                .findByMissingReportIdOrderBySortOrderAscIdAsc(report.getId())
                .stream()
                .map(MissingReportImage::getImageUrl)
                .filter(url -> url != null && !url.isBlank())
                .toList();

        if (imageUrls.isEmpty()
                && report.getImageUrl() != null
                && !report.getImageUrl().isBlank()) {
            imageUrls = List.of(report.getImageUrl());
        }

        String seniorName = null;
        if (report.getSeniorId() != null) {
            seniorName = seniorRepository.findById(report.getSeniorId())
                    .map(Senior::getName)
                    .orElse(null);
        }

        return new MissingReportResponse(
                report.getId(),
                report.getSeniorId(),
                seniorName,
                report.getGuardianId(),
                report.getStatus(),
                report.getLastSeenAddress(),
                report.getLastSeenLatitude(),
                report.getLastSeenLongitude(),
                report.getDescription(),
                report.getReportedAt(),
                report.getImageUrl(),
                imageUrls
        );
    }

    private List<String> normalizeImageUrls(String imageUrl, List<String> imageUrls) {
        LinkedHashSet<String> values = new LinkedHashSet<>();

        if (imageUrl != null && !imageUrl.isBlank()) {
            values.add(imageUrl.trim());
        }

        if (imageUrls != null) {
            for (String value : imageUrls) {
                if (value != null && !value.isBlank()) {
                    values.add(value.trim());
                }
            }
        }

        return new ArrayList<>(values);
    }
}