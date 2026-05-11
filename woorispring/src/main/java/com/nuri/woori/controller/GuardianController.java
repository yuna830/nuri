package com.nuri.woori.controller;

import com.nuri.woori.entity.Guardian;
import com.nuri.woori.entity.GuardianSenior;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.GuardianRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api/guardians")
@CrossOrigin(origins = "*")
public class GuardianController {

    private final GuardianRepository guardianRepository;
    private final SeniorRepository seniorRepository;
    private final GuardianSeniorRepository guardianSeniorRepository;

    public GuardianController(
            GuardianRepository guardianRepository,
            SeniorRepository seniorRepository,
            GuardianSeniorRepository guardianSeniorRepository
    ) {
        this.guardianRepository = guardianRepository;
        this.seniorRepository = seniorRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
    }

    @PostMapping("/signup")
    public GuardianResponse signup(@RequestBody GuardianSignupRequest request) {
        if (guardianRepository.findByEmail(request.email()).isPresent()) {
            throw new RuntimeException("이미 가입된 이메일입니다.");
        }

        Guardian guardian = new Guardian();
        guardian.setName(request.name());
        guardian.setPhone(request.phone());
        guardian.setEmail(request.email());
        guardian.setPassword(hashPassword(request.password()));

        Guardian savedGuardian = guardianRepository.save(guardian);

        Senior senior = seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        GuardianSenior guardianSenior = new GuardianSenior();
        guardianSenior.setGuardianId(savedGuardian.getId());
        guardianSenior.setSeniorId(senior.getId());
        guardianSenior.setRelation(request.seniorRelation());

        guardianSeniorRepository.save(guardianSenior);

        return new GuardianResponse(
                savedGuardian.getId(),
                savedGuardian.getName(),
                savedGuardian.getPhone(),
                savedGuardian.getEmail()
        );
    }

    @PostMapping("/login")
    public GuardianResponse login(@RequestBody GuardianLoginRequest request) {
        Guardian guardian = guardianRepository.findByEmail(request.email())
                .orElseThrow(() -> new RuntimeException("가입된 보호자가 없습니다."));

        if (!guardian.getPassword().equals(hashPassword(request.password()))) {
            throw new RuntimeException("비밀번호가 일치하지 않습니다.");
        }

        return new GuardianResponse(
                guardian.getId(),
                guardian.getName(),
                guardian.getPhone(),
                guardian.getEmail()
        );
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

    private String normalizePhone(String phone) {
        if (phone == null) {
            return "";
        }

        return phone.replaceAll("[^0-9]", "");
    }

    private String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return "";
        }

        String[] parts = email.split("@", 2);
        String id = parts[0];
        String domain = parts[1];

        if (id.length() <= 2) {
            return id.charAt(0) + "***@" + domain;
        }

        return id.substring(0, 2) + "***@" + domain;
    }

    public record FindEmailRequest(
            String name,
            String phone
    ) {
    }

    public record FindEmailResponse(
            String email
    ) {
    }

    public record ResetPasswordRequest(
            String email,
            String phone,
            String newPassword
    ) {
    }

    @GetMapping("/{id}")
    public GuardianResponse getGuardian(@PathVariable Long id) {
        Guardian guardian = guardianRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Guardian not found"));

        return new GuardianResponse(
                guardian.getId(),
                guardian.getName(),
                guardian.getPhone(),
                guardian.getEmail()
        );
    }

    @PostMapping("/{guardianId}/seniors")
    public GuardianSenior connectSenior(
            @PathVariable Long guardianId,
            @RequestBody GuardianSeniorConnectRequest request
    ) {
        guardianRepository.findById(guardianId)
                .orElseThrow(() -> new RuntimeException("Guardian not found"));

        seniorRepository.findById(request.seniorId())
                .orElseThrow(() -> new RuntimeException("Senior not found"));

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
    public GuardianSenior createAndConnectSenior(
            @PathVariable Long guardianId,
            @RequestBody GuardianSeniorCreateRequest request
    ) {
        guardianRepository.findById(guardianId)
                .orElseThrow(() -> new RuntimeException("Guardian not found"));

        Senior senior = new Senior();
        senior.setName(request.name());
        senior.setPhone(request.phone());
        senior.setAddress(request.region());
        senior.setRegion(request.region());

        Senior savedSenior = seniorRepository.save(senior);

        GuardianSenior guardianSenior = new GuardianSenior();
        guardianSenior.setGuardianId(guardianId);
        guardianSenior.setSeniorId(savedSenior.getId());
        guardianSenior.setRelation(request.relation());

        return guardianSeniorRepository.save(guardianSenior);
    }

    @DeleteMapping("/{guardianId}/seniors/{seniorId}")
    public ResponseEntity<Void> disconnectSenior(
            @PathVariable Long guardianId,
            @PathVariable Long seniorId
    ) {
        GuardianSenior guardianSenior = guardianSeniorRepository
                .findByGuardianIdAndSeniorId(guardianId, seniorId)
                .orElseThrow(() -> new RuntimeException("Connected senior not found"));

        guardianSeniorRepository.delete(guardianSenior);

        return ResponseEntity.noContent().build();
    }

    public record GuardianSeniorConnectRequest(
            Long seniorId,
            String relation
    ) {
    }

    public record GuardianSeniorCreateRequest(
            String name,
            String phone,
            String region,
            String relation
    ) {
    }

    private String hashPassword(String password) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] encoded = digest.digest(password.getBytes(StandardCharsets.UTF_8));

            StringBuilder builder = new StringBuilder();
            for (byte value : encoded) {
                builder.append(String.format("%02x", value));
            }

            return builder.toString();
        } catch (Exception error) {
            throw new RuntimeException("비밀번호 암호화 실패");
        }
    }

    public record GuardianSignupRequest(
            String name,
            String phone,
            String email,
            String password,
            Long seniorId,
            String seniorRelation
    ) {
    }

    public record GuardianLoginRequest(
            String email,
            String password
    ) {
    }

    public record GuardianResponse(
            Long id,
            String name,
            String phone,
            String email
    ) {
    }
}
