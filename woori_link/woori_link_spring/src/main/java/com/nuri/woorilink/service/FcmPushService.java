package com.nuri.woorilink.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.*;
import com.nuri.woorilink.entity.PushToken;
import com.nuri.woorilink.repository.PushTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
@RequiredArgsConstructor
public class FcmPushService {
    private final PushTokenRepository repository;

    public PushToken register(String role, Long userId, String token) {
        PushToken value = repository.findByToken(token).orElseGet(PushToken::new);
        value.setRole(role); value.setUserId(userId); value.setToken(token);
        return repository.save(value);
    }

    public SendResult sendToSenior(Long seniorId, String title, String body, Map<String, String> data) {
        if (FirebaseApp.getApps().isEmpty()) throw new IllegalStateException("Firebase service account is not configured.");
        List<PushToken> tokens = repository.findByRoleAndUserId("SENIOR", seniorId);
        if (tokens.isEmpty()) throw new NoSuchElementException("The senior app has no registered push token.");
        int success = 0;
        for (PushToken token : tokens) {
            try {
                Message.Builder message = Message.builder().setToken(token.getToken())
                        .setNotification(Notification.builder().setTitle(title).setBody(body).build())
                        .putAllData(data);
                FirebaseMessaging.getInstance().send(message.build());
                success++;
            } catch (FirebaseMessagingException ignored) { }
        }
        if (success == 0) {
            throw new IllegalStateException("앱 알림 발송에 실패했습니다.");
        }
        return new SendResult(success, tokens.size() - success);
    }

    public record SendResult(int successCount, int failureCount) { }
}
