package com.nuri.woori.controller;

import com.nuri.woori.entity.WelfareWorker;
import com.nuri.woori.repository.WelfareWorkerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

@RestController
@RequestMapping("/api/welfare-workers")
@CrossOrigin(origins = "*")
public class WelfareWorkerController {

    private final WelfareWorkerRepository welfareWorkerRepository;

    public WelfareWorkerController(WelfareWorkerRepository welfareWorkerRepository) {
        this.welfareWorkerRepository = welfareWorkerRepository;
    }

    @GetMapping
    public List<WelfareWorkerResponse> getWorkers() {
        return welfareWorkerRepository.findAll()
                .stream()
                .map(this::toResponse)
                .toList();
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
        worker.setRole(request.role() == null || request.role().isBlank() ? "welfare" : request.role().trim());
        worker.setRegion(trim(request.region()));
        worker.setPhone(trim(request.phone()));
        worker.setEmail(trim(request.email()));
        worker.setActive(true);

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

    @PatchMapping("/{id}")
    public ResponseEntity<WelfareWorkerResponse> updateProfile(
            @PathVariable Long id,
            @RequestBody WelfareWorkerUpdateRequest request
    ) {
        String name = trim(request.name());
        String center = trim(request.center());

        if (name.isBlank() || center.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        return welfareWorkerRepository.findById(id)
                .map(worker -> {
                    worker.setName(name);
                    worker.setCenter(center);
                    worker.setRegion(trim(request.region()));
                    worker.setPhone(trim(request.phone()));
                    worker.setEmail(trim(request.email()));
                    WelfareWorker savedWorker = welfareWorkerRepository.save(worker);
                    return ResponseEntity.ok(toResponse(savedWorker));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<WelfareWorkerResponse> updateActive(
            @PathVariable Long id,
            @RequestBody ActiveRequest request
    ) {
        return welfareWorkerRepository.findById(id)
                .map(worker -> {
                    worker.setActive(Boolean.TRUE.equals(request.active()));
                    WelfareWorker savedWorker = welfareWorkerRepository.save(worker);
                    return ResponseEntity.ok(toResponse(savedWorker));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWorker(@PathVariable Long id) {
        if (!welfareWorkerRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        welfareWorkerRepository.deleteById(id);

        return ResponseEntity.noContent().build();
    }

    private WelfareWorkerResponse toResponse(WelfareWorker worker) {
        return new WelfareWorkerResponse(
                worker.getId(),
                worker.getWorkerId(),
                worker.getName(),
                worker.getRole(),
                worker.getCenter(),
                worker.getRegion(),
                worker.getPhone(),
                worker.getEmail(),
                !Boolean.FALSE.equals(worker.getActive())
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
            throw new RuntimeException("Password hashing failed");
        }
    }

    public record WelfareWorkerSignupRequest(String name, String workerId, String password, String center, String role, String region, String phone, String email) {}
    public record WelfareWorkerLoginRequest(String workerId, String password) {}
    public record FindWorkerIdRequest(String name, String center) {}
    public record FindWorkerIdResponse(String workerId) {}
    public record ResetWelfarePasswordRequest(String workerId, String name, String newPassword) {}
    public record WelfareWorkerUpdateRequest(String name, String center, String region, String phone, String email) {}
    public record ActiveRequest(Boolean active) {}
    public record WelfareWorkerResponse(Long id, String workerId, String name, String role, String center, String region, String phone, String email, Boolean active) {}
}
