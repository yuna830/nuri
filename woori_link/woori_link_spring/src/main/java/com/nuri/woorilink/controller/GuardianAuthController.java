package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.GuardianLoginRequest;
import com.nuri.woorilink.dto.GuardianRegisterRequest;
import com.nuri.woorilink.dto.GuardianPasswordResetRequest;
import com.nuri.woorilink.dto.LoginResponse;
import com.nuri.woorilink.service.GuardianAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/guardian-auth")
@RequiredArgsConstructor
public class GuardianAuthController {

    private final GuardianAuthService guardianAuthService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody GuardianLoginRequest request,
                                               HttpServletResponse response) {
        LoginResponse result = guardianAuthService.login(request);
        response.addCookie(buildCookie("access_token", result.getToken(), 60 * 60 * 24 * 7));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        response.addCookie(buildCookie("access_token", "", 0));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/register")
    public ResponseEntity<Void> register(@RequestBody GuardianRegisterRequest request) {
        guardianAuthService.register(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody GuardianPasswordResetRequest request) {
        guardianAuthService.resetPassword(request);
        return ResponseEntity.ok().build();
    }

    private Cookie buildCookie(String name, String value, int maxAge) {
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        return cookie;
    }
}
