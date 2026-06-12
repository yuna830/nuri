package com.nuri.woori.service;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.nuri.woori.repository.PushTokenRepository;
import org.springframework.stereotype.Service;

@Service
public class FcmPushService {
    private final PushTokenRepository pushTokenRepository;

    public FcmPushService(PushTokenRepository pushTokenRepository) {
        this.pushTokenRepository = pushTokenRepository;
    }

    public void sendToUser(String role, Long userId, String title, String body, String type) {
        if (userId == null || FirebaseApp.getApps().isEmpty()) {
            return;
        }

        pushTokenRepository.findByRoleAndUserId(role, userId).forEach(token -> {
            try {
                Message message = Message.builder()
                        .setToken(token.getToken())
                        .setNotification(Notification.builder()
                                .setTitle(title == null ? "우리 알림" : title)
                                .setBody(body == null ? "" : body)
                                .build())
                        .putData("type", type == null ? "" : type)
                        .build();

                // 동기 send()는 토큰 수만큼 구글 서버 왕복을 기다려 API 응답을 지연시킨다.
                FirebaseMessaging.getInstance().sendAsync(message);
            } catch (Exception ignored) {
            }
        });
    }
}
