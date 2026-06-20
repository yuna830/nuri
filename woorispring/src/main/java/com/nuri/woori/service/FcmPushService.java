package com.nuri.woori.service;

import java.util.List;
import java.util.Map;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.nuri.woori.entity.PushToken;
import com.nuri.woori.repository.PushTokenRepository;
import org.springframework.stereotype.Service;

@Service
public class FcmPushService {
    private final PushTokenRepository pushTokenRepository;

    public FcmPushService(PushTokenRepository pushTokenRepository) {
        this.pushTokenRepository = pushTokenRepository;
    }

    public void sendToUser(String role, Long userId, String title, String body, String type) {
        sendToUser(role, userId, title, body, type, null, null);
    }

    public void sendToUser(String role, Long userId, String title, String body, String type, Map<String, String> data) {
        sendToUser(role, userId, title, body, type, data, null);
    }

    public void sendToUser(
            String role,
            Long userId,
            String title,
            String body,
            String type,
            Map<String, String> data,
            String collapseKey
    ) {
        if (userId == null) {
            System.err.println("[FCM] userId is null");
            return;
        }

        if (FirebaseApp.getApps().isEmpty()) {
            System.err.println("[FCM] FirebaseApp is not initialized");
            return;
        }

        List<PushToken> tokens = pushTokenRepository.findByRoleAndUserId(role, userId);
        if (tokens.isEmpty()) {
            System.err.println("[FCM] 토큰 없음 role=" + role + ", userId=" + userId);
            return;
        }
        tokens.forEach(token -> {
            try {
                Message.Builder builder = Message.builder()
                        .setToken(token.getToken())
                        .setNotification(Notification.builder()
                                .setTitle(title == null ? "우리 알림" : title)
                                .setBody(body == null ? "" : body)
                                .build())
                        .putData("type", type == null ? "" : type);

                if (data != null) {
                    data.forEach((key, value) -> {
                        if (key != null && value != null) {
                            builder.putData(key, value);
                        }
                    });
                }

                String messageId = FirebaseMessaging.getInstance().send(builder.build());
                System.out.println("[FCM] 발송 성공 role=" + role + ", userId=" + userId + ", messageId=" + messageId);
            } catch (Exception e) {
                System.err.println("[FCM] 발송 실패 role=" + role + ", userId=" + userId);
                e.printStackTrace();
            }
        });
    }
}
