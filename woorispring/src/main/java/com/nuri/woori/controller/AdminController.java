package com.nuri.woori.controller;

import com.nuri.woori.entity.Admin;
import com.nuri.woori.repository.AdminRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/admins")
@CrossOrigin(origins = "*")
public class AdminController {

    private static final int ITERATIONS = 120_000;
    private static final int KEY_LENGTH = 256;
    private static final int SALT_LENGTH = 16;
    private static final String HASH_PREFIX = "pbkdf2";
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final AdminRepository adminRepository;

    public AdminController(AdminRepository adminRepository) {
        this.adminRepository = adminRepository;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminResponse signup(@RequestBody AdminSignupRequest request) {
        String name = requireText(request.name(), "Name");
        String phone = requireText(request.phone(), "Phone");
        String email = normalizeEmail(request.email());
        String password = requirePassword(request.password());

        if (adminRepository.findByEmailIgnoreCase(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        Admin admin = new Admin();
        admin.setName(name);
        admin.setPhone(phone);
        admin.setEmail(email);
        admin.setPassword(hashPassword(password));
        admin.setStatus("PENDING");

        return toResponse(adminRepository.save(admin));
    }

    @PostMapping("/login")
    public AdminResponse login(@RequestBody AdminLoginRequest request) {
        String email = normalizeEmail(request.email());
        String password = requireText(request.password(), "Password");

        Admin admin = adminRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!matchesPassword(password, admin.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        if ("REJECTED".equals(admin.getStatus())) {
            throw new ResponseStatusException(HttpStatus.LOCKED, "Admin account was rejected");
        }

        if (!"APPROVED".equals(admin.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin account is not approved");
        }

        return toResponse(admin);
    }

    @GetMapping
    public List<AdminResponse> getAdmins(@RequestHeader("X-Admin-Id") Long requesterId) {
        requireApprovedAdmin(requesterId);
        return adminRepository.findAll().stream().map(this::toResponse).toList();
    }

    @PatchMapping("/{id}/status")
    public AdminResponse updateStatus(
            @RequestHeader("X-Admin-Id") Long requesterId,
            @PathVariable Long id,
            @RequestBody AdminStatusRequest request) {
        requireApprovedAdmin(requesterId);

        String status = requireText(request.status(), "Status").toUpperCase();
        if (!Set.of("APPROVED", "REJECTED").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid admin status");
        }
        if (requesterId.equals(id) && !"APPROVED".equals(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot reject your own admin account");
        }

        Admin admin = adminRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));
        admin.setStatus(status);
        return toResponse(adminRepository.save(admin));
    }

    private void requireApprovedAdmin(Long id) {
        Admin admin = adminRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Approved admin required"));

        if (!"APPROVED".equals(admin.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Approved admin required");
        }
    }

    private AdminResponse toResponse(Admin admin) {
        return new AdminResponse(admin.getId(), admin.getName(), admin.getPhone(), admin.getEmail(), admin.getStatus());
    }

    private String normalizeEmail(String email) {
        String normalized = requireText(email, "Email").toLowerCase();
        if (!normalized.contains("@")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid email");
        }
        return normalized;
    }

    private String requirePassword(String password) {
        String value = requireText(password, "Password");
        if (value.length() < 8) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must contain at least 8 characters");
        }
        return value;
    }

    private String requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " is required");
        }
        return value.trim();
    }

    private String hashPassword(String password) {
        byte[] salt = new byte[SALT_LENGTH];
        SECURE_RANDOM.nextBytes(salt);
        byte[] hash = derivePassword(password, salt, ITERATIONS);
        return String.join("$", HASH_PREFIX, String.valueOf(ITERATIONS),
                Base64.getEncoder().encodeToString(salt),
                Base64.getEncoder().encodeToString(hash));
    }

    private boolean matchesPassword(String password, String encodedPassword) {
        if (encodedPassword == null) return false;

        String[] parts = encodedPassword.split("\\$");
        if (parts.length != 4 || !HASH_PREFIX.equals(parts[0])) return false;

        try {
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expectedHash = Base64.getDecoder().decode(parts[3]);
            byte[] actualHash = derivePassword(password, salt, iterations);
            return MessageDigest.isEqual(expectedHash, actualHash);
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    private byte[] derivePassword(String password, byte[] salt, int iterations) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, iterations, KEY_LENGTH);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (Exception error) {
            throw new IllegalStateException("Password hashing failed", error);
        }
    }

    public record AdminSignupRequest(String name, String phone, String email, String password) {}
    public record AdminLoginRequest(String email, String password) {}
    public record AdminStatusRequest(String status) {}
    public record AdminResponse(Long id, String name, String phone, String email, String status) {}
}
