package com.nuri.woori.controller;

import com.nuri.woori.entity.WelfareWorker;
import com.nuri.woori.repository.WelfareWorkerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@RestController
@RequestMapping("/api/welfare-workers")
@CrossOrigin(origins = "*")
public class WelfareWorkerController {

    private final WelfareWorkerRepository welfareWorkerRepository;

    public WelfareWorkerController(WelfareWorkerRepository welfareWorkerRepository) {
        this.welfareWorkerRepository = welfareWorkerRepository;
    }

    @PostMapping("/signup")
    public ResponseEntity<WelfareWorkerResponse> signup(@RequestBody WelfareWorkerSignupRequest request) {
        String workerId = trim(request.workerId());
        String password = trim(request.password());

        if (welfareWorkerRepository.existsByWorkerId(workerId)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        }

        WelfareWorker worker = new WelfareWorker();
        worker.setWorkerId(workerId);
        worker.setName(trim(request.name()));
        worker.setPassword(hashPassword(password));
        worker.setCenter(trim(request.center()));
        worker.setRole(request.role() == null || request.role().isBlank() ? "복지사" : request.role().trim());

        WelfareWorker savedWorker = welfareWorkerRepository.save(worker);

        return ResponseEntity.ok(toResponse(savedWorker));
    }

    @PostMapping("/login")
    public ResponseEntity<WelfareWorkerResponse> login(@RequestBody WelfareWorkerLoginRequest request) {
        String workerId = trim(request.workerId());
        String password = trim(request.password());

        return welfareWorkerRepository.findByWorkerId(workerId)
                .filter(worker -> worker.getPassword().equals(hashPassword(password)))
                .map(worker -> ResponseEntity.ok(toResponse(worker)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).build());
    }

    @PostMapping("/find-id")
    public ResponseEntity<FindWorkerIdResponse> findWorkerId(@RequestBody FindWorkerIdRequest request) {
        String name = trim(request.name());
        String center = trim(request.center());

        return welfareWorkerRepository.findByNameAndCenter(name, center)
                .map(worker -> ResponseEntity.ok(new FindWorkerIdResponse(worker.getWorkerId())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody ResetWelfarePasswordRequest request) {
        String workerId = trim(request.workerId());
        String name = trim(request.name());
        String newPassword = trim(request.newPassword());

        if (newPassword.length() < 4) {
            return ResponseEntity.badRequest().build();
        }

        return welfareWorkerRepository.findByWorkerIdAndName(workerId, name)
                .map(worker -> {
                    worker.setPassword(hashPassword(newPassword));
                    welfareWorkerRepository.save(worker);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private WelfareWorkerResponse toResponse(WelfareWorker worker) {
        return new WelfareWorkerResponse(
                worker.getId(),
                worker.getWorkerId(),
                worker.getName(),
                worker.getRole(),
                worker.getCenter()
        );
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
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

    public record WelfareWorkerSignupRequest(
            String name,
            String workerId,
            String password,
            String center,
            String role
    ) {
    }

    public record WelfareWorkerLoginRequest(
            String workerId,
            String password
    ) {
    }

    public record FindWorkerIdRequest(
            String name,
            String center
    ) {
    }

    public record FindWorkerIdResponse(
            String workerId
    ) {
    }

    public record ResetWelfarePasswordRequest(
            String workerId,
            String name,
            String newPassword
    ) {
    }

    public record WelfareWorkerResponse(
            Long id,
            String workerId,
            String name,
            String role,
            String center
    ) {
    }
}
