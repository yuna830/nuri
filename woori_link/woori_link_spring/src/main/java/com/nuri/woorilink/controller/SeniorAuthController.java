package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.LoginResponse;
import com.nuri.woorilink.dto.SeniorLoginRequest;
import com.nuri.woorilink.dto.SeniorRegisterRequest;
import com.nuri.woorilink.service.SeniorAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/senior-auth")
@RequiredArgsConstructor
public class SeniorAuthController {

    private final SeniorAuthService seniorAuthService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody SeniorLoginRequest request) {
        return ResponseEntity.ok(seniorAuthService.login(request));
    }

    @PostMapping("/register")
    public ResponseEntity<Void> register(@RequestBody SeniorRegisterRequest request) {
        seniorAuthService.register(request);
        return ResponseEntity.ok().build();
    }
}
