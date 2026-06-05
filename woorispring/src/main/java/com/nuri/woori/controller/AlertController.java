package com.nuri.woori.controller;

import com.nuri.woori.entity.Alert;
import com.nuri.woori.entity.GuardianSenior;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.service.FcmPushService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/alerts")
@CrossOrigin(origins = "*")
public class AlertController {

    private final AlertRepository alertRepository;
    private final GuardianSeniorRepository guardianSeniorRepository;
    private final SeniorRepository seniorRepository;
    private final FcmPushService fcmPushService;

    public AlertController(
            AlertRepository alertRepository,
            GuardianSeniorRepository guardianSeniorRepository,
            SeniorRepository seniorRepository,
            FcmPushService fcmPushService
    ) {
        this.alertRepository = alertRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
        this.seniorRepository = seniorRepository;
        this.fcmPushService = fcmPushService;
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
        Senior senior = findSenior(request.seniorId());

        Long guardianId = guardianSeniorRepository.findBySeniorId(request.seniorId())
                .stream()
                .findFirst()
                .map(GuardianSenior::getGuardianId)
                .orElse(null);

        Alert alert = new Alert();
        alert.setSeniorId(request.seniorId());
        alert.setGuardianId(guardianId);
        alert.setType("CALL_REQUEST");
        alert.setTitle("전화 요청");
        alert.setMessage("보호 대상자 " + senior.getName() + "님이 전화를 요청했습니다.");
        alert.setLatitude(request.latitude());
        alert.setLongitude(request.longitude());
        alert.setIsRead(false);

        return List.of(saveAndPushToGuardian(alert));
    }

    @PostMapping("/safe-zone")
    public List<Alert> createSafeZoneAlert(@RequestBody SosAlertRequest request) {
        String address = request.address() == null || request.address().isBlank()
                ? "현재 위치 확인 필요"
                : request.address();
        return createGuardianAlerts(
                request,
                "SAFE_ZONE_EXIT",
                "안전구역 이탈",
                "님이 안전구역을 벗어났습니다. 현재 위치: " + address
        );
    }

    @PostMapping("/info-update-request")
    public List<Alert> createInfoUpdateRequestAlert(@RequestBody InfoUpdateRequest request) {
        Senior senior = findSenior(request.seniorId());
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
            alerts.add(saveAndPushToSenior(seniorAlert));
        }

        if (sendToGuardian) {
            guardianSeniorRepository.findBySeniorId(request.seniorId()).forEach(link -> {
                Alert guardianAlert = new Alert();
                guardianAlert.setSeniorId(request.seniorId());
                guardianAlert.setGuardianId(link.getGuardianId());
                guardianAlert.setType("INFO_UPDATE_REQUEST");
                guardianAlert.setTitle("보호 대상자 정보 입력 요청");
                guardianAlert.setMessage(buildGuardianInfoUpdateMessage(senior.getName(), request.missingFields()));
                guardianAlert.setIsRead(false);
                alerts.add(saveAndPushToGuardian(guardianAlert));
            });
        }

        return alerts;
    }

    @PostMapping("/consent-request")
    public Alert createConsentRequestAlert(@RequestBody ConsentRequest request) {
        findSenior(request.seniorId());

        if (!guardianSeniorRepository.existsByGuardianIdAndSeniorId(request.guardianId(), request.seniorId())) {
            throw new RuntimeException("Guardian is not connected to senior");
        }

        String guardianName = request.guardianName() == null || request.guardianName().isBlank()
                ? "보호자"
                : request.guardianName().trim();
        String requestedItems = request.items() == null || request.items().isEmpty()
                ? "필요한 정보 제공 항목"
                : String.join(", ", request.items());

        Alert alert = new Alert();
        alert.setSeniorId(request.seniorId());
        alert.setGuardianId(request.guardianId());
        alert.setType("CONSENT_REQUEST");
        alert.setTitle("정보 제공 동의 요청");
        alert.setMessage(guardianName + " 보호자가 다음 항목에 대한 동의를 요청했습니다: " + requestedItems);
        alert.setIsRead(false);

        return saveAndPushToSenior(alert);
    }

    @PostMapping("/welfare-consult-request")
    public List<Alert> createWelfareConsultRequest(@RequestBody WelfareConsultRequest request) {
        Senior senior = findSenior(request.seniorId());
        List<GuardianSenior> guardianSeniors = guardianSeniorRepository.findBySeniorId(request.seniorId());

        if (guardianSeniors.isEmpty()) {
            throw new RuntimeException("Connected guardian not found");
        }

        String message = request.message() == null || request.message().isBlank()
                ? senior.getName() + "님과 관련해 복지 상담 확인이 필요합니다."
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
                    return saveAndPushToGuardian(alert);
                })
                .toList();
    }

    @PostMapping("/fall")
    public List<Alert> createFallAlert(@RequestBody FallAlertRequest request) {
        Senior senior = findSenior(request.seniorId());

        Alert latestFallAlert = alertRepository
                .findTopBySeniorIdAndTypeOrderByCreatedAtDesc(request.seniorId(), "FALL_DETECTED")
                .orElse(null);

        if (latestFallAlert != null
                && latestFallAlert.getIsRead() != null
                && !latestFallAlert.getIsRead()
                && latestFallAlert.getCreatedAt() != null
                && latestFallAlert.getCreatedAt().isAfter(LocalDateTime.now().minusMinutes(1))) {
            return List.of(latestFallAlert);
        }

        List<GuardianSenior> guardianSeniors = guardianSeniorRepository.findBySeniorId(request.seniorId());
        String address = request.address() == null || request.address().isBlank()
                ? "현재 위치 확인 필요"
                : request.address();
        String scoreText = request.score() == null ? "" : " 감지 점수: " + request.score();

        if (guardianSeniors.isEmpty()) {
            Alert alert = buildFallAlert(request, senior, null, address, scoreText);
            return List.of(alertRepository.save(alert));
        }

        return guardianSeniors.stream()
                .map(link -> {
                    Alert alert = buildFallAlert(request, senior, link.getGuardianId(), address, scoreText);
                    return saveAndPushToGuardian(alert);
                })
                .toList();
    }

    @PostMapping("/medicine")
    public Alert createMedicineAlert(@RequestBody MedicineAlertRequest request) {
        Senior senior = findSenior(request.seniorId());

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

        return saveAndPushToSenior(alert);
    }

    @PostMapping("/check-in-message")
    public Alert createCheckInMessageAlert(@RequestBody CheckInMessageAlertRequest request) {
        Senior senior = findSenior(request.seniorId());

        Alert alert = new Alert();
        alert.setSeniorId(request.seniorId());
        alert.setGuardianId(request.guardianId());
        alert.setType("CHECK_IN_MESSAGE");
        alert.setTitle("보호자 안부 메시지");
        alert.setMessage(
                request.message() == null || request.message().isBlank()
                        ? senior.getName() + "님, 오늘 컨디션은 어떠신가요?"
                        : request.message().trim()
        );
        alert.setIsRead(false);

        return saveAndPushToSenior(alert);
    }

    @PostMapping("/camera")
    public List<Alert> createCameraAlert(@RequestBody CameraAlertRequest request) {
        Senior senior = findSenior(request.seniorId());
        List<GuardianSenior> guardianSeniors = guardianSeniorRepository.findBySeniorId(request.seniorId());

        if (guardianSeniors.isEmpty()) {
            throw new RuntimeException("Connected guardian not found");
        }

        String title = switch (request.type()) {
            case "FACE_MATCH" -> "얼굴 감지";
            case "PERSON_DETECTED" -> "사람 감지";
            case "FALL_RISK" -> "낙상 위험";
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
                    return saveAndPushToGuardian(alert);
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

    @GetMapping("/welfare")
    public List<WelfareAlertResponse> getWelfareAlerts(
            @RequestParam(required = false) Long welfareWorkerId
    ) {
        List<WelfareAlertResponse> fallAlerts = alertRepository
                .findByTypeAndIsReadFalseOrderByCreatedAtDesc("FALL_DETECTED")
                .stream()
                .map(alert -> toWelfareResponse(alert, "fall-", "낙상 감지 알림", "FALL_DETECTED"))
                .toList();

        List<WelfareAlertResponse> sosAlerts = alertRepository
                .findByTypeAndIsReadFalseOrderByCreatedAtDesc("SOS")
                .stream()
                .map(alert -> toWelfareResponse(alert, "sos-", "SOS 요청 미응답", "SOS"))
                .toList();

        LocalDateTime checkInOkCutoff = LocalDateTime.now().minusDays(7);
        List<WelfareAlertResponse> checkInOkAlerts = alertRepository
                .findByTypeAndCreatedAtAfterOrderByCreatedAtDesc("CHECK_IN_OK", checkInOkCutoff)
                .stream()
                .map(alert -> toWelfareResponse(alert, "check-in-ok-", "안부 확인 완료", "CHECK_IN_OK"))
                .toList();

        LocalDateTime threshold = LocalDateTime.now().minusHours(4);
        List<Senior> inactiveAlertTargets = welfareWorkerId == null
                ? seniorRepository.findAll()
                : seniorRepository.findByWelfareWorkerIdOrderByIdAsc(welfareWorkerId);

        List<WelfareAlertResponse> inactiveAlerts = inactiveAlertTargets
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
                        senior.getLastLoginAt(),
                        null,
                        false
                ))
                .toList();

        List<WelfareAlertResponse> responses = new ArrayList<>();
        responses.addAll(fallAlerts);
        responses.addAll(sosAlerts);
        responses.addAll(checkInOkAlerts);
        responses.addAll(inactiveAlerts);

        return responses.stream()
                .sorted((first, second) -> second.createdAt().compareTo(first.createdAt()))
                .toList();
    }

    @PostMapping("/guardian-check-in-request")
    public List<Alert> createGuardianCheckInRequest(@RequestBody GuardianCheckInRequest request) {
        Senior senior = findSenior(request.seniorId());
        List<GuardianSenior> guardianLinks = guardianSeniorRepository.findBySeniorId(request.seniorId());

        if (guardianLinks.isEmpty()) {
            throw new RuntimeException("Connected guardian not found");
        }

        List<Alert> existingRequests = alertRepository
                .findBySeniorIdAndTypeAndIsReadFalseOrderByCreatedAtDesc(
                        request.seniorId(),
                        "CHECK_IN_REQUEST"
                );

        if (!existingRequests.isEmpty()) {
            return existingRequests;
        }

        String message = request.message() == null || request.message().isBlank()
                ? senior.getName() + "님이 4시간 이상 접속하지 않았습니다. 안부 확인 후 복지사에게 알려주세요."
                : request.message().trim();

        return guardianLinks.stream()
                .map(link -> {
                    Alert alert = new Alert();
                    alert.setSeniorId(request.seniorId());
                    alert.setGuardianId(link.getGuardianId());
                    alert.setType("CHECK_IN_REQUEST");
                    alert.setTitle("안부 확인 요청");
                    alert.setMessage(message);
                    alert.setIsRead(false);
                    return saveAndPushToGuardian(alert);
                })
                .toList();
    }

    @PostMapping("/check-in-reply")
    public Alert createCheckInReply(@RequestBody CheckInReplyRequest request) {
        Senior senior = findSenior(request.seniorId());

        LocalDateTime now = LocalDateTime.now();
        senior.setLastLoginAt(now);
        seniorRepository.save(senior);

        List<Alert> pendingRequests = alertRepository
                .findBySeniorIdAndTypeAndIsReadFalseOrderByCreatedAtDesc(request.seniorId(), "CHECK_IN_REQUEST");

        pendingRequests.forEach(requestAlert -> requestAlert.setIsRead(true));
        alertRepository.saveAll(pendingRequests);

        String reply = request.reply() == null || request.reply().isBlank()
                ? senior.getName() + " 대상자가 안부를 확인했으며 이상 없습니다."
                : request.reply().trim();

        Alert alert = new Alert();
        alert.setSeniorId(request.seniorId());
        alert.setGuardianId(request.guardianId());
        alert.setType("CHECK_IN_OK");
        alert.setTitle("안부 확인 완료");
        alert.setMessage(reply);
        alert.setIsRead(false);

        return saveAndPushToGuardian(alert);
    }

    private Senior findSenior(Long seniorId) {
        return seniorRepository.findById(seniorId)
                .orElseThrow(() -> new RuntimeException("Senior not found"));
    }

    private Alert saveAndPushToSenior(Alert alert) {
        Alert savedAlert = alertRepository.save(alert);
        fcmPushService.sendToUser(
                "SENIOR",
                savedAlert.getSeniorId(),
                savedAlert.getTitle(),
                savedAlert.getMessage(),
                savedAlert.getType()
        );
        return savedAlert;
    }

    private Alert saveAndPushToGuardian(Alert alert) {
        Alert savedAlert = alertRepository.save(alert);
        if (savedAlert.getGuardianId() != null) {
            fcmPushService.sendToUser(
                    "GUARDIAN",
                    savedAlert.getGuardianId(),
                    savedAlert.getTitle(),
                    savedAlert.getMessage(),
                    savedAlert.getType()
            );
        }
        return savedAlert;
    }

    private Alert buildFallAlert(
            FallAlertRequest request,
            Senior senior,
            Long guardianId,
            String address,
            String scoreText
    ) {
        String imageUrl = request.imageAccessUrl();
        if (imageUrl == null || imageUrl.isBlank()) {
            imageUrl = request.imageUrl();
        }

        Alert alert = new Alert();
        alert.setSeniorId(request.seniorId());
        alert.setGuardianId(guardianId);
        alert.setType("FALL_DETECTED");
        alert.setTitle("낙상 감지");
        alert.setMessage(senior.getName() + "님의 낙상이 감지되었습니다. 현재 위치: " + address + "." + scoreText);
        alert.setImageUrl(imageUrl);
        alert.setLatitude(request.latitude());
        alert.setLongitude(request.longitude());
        alert.setIsRead(false);
        return alert;
    }

    private List<Alert> createGuardianAlerts(
            SosAlertRequest request,
            String type,
            String title,
            String messageSuffix
    ) {
        Senior senior = findSenior(request.seniorId());
        List<GuardianSenior> guardianSeniors = guardianSeniorRepository.findBySeniorId(request.seniorId());

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
                    return saveAndPushToGuardian(alert);
                })
                .toList();
    }

    private WelfareAlertResponse toWelfareResponse(Alert alert, String idPrefix, String fallbackTitle, String type) {
        Senior senior = seniorRepository.findById(alert.getSeniorId()).orElse(null);
        String seniorName = senior == null ? "대상자" : senior.getName();
        String message = alert.getMessage() == null || alert.getMessage().isBlank()
                ? seniorName + " 대상자 알림 확인이 필요합니다."
                : alert.getMessage();

        return new WelfareAlertResponse(
                idPrefix + alert.getId(),
                alert.getSeniorId(),
                seniorName,
                alert.getTitle() == null || alert.getTitle().isBlank() ? fallbackTitle : alert.getTitle(),
                message,
                type,
                alert.getCreatedAt(),
                alert.getImageUrl(),
                alert.getIsRead()
        );
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

    public record ConsentRequest(
            Long guardianId,
            Long seniorId,
            String guardianName,
            List<String> items
    ) {
    }

    public record WelfareConsultRequest(
            Long seniorId,
            String message
    ) {
    }

    public record CheckInMessageAlertRequest(
            Long seniorId,
            Long guardianId,
            String message
    ) {
    }

    public record CameraAlertRequest(
            Long seniorId,
            String type,
            String message,
            Double latitude,
            Double longitude
    ) {
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
            String imageUrl,
            String imageAccessUrl,
            Object fallDetails,
            Boolean notifyGuardian,
            Boolean notifyWelfare,
            Boolean escalationRequired,
            String escalationMessage
    ) {
    }

    public record MedicineAlertRequest(
            Long seniorId,
            Long guardianId,
            String message
    ) {
    }

    public record GuardianCheckInRequest(
            Long seniorId,
            String message
    ) {
    }

    public record CheckInReplyRequest(
            Long seniorId,
            Long guardianId,
            String reply,
            String originalMessage
    ) {
    }

    public record WelfareAlertResponse(
            String id,
            Long seniorId,
            String seniorName,
            String title,
            String message,
            String type,
            LocalDateTime createdAt,
            String imageUrl,
            Boolean isRead
    ) {
    }
}
