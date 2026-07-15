package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.LoginResponse;
import com.nuri.woorilink.dto.WelfareLoginRequest;
import com.nuri.woorilink.dto.WelfareLoginIdFindRequest;
import com.nuri.woorilink.dto.WelfarePasswordResetRequest;
import com.nuri.woorilink.dto.WelfareWorkerRegisterRequest;
import com.nuri.woorilink.service.WelfareAuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/welfare-auth")
@RequiredArgsConstructor
public class WelfareAuthController {

    private final WelfareAuthService welfareAuthService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody WelfareLoginRequest request,
                                               HttpServletResponse response) {
        LoginResponse result = welfareAuthService.login(request);
        response.addCookie(buildCookie("access_token", result.getToken(), 60 * 60 * 24 * 7));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        response.addCookie(buildCookie("access_token", "", 0));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/register")
    public ResponseEntity<Void> register(@RequestBody WelfareWorkerRegisterRequest request) {
        welfareAuthService.register(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/check-loginid")
    public ResponseEntity<?> checkLoginId(@RequestParam String loginId) {
        if (!welfareAuthService.isLoginIdAvailable(loginId)) {
            return ResponseEntity.badRequest().body(Map.of("message", "이미 사용 중인 아이디입니다."));
        }
        return ResponseEntity.ok(Map.of("available", true));
    }

    @PostMapping("/find-loginid")
    public ResponseEntity<?> findLoginId(@RequestBody WelfareLoginIdFindRequest request) {
        return ResponseEntity.ok(Map.of("loginId", welfareAuthService.findLoginId(request)));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(@RequestBody WelfarePasswordResetRequest request) {
        welfareAuthService.resetPassword(request);
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
