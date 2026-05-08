package com.nuri.woori.controller;

import com.nuri.woori.entity.Guardian;
import com.nuri.woori.entity.GuardianSenior;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.GuardianRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.SeniorRepository;
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

        Senior senior = new Senior();
        senior.setName(request.seniorName());
        senior.setAddress(request.seniorAddress());
        senior.setRegion(request.seniorAddress());

        Senior savedSenior = seniorRepository.save(senior);

        GuardianSenior guardianSenior = new GuardianSenior();
        guardianSenior.setGuardianId(savedGuardian.getId());
        guardianSenior.setSeniorId(savedSenior.getId());
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
            String seniorName,
            String seniorAddress,
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
