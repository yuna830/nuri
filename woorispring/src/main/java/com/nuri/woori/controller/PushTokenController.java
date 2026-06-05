package com.nuri.woori.controller;

import com.nuri.woori.entity.PushToken;
import com.nuri.woori.repository.PushTokenRepository;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/push-tokens")
@CrossOrigin(origins = "*")
public class PushTokenController {
    private final PushTokenRepository repository;

    public PushTokenController(PushTokenRepository repository) {
        this.repository = repository;
    }

    @PostMapping
    public PushToken save(@RequestBody PushTokenRequest request) {
        PushToken token = repository.findByToken(request.token())
                .orElseGet(PushToken::new);

        token.setRole(request.role());
        token.setUserId(request.userId());
        token.setToken(request.token());
        token.setUpdatedAt(LocalDateTime.now());

        return repository.save(token);
    }

    public record PushTokenRequest(
            String role,
            Long userId,
            String token
    ) {
    }
}