package com.nuri.woori.controller;

import com.nuri.woori.entity.Alert;
import com.nuri.woori.entity.GuardianSenior;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
        return createGuardianAlerts(request, "SOS", "SOS 도움 요청", "님이 SOS 도움을 요청했습니다.");
    }

    @PostMapping("/sos/cancel")
    public List<Alert> createSosCancelAlert(@RequestBody SosAlertRequest request) {
        return createGuardianAlerts(request, "SOS_CANCEL", "SOS 잘못 누름", "님이 SOS를 잘못 눌렀다고 알렸습니다.");
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
        alert.setGuardianId(request.guardianId());
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

    @PatchMapping("/{id}/read")
    public Alert readAlert(@PathVariable Long id) {
        Alert alert = alertRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Alert not found"));

        alert.setIsRead(true);
        return alertRepository.save(alert);
    }

    public record SosAlertRequest(
            Long seniorId,
            Double latitude,
            Double longitude
    ) {
    }

    public record MedicineAlertRequest(
            Long seniorId,
            Long guardianId,
            String message
    ) {
    }
}
