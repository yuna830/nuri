package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "wl_care_alerts")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CareAlert {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long seniorId;
    private Long guardianId;
    private Long careEventId;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private CareEvent.EventType type;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Severity severity;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private AlertStatus status;
    @Column(nullable = false) private String title;
    @Column(nullable = false, length = 1000) private String message;
    @Column(length = 2000) private String imageUrl;
    private Integer detectionScore;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> fallDetails = Map.of();
    @CreationTimestamp private LocalDateTime createdAt;
    private LocalDateTime acknowledgedAt;
    private LocalDateTime lastReminderAt;
    @Builder.Default private Integer reminderCount = 0;

    public enum Severity { HIGH, MEDIUM }
    public enum AlertStatus { UNREAD, ACKNOWLEDGED, RESOLVED }
}
