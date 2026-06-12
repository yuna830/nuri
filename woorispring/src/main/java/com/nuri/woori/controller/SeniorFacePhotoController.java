package com.nuri.woori.controller;

import com.nuri.woori.entity.MissingReport;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.entity.SeniorFacePhoto;
import com.nuri.woori.repository.MissingReportRepository;
import com.nuri.woori.repository.SeniorFacePhotoRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 어르신 얼굴 사진 사전 등록 관리.
 * 보호자가 평소에 사진을 등록해두면, 실종 신고 시 face_api가 이 사진들을 비교 대상으로 사용한다.
 */
@RestController
@RequestMapping("/api/seniors")
@CrossOrigin(origins = "*")
public class SeniorFacePhotoController {

    private final SeniorFacePhotoRepository seniorFacePhotoRepository;
    private final SeniorRepository seniorRepository;
    private final MissingReportRepository missingReportRepository;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${app.face-server-url:http://localhost:8000}")
    private String faceServerUrl;

    public SeniorFacePhotoController(
            SeniorFacePhotoRepository seniorFacePhotoRepository,
            SeniorRepository seniorRepository,
            MissingReportRepository missingReportRepository
    ) {
        this.seniorFacePhotoRepository = seniorFacePhotoRepository;
        this.seniorRepository = seniorRepository;
        this.missingReportRepository = missingReportRepository;
    }

    @GetMapping("/{seniorId}/face-photos")
    public List<SeniorFacePhoto> getFacePhotos(@PathVariable Long seniorId) {
        return seniorFacePhotoRepository.findBySeniorIdOrderByIdAsc(seniorId);
    }

    @PostMapping("/{seniorId}/face-photos")
    public SeniorFacePhoto addFacePhoto(
            @PathVariable Long seniorId,
            @RequestBody FacePhotoRequest request
    ) {
        if (request.imageUrl() == null || request.imageUrl().isBlank()) {
            throw new IllegalArgumentException("imageUrl is required");
        }

        if (seniorFacePhotoRepository.findBySeniorIdOrderByIdAsc(seniorId).size() >= 4) {
            throw new IllegalArgumentException("얼굴 사진은 최대 4장까지 등록할 수 있습니다.");
        }

        SeniorFacePhoto photo = new SeniorFacePhoto();
        photo.setSeniorId(seniorId);
        photo.setImageUrl(request.imageUrl().trim());
        SeniorFacePhoto saved = seniorFacePhotoRepository.save(photo);

        reloadFaceServer();
        return saved;
    }

    @DeleteMapping("/face-photos/{photoId}")
    public void deleteFacePhoto(@PathVariable Long photoId) {
        seniorFacePhotoRepository.deleteById(photoId);
        reloadFaceServer();
    }

    /**
     * face_api 비교 대상 — ACTIVE 실종 신고가 있는 어르신의 사전 등록 사진만 내려준다.
     */
    @GetMapping("/face-photo-targets")
    public List<FacePhotoTargetResponse> getFacePhotoTargets() {
        Set<Long> reportedSeniorIds = new LinkedHashSet<>();
        for (MissingReport report : missingReportRepository.findByStatus("ACTIVE")) {
            if (report.getSeniorId() != null) {
                reportedSeniorIds.add(report.getSeniorId());
            }
        }

        return reportedSeniorIds.stream()
                .map(seniorId -> {
                    List<String> imageUrls = seniorFacePhotoRepository
                            .findBySeniorIdOrderByIdAsc(seniorId)
                            .stream()
                            .map(SeniorFacePhoto::getImageUrl)
                            .filter(url -> url != null && !url.isBlank())
                            .toList();

                    String seniorName = seniorRepository.findById(seniorId)
                            .map(Senior::getName)
                            .orElse("보호 대상자");

                    return new FacePhotoTargetResponse(seniorId, seniorName, imageUrls);
                })
                .filter(target -> !target.imageUrls().isEmpty())
                .toList();
    }

    // 재로드(전체 사진 재임베딩)는 오래 걸릴 수 있으므로 비동기로 보내고
    // 사진 저장 API 응답은 즉시 반환한다.
    private void reloadFaceServer() {
        try {
            String baseUrl = faceServerUrl == null ? "" : faceServerUrl.trim();

            if (baseUrl.endsWith("/")) {
                baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
            }

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + "/api/face/reload"))
                    .timeout(Duration.ofSeconds(60))
                    .POST(HttpRequest.BodyPublishers.noBody())
                    .build();

            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                    .whenComplete((response, error) -> {
                        if (error != null) {
                            System.out.println("Face server reload failed: " + error.getMessage());
                        } else if (response.statusCode() < 200 || response.statusCode() >= 300) {
                            System.out.println("Face server reload failed: status=" + response.statusCode());
                        } else {
                            System.out.println("Face server reload success: " + response.body());
                        }
                    });
        } catch (Exception error) {
            System.out.println("Face server reload failed: " + error.getMessage());
        }
    }

    public record FacePhotoRequest(String imageUrl) {
    }

    public record FacePhotoTargetResponse(
            Long seniorId,
            String seniorName,
            List<String> imageUrls
    ) {
    }
}
