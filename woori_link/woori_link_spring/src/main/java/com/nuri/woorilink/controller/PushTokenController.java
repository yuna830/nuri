package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.service.FcmPushService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/push-tokens")
@RequiredArgsConstructor
public class PushTokenController {
    private final FcmPushService service;
    @PostMapping
    public void register(@AuthenticationPrincipal AuthenticatedUser user, @RequestBody TokenRequest request) {
        if (user == null || request.token() == null || request.token().isBlank()) throw new IllegalArgumentException("Authentication and token are required.");
        service.register(user.getRole(), user.getUserId(), request.token());
    }
    public record TokenRequest(String token) { }
}
