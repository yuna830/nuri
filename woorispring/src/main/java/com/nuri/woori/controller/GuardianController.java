package com.nuri.woori.controller;

import com.nuri.woori.entity.Guardian;
import com.nuri.woori.entity.GuardianSenior;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.GuardianRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/guardians")
@CrossOrigin(origins = "*")
public class GuardianController {

    private final GuardianRepository guardianRepository;
    private final SeniorRepository seniorRepository;
    private final GuardianSeniorRepository guardianSeniorRepository;

    public GuardianController(GuardianRepository guardianRepository, SeniorRepository seniorRepository, GuardianSeniorRepository guardianSeniorRepository) {
        this.guardianRepository = guardianRepository;
        this.seniorRepository = seniorRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
    }

    @GetMapping
    public List<GuardianListResponse> getGuardians() {
        return guardianRepository.findAll().stream().map(this::toListResponse).toList();
    }

    @PostMapping("/signup")
    public GuardianResponse signup(@RequestBody GuardianSignupRequest request) {
        if (guardianRepository.findByEmail(request.email()).isPresent()) {
            throw new RuntimeException("Email already exists");
        }

        Guardian guardian = new Guardian();
        guardian.setName(request.name());
        guardian.setPhone(request.phone());
        guardian.setEmail(request.email());
        guardian.setPassword(hashPassword(request.password()));
        guardian.setActive(true);

        Guardian savedGuardian = guardianRepository.save(guardian);

        Senior senior = seniorRepository.findById(request.seniorId()).orElseThrow(() -> new RuntimeException("Senior not found"));

        GuardianSenior guardianSenior = new GuardianSenior();
        guardianSenior.setGuardianId(savedGuardian.getId());
        guardianSenior.setSeniorId(senior.getId());
        guardianSenior.setRelation(request.seniorRelation());
        guardianSeniorRepository.save(guardianSenior);

        return toResponse(savedGuardian);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody GuardianLoginRequest request) {
        Optional<Guardian> guardianOpt = guardianRepository.findByEmail(request.email());
        if (guardianOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "EMAIL_NOT_FOUND"));
        }

        Guardian guardian = guardianOpt.get();

        if (!guardian.getPassword().equals(hashPassword(request.password()))) {
            return ResponseEntity.status(401).body(Map.of("message", "PASSWORD_MISMATCH"));
        }

        if (Boolean.FALSE.equals(guardian.getActive())) {
            return ResponseEntity.status(403).body(Map.of("message", "INACTIVE_ACCOUNT"));
        }

        return ResponseEntity.ok(toResponse(guardian));
    }
    
    @PostMapping("/find-email")
    public ResponseEntity<FindEmailResponse> findEmail(@RequestBody FindEmailRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String phone = normalizePhone(request.phone());

        return guardianRepository.findByNameAndNormalizedPhone(name, phone)
                .map(guardian -> ResponseEntity.ok(new FindEmailResponse(maskEmail(guardian.getEmail()))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody ResetPasswordRequest request) {
        String email = request.email() == null ? "" : request.email().trim();
        String phone = normalizePhone(request.phone());
        String newPassword = request.newPassword() == null ? "" : request.newPassword().trim();

        if (newPassword.length() < 4) {
            return ResponseEntity.badRequest().build();
        }

        return guardianRepository.findByEmailAndNormalizedPhone(email, phone)
                .map(guardian -> {
                    guardian.setPassword(hashPassword(newPassword));
                    guardianRepository.save(guardian);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}")
    public GuardianResponse getGuardian(@PathVariable Long id) {
        Guardian guardian = guardianRepository.findById(id).orElseThrow(() -> new RuntimeException("Guardian not found"));
        return toResponse(guardian);
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<GuardianResponse> updateActive(@PathVariable Long id, @RequestBody ActiveRequest request) {
        return guardianRepository.findById(id)
                .map(guardian -> {
                    guardian.setActive(Boolean.TRUE.equals(request.active()));
                    Guardian savedGuardian = guardianRepository.save(guardian);
                    return ResponseEntity.ok(toResponse(savedGuardian));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/{guardianId}/seniors")
    public GuardianSenior connectSenior(@PathVariable Long guardianId, @RequestBody GuardianSeniorConnectRequest request) {
        guardianRepository.findById(guardianId).orElseThrow(() -> new RuntimeException("Guardian not found"));
        seniorRepository.findById(request.seniorId()).orElseThrow(() -> new RuntimeException("Senior not found"));

        if (guardianSeniorRepository.existsByGuardianIdAndSeniorId(guardianId, request.seniorId())) {
            throw new RuntimeException("Already connected senior");
        }

        GuardianSenior guardianSenior = new GuardianSenior();
        guardianSenior.setGuardianId(guardianId);
        guardianSenior.setSeniorId(request.seniorId());
        guardianSenior.setRelation(request.relation());

        return guardianSeniorRepository.save(guardianSenior);
    }

    @PostMapping("/{guardianId}/seniors/new")
    public GuardianSenior createAndConnectSenior(@PathVariable Long guardianId, @RequestBody GuardianSeniorCreateRequest request) {
        guardianRepository.findById(guardianId).orElseThrow(() -> new RuntimeException("Guardian not found"));

        Senior senior = new Senior();
        senior.setName(request.name());
        senior.setPhone(request.phone());
        senior.setAddress(request.region());
        senior.setRegion(request.region());
        senior.setActive(true);

        Senior savedSenior = seniorRepository.save(senior);

        GuardianSenior guardianSenior = new GuardianSenior();
        guardianSenior.setGuardianId(guardianId);
        guardianSenior.setSeniorId(savedSenior.getId());
        guardianSenior.setRelation(request.relation());

        return guardianSeniorRepository.save(guardianSenior);
    }

    @DeleteMapping("/{guardianId}/seniors/{seniorId}")
    public ResponseEntity<Void> disconnectSenior(@PathVariable Long guardianId, @PathVariable Long seniorId) {
        GuardianSenior guardianSenior = guardianSeniorRepository.findByGuardianIdAndSeniorId(guardianId, seniorId)
                .orElseThrow(() -> new RuntimeException("Connected senior not found"));
        guardianSeniorRepository.delete(guardianSenior);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{guardianId}/seniors/{seniorId}/relation")
    public ResponseEntity<GuardianSenior> updateSeniorRelation(
            @PathVariable Long guardianId,
            @PathVariable Long seniorId,
            @RequestBody GuardianSeniorRelationRequest request) {
        GuardianSenior guardianSenior = guardianSeniorRepository.findByGuardianIdAndSeniorId(guardianId, seniorId)
                .orElseThrow(() -> new RuntimeException("Connected senior not found"));

        guardianSenior.setRelation(request.relation());
        return ResponseEntity.ok(guardianSeniorRepository.save(guardianSenior));
    }

    private GuardianResponse toResponse(Guardian guardian) {
        return new GuardianResponse(guardian.getId(), guardian.getName(), guardian.getPhone(), guardian.getEmail(), !Boolean.FALSE.equals(guardian.getActive()));
    }

    private GuardianListResponse toListResponse(Guardian guardian) {
        List<GuardianSeniorSummaryResponse> seniors = guardianSeniorRepository.findByGuardianId(guardian.getId())
                .stream()
                .map(link -> seniorRepository.findById(link.getSeniorId())
                        .map(senior -> new GuardianSeniorSummaryResponse(senior.getId(), senior.getName(), senior.getPhone(), link.getRelation())))
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .toList();

        return new GuardianListResponse(guardian.getId(), guardian.getName(), guardian.getPhone(), guardian.getEmail(), !Boolean.FALSE.equals(guardian.getActive()), seniors);
    }

    private String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "";
        String[] parts = email.split("@", 2);
        String id = parts[0];
        String domain = parts[1];
        return id.length() <= 2 ? id.charAt(0) + "***@" + domain : id.substring(0, 2) + "***@" + domain;
    }

    private String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encoded = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (byte value : encoded) builder.append(String.format("%02x", value));
            return builder.toString();
        } catch (Exception error) {
            throw new RuntimeException("Password hashing failed");
        }
    }

    public record FindEmailRequest(String name, String phone) {}
    public record FindEmailResponse(String email) {}
    public record ResetPasswordRequest(String email, String phone, String newPassword) {}
    public record GuardianSeniorConnectRequest(Long seniorId, String relation) {}
    public record GuardianSeniorCreateRequest(String name, String phone, String region, String relation) {}
    public record GuardianSeniorRelationRequest(String relation) {}
    public record GuardianSignupRequest(String name, String phone, String email, String password, Long seniorId, String seniorRelation) {}
    public record GuardianLoginRequest(String email, String password) {}
    public record ActiveRequest(Boolean active) {}
    public record GuardianResponse(Long id, String name, String phone, String email, Boolean active) {}
    public record GuardianListResponse(Long id, String name, String phone, String email, Boolean active, List<GuardianSeniorSummaryResponse> seniors) {}
    public record GuardianSeniorSummaryResponse(Long id, String name, String phone, String relation) {}
}
