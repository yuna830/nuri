package com.nuri.woori.service;

import java.util.Map;
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
        sendToUser(role, userId, title, body, type, null);
    }

    public void sendToUser(
            String role,
            Long userId,
            String title,
            String body,
            String type,
            Map<String, String> data
    ) {
        if (userId == null) {
            System.err.println("[FCM] userId is null");
            return;
        }

        if (FirebaseApp.getApps().isEmpty()) {
            System.err.println("[FCM] FirebaseApp is not initialized");
            return;
        }

        pushTokenRepository.findByRoleAndUserId(role, userId).forEach(token -> {
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

                FirebaseMessaging.getInstance().sendAsync(builder.build());
            } catch (Exception e) {
                System.err.println("[FCM] send failed role=" + role + ", userId=" + userId);
                e.printStackTrace();
            }
        });
    }
}
