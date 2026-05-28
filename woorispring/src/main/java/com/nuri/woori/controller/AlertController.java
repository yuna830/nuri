package com.nuri.woori.controller;

import com.nuri.woori.entity.Alert;
import com.nuri.woori.entity.GuardianSenior;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*")
public class AlertController {

    private final AlertRepository alertRepository;
    private final GuardianSeniorRepository guardianSeniorRepository;
    private final SeniorRepository seniorRepository;

    public AlertController(
            AlertRepository alertRepository,
            GuardianSeniorRepository guardianSeniorRepository,
            SeniorRepository seniorRepository
    ) {
        this.alertRepository = alertRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
        this.seniorRepository = seniorRepository;
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

    @PostMapping("/sos")
    public List<Alert> createSosAlert(@RequestBody SosAlertRequest request) {
        return createGuardianAlerts(request, "SOS", "SOS 요청", "님이 SOS를 요청했습니다.");
    }

    @PostMapping("/sos/cancel")
    public List<Alert> createSosCancelAlert(@RequestBody SosAlertRequest request) {
        return createGuardianAlerts(request, "SOS_CANCEL", "SOS 잘못 누름", "님이 SOS를 잘못 눌렀다고 알렸습니다.");
    }

    @PostMapping("/call")
    public List<Alert> createCallAlert(@RequestBody SosAlertRequest request) {
        return createGuardianAlerts(request, "CALL_REQUEST", "전화 요청", "님에게 보호자가 전화를 요청했습니다.");
    }
    @PostMapping("/safe-zone")
    public List<Alert> createSafeZoneAlert(@RequestBody SosAlertRequest request) {
        String address = request.address() == null || request.address().isBlank()
                ? "현재 위치 확인 필요"
                : request.address();
        return createGuardianAlerts(
                request,
                "SAFE_ZONE",
                "안전 구역 이탈",
                "님이 안전 구역을 벗어났습니다. 현재 위치: " + address
        );
    }

    @PostMapping("/info-update-request")
    public List<Alert> createInfoUpdateRequestAlert(@RequestBody InfoUpdateRequest request) {
        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        List<Alert> alerts = new ArrayList<>();

        boolean sendToSenior = request.toSenior() == null || request.toSenior();
        boolean sendToGuardian = request.toGuardian() == null || request.toGuardian();

        if (sendToSenior) {
            Alert seniorAlert = new Alert();
            seniorAlert.setSeniorId(request.seniorId());
            seniorAlert.setGuardianId(null);
            seniorAlert.setType("INFO_UPDATE_REQUEST");
            seniorAlert.setTitle("정보 입력 요청");
            seniorAlert.setMessage(buildInfoUpdateMessage(senior.getName(), request.missingFields()));
            seniorAlert.setIsRead(false);
            alerts.add(alertRepository.save(seniorAlert));
        }

        if (sendToGuardian) {
            List<GuardianSenior> guardianSeniors =
                    guardianSeniorRepository.findBySeniorId(request.seniorId());

            guardianSeniors.forEach(link -> {
                Alert guardianAlert = new Alert();
                guardianAlert.setSeniorId(request.seniorId());
                guardianAlert.setGuardianId(link.getGuardianId());
                guardianAlert.setType("INFO_UPDATE_REQUEST");
                guardianAlert.setTitle("보호 대상자 정보 입력 요청");
                guardianAlert.setMessage(buildGuardianInfoUpdateMessage(senior.getName(), request.missingFields()));
                guardianAlert.setIsRead(false);
                alerts.add(alertRepository.save(guardianAlert));
            });
        }

        return alerts;
    }

    private String buildInfoUpdateMessage(String seniorName, List<String> missingFields) {
        String fieldsText = missingFields == null || missingFields.isEmpty()
                ? "필수 정보"
                : String.join(", ", missingFields);

        return seniorName + "님의 " + fieldsText + " 입력이 필요합니다. 정보를 확인하고 입력해주세요.";
    }

    private String buildGuardianInfoUpdateMessage(String seniorName, List<String> missingFields) {
        String fieldsText = missingFields == null || missingFields.isEmpty()
                ? "필수 정보"
                : String.join(", ", missingFields);

        return "연결된 보호 대상자 " + seniorName + "님의 " + fieldsText + " 입력이 필요합니다.";
    }

    public record InfoUpdateRequest(
            Long seniorId,
            List<String> missingFields,
            Boolean toSenior,
            Boolean toGuardian
    ) {
    }

    @PostMapping("/welfare-consult-request")
    public List<Alert> createWelfareConsultRequest(@RequestBody WelfareConsultRequest request) {
        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        List<GuardianSenior> guardianSeniors =
                guardianSeniorRepository.findBySeniorId(request.seniorId());

        if (guardianSeniors.isEmpty()) {
            throw new RuntimeException("Connected guardian not found");
        }

        String message = request.message() == null || request.message().isBlank()
                ? senior.getName() + "님과 관련해 복지사 상담 확인이 필요합니다."
                : request.message().trim();

        return guardianSeniors.stream()
                .map(link -> {
                    Alert alert = new Alert();
                    alert.setSeniorId(request.seniorId());
                    alert.setGuardianId(link.getGuardianId());
                    alert.setType("WELFARE_CONSULT_REQUEST");
                    alert.setTitle("복지사 상담 요청");
                    alert.setMessage(message);
                    alert.setIsRead(false);

                    return alertRepository.save(alert);
                })
                .toList();
    }

    public record WelfareConsultRequest(
            Long seniorId,
            String message
    ) {
    }

    @PostMapping("/fall")
    public List<Alert> createFallAlert(@RequestBody FallAlertRequest request) {
        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        Alert latestFallAlert = alertRepository
                .findTopBySeniorIdAndTypeOrderByCreatedAtDesc(request.seniorId(), "FALL_DETECTED")
                .orElse(null);

        if (latestFallAlert != null
                && latestFallAlert.getIsRead() != null
                && !latestFallAlert.getIsRead()
                && latestFallAlert.getCreatedAt() != null
                && latestFallAlert.getCreatedAt().isAfter(java.time.LocalDateTime.now().minusMinutes(1))) {
            return List.of(latestFallAlert);
        }

        List<GuardianSenior> guardianSeniors =
                guardianSeniorRepository.findBySeniorId(request.seniorId());

        if (guardianSeniors.isEmpty()) {
            throw new RuntimeException("Connected guardian not found");
        }

        String address = request.address() == null || request.address().isBlank()
                ? "현재 위치 확인 필요"
                : request.address();
        String scoreText = request.score() == null ? "" : " 감지 점수: " + request.score() + "점.";

        return guardianSeniors.stream()
                .map(link -> {
                    Alert alert = new Alert();
                    alert.setSeniorId(request.seniorId());
                    alert.setGuardianId(link.getGuardianId());
                    alert.setType("FALL_DETECTED");
                    alert.setTitle("낙상 감지");
                    alert.setMessage(senior.getName() + "님의 낙상이 감지되었습니다. 현재 위치: " + address + "." + scoreText);
                    alert.setImageUrl(request.imageUrl());
                    alert.setLatitude(request.latitude());
                    alert.setLongitude(request.longitude());
                    alert.setIsRead(false);

                    return alertRepository.save(alert);
                })
                .toList();
    }

    private List<Alert> createGuardianAlerts(
            SosAlertRequest request,
            String type,
            String title,
            String messageSuffix
    ) {
        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        List<GuardianSenior> guardianSeniors =
                guardianSeniorRepository.findBySeniorId(request.seniorId());

        if (guardianSeniors.isEmpty()) {
            throw new RuntimeException("Connected guardian not found");
        }

        return guardianSeniors.stream()
                .map(link -> {
                    Alert alert = new Alert();
                    alert.setSeniorId(request.seniorId());
                    alert.setGuardianId(link.getGuardianId());
                    alert.setType(type);
                    alert.setTitle(title);
                    alert.setMessage(senior.getName() + messageSuffix);
                    alert.setLatitude(request.latitude());
                    alert.setLongitude(request.longitude());
                    alert.setIsRead(false);

                    return alertRepository.save(alert);
                })
                .toList();
    }

    @PostMapping("/medicine")
    public Alert createMedicineAlert(@RequestBody MedicineAlertRequest request) {
        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        Alert alert = new Alert();
        alert.setSeniorId(request.seniorId());
        alert.setGuardianId(null);
        alert.setType("MEDICINE");
        alert.setTitle("복약 알림");
        alert.setMessage(
                request.message() == null || request.message().isBlank()
                        ? senior.getName() + "님, 복용 중인 약을 확인하고 제때 복용해주세요."
                        : request.message()
        );
        alert.setIsRead(false);

        return alertRepository.save(alert);
    }

    @PostMapping("/check-in-message")
    public Alert createCheckInMessageAlert(@RequestBody CheckInMessageAlertRequest request) {
        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        Alert alert = new Alert();
        alert.setSeniorId(request.seniorId());
        alert.setGuardianId(null);
        alert.setType("CHECK_IN_MESSAGE");
        alert.setTitle("보호자 안부 메시지");
        alert.setMessage(
                request.message() == null || request.message().isBlank()
                        ? senior.getName() + "님, 오늘 컨디션은 어떠세요? 식사는 잘 챙기셨나요?"
                        : request.message().trim()
        );
        alert.setIsRead(false);

        return alertRepository.save(alert);
    }

    @PostMapping("/check-in-reply")
    public List<Alert> createCheckInReplyAlert(@RequestBody CheckInReplyRequest request) {
        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        List<GuardianSenior> guardianSeniors =
                guardianSeniorRepository.findBySeniorId(request.seniorId());

        if (guardianSeniors.isEmpty()) {
            throw new RuntimeException("Connected guardian not found");
        }

        String reply = request.reply() == null || request.reply().isBlank()
                ? "답변 없음"
                : request.reply().trim();

        return guardianSeniors.stream()
                .map(link -> {
                    Alert alert = new Alert();
                    alert.setSeniorId(request.seniorId());
                    alert.setGuardianId(link.getGuardianId());
                    alert.setType("CHECK_IN_REPLY");
                    alert.setTitle("안부 답변");
                    alert.setMessage(senior.getName() + "님이 안부 메시지에 '" + reply + "'라고 답했습니다.");
                    alert.setIsRead(false);

                    return alertRepository.save(alert);
                })
                .toList();
    }

    public record CheckInReplyRequest(
            Long seniorId,
            String reply,
            String originalMessage
    ) {
    }

    public record CheckInMessageAlertRequest(
            Long seniorId,
            Long guardianId,
            String message
    ) {
    }

    @PostMapping("/camera")
    public List<Alert> createCameraAlert(@RequestBody CameraAlertRequest request) {
        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        List<GuardianSenior> guardianSeniors =
                guardianSeniorRepository.findBySeniorId(request.seniorId());

        if (guardianSeniors.isEmpty()) {
            throw new RuntimeException("Connected guardian not found");
        }

        String title = switch (request.type()) {
            case "FACE_MATCH" -> "실종자 얼굴 감지";
            case "PERSON_DETECTED" -> "사람 감지";
            case "FALL_RISK" -> "낙상 의심";
            default -> "카메라 감지 알림";
        };

        return guardianSeniors.stream()
                .map(link -> {
                    Alert alert = new Alert();
                    alert.setSeniorId(request.seniorId());
                    alert.setGuardianId(link.getGuardianId());
                    alert.setType(request.type());
                    alert.setTitle(title);
                    alert.setMessage(senior.getName() + "님 관련 카메라 알림: " + request.message());
                    alert.setLatitude(request.latitude());
                    alert.setLongitude(request.longitude());
                    alert.setIsRead(false);

                    return alertRepository.save(alert);
                })
                .toList();
    }

    @DeleteMapping("/{id}")
    public void deleteAlert(@PathVariable Long id) {
        alertRepository.deleteById(id);
    }

    @DeleteMapping("/bulk-delete")
    public void deleteAlerts(@RequestBody Map<String, List<Long>> request) {
        List<Long> ids = request.getOrDefault("ids", List.of());
        alertRepository.deleteAllById(ids);
    }

    @DeleteMapping("/senior/{seniorId}/old-requests")
    public void deleteOldRequestAlerts(@PathVariable Long seniorId) {
        List<String> requestTypes = List.of(
                "PROFILE_UPDATE_REQUEST",
                "PROFILE_UPDATE",
                "JOB_RECOMMEND",
                "JOB_CONTACT_REQUEST",
                "WELFARE_REQUEST"
        );
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        List<Alert> oldAlerts = alertRepository
                .findBySeniorIdAndTypeInAndCreatedAtBefore(seniorId, requestTypes, cutoff);
        alertRepository.deleteAll(oldAlerts);
    }
    public record CameraAlertRequest(
            Long seniorId,
            String type,
            String message,
            Double latitude,
            Double longitude
    ) {
    }

    @PatchMapping("/{id}/read")
    public Alert readAlert(@PathVariable Long id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found"));

        alert.setIsRead(true);
        return alertRepository.save(alert);
    }

    @PatchMapping("/{id}/welfare-consult-response")
    public Alert respondWelfareConsultation(
            @PathVariable Long id,
            @RequestBody WelfareConsultResponse request
    ) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found"));

        alert.setIsRead(true);
        alert.setGuardianResponseType(request.responseType());
        alert.setGuardianScheduleAt(request.scheduleAt());
        alert.setGuardianRespondedAt(LocalDateTime.now());

        return alertRepository.save(alert);
    }

    public record WelfareConsultResponse(
            String responseType,
            String scheduleAt
    ) {
    }

    public record SosAlertRequest(
            Long seniorId,
            Double latitude,
            Double longitude,
            String address
    ) {
    }

    public record FallAlertRequest(
            Long seniorId,
            Double latitude,
            Double longitude,
            String address,
            Integer score,
            String imageUrl
    ) {
    }

    public record MedicineAlertRequest(
            Long seniorId,
            Long guardianId,
            String message
    ) {
    }

    @GetMapping("/welfare")
    public List<WelfareAlertResponse> getWelfareAlerts() {
        List<WelfareAlertResponse> sosAlerts = alertRepository
                .findByTypeAndIsReadFalseOrderByCreatedAtDesc("SOS")
                .stream()
                .map(alert -> {
                    Senior senior = seniorRepository.findById(alert.getSeniorId()).orElse(null);
                    String seniorName = senior == null ? "대상자" : senior.getName();

                    return new WelfareAlertResponse(
                            "sos-" + alert.getId(),
                            alert.getSeniorId(),
                            seniorName,
                            "SOS 요청 미응답",
                            seniorName + " 대상자의 SOS 요청에 보호자 응답이 없습니다.",
                            "SOS",
                            alert.getCreatedAt()
                    );
                })
                .toList();

        LocalDateTime threshold = LocalDateTime.now().minusHours(4);

        List<WelfareAlertResponse> inactiveAlerts = seniorRepository.findAll()
                .stream()
                .filter(senior -> senior.getLastLoginAt() != null)
                .filter(senior -> senior.getLastLoginAt().isBefore(threshold))
                .map(senior -> new WelfareAlertResponse(
                        "inactive-" + senior.getId(),
                        senior.getId(),
                        senior.getName(),
                        "장시간 미접속",
                        senior.getName() + " 대상자가 4시간 이상 접속하지 않았습니다.",
                        "LAST_ACCESS",
                        senior.getLastLoginAt()
                ))
                .toList();

        List<WelfareAlertResponse> responses = new ArrayList<>();
        responses.addAll(sosAlerts);
        responses.addAll(inactiveAlerts);

        return responses.stream()
                .sorted((first, second) -> second.createdAt().compareTo(first.createdAt()))
                .toList();
    }

    public record WelfareAlertResponse(
            String id,
            Long seniorId,
            String seniorName,
            String title,
            String message,
            String type,
            LocalDateTime createdAt
    ) {
    }
}

