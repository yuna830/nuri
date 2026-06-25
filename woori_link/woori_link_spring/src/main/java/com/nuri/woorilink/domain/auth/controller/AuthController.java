package com.nuri.woorilink.domain.auth.controller;

import com.nuri.woorilink.domain.auth.dto.LoginRequest;
import com.nuri.woorilink.domain.auth.dto.LoginResponse;
import com.nuri.woorilink.domain.auth.dto.RegisterRequest;
import com.nuri.woorilink.domain.auth.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request,
                                               HttpServletResponse response) {
        LoginResponse result = authService.login(request);
        response.addCookie(buildCookie("access_token", result.getToken(), 60 * 60 * 24 * 7));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        response.addCookie(buildCookie("access_token", "", 0));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/register/welfare-worker")
    public ResponseEntity<Void> registerWelfareWorker(@RequestBody RegisterRequest request) {
        authService.registerWelfareWorker(request);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/register/guardian")
    public ResponseEntity<Void> registerGuardian(@RequestBody RegisterRequest request) {
        authService.registerGuardian(request);
        return ResponseEntity.ok().build();
    }

    private Cookie buildCookie(String name, String value, int maxAge) {
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(maxAge);
        // cookie.setSecure(true); // HTTPS 환경에서 활성화
        return cookie;
    }
}
