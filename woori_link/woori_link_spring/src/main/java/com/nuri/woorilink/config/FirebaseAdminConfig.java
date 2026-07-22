package com.nuri.woorilink.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;

@Configuration
public class FirebaseAdminConfig {
    @Value("${firebase.service-account-path:}")
    private String serviceAccountPath;

    @PostConstruct
    void initialize() throws Exception {
        if (serviceAccountPath == null || serviceAccountPath.isBlank() || !FirebaseApp.getApps().isEmpty()) return;
        try (FileInputStream input = new FileInputStream(serviceAccountPath)) {
            FirebaseApp.initializeApp(FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(input))
                    .build());
        }
    }
}
