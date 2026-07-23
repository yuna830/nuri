package com.nuri.woorilink.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_guardians")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Guardian {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @JsonIgnore
    private String password;

    private String phone;

    private String relationship;
    private String email;
    private String address;

    @Column(nullable = false, unique = true, length = 8)
    private String inviteCode;
    private LocalDateTime inviteCodeExpiresAt;

    @Builder.Default private Boolean checkInAlertEnabled = true;
    @Builder.Default private Boolean fallAlertEnabled = true;
    @Builder.Default private Boolean safetyZoneAlertEnabled = true;
    @Builder.Default private Boolean recallAlertEnabled = true;
    @Builder.Default private Boolean weatherAlertEnabled = true;
    @Builder.Default private Boolean welfareAlertEnabled = false;
    @Builder.Default private Boolean appNotificationEnabled = true;
    @Builder.Default private Boolean webNotificationEnabled = true;
    @Builder.Default private Boolean kakaoNotificationEnabled = false;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
