package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_care_events")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CareEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long seniorId;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private EventType type;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private EventStatus status;
    private Double latitude;
    private Double longitude;
    @Column(length = 1000) private String note;
    private LocalDateTime occurredAt;
    @CreationTimestamp private LocalDateTime createdAt;

    public enum EventType { FALL_DETECTED, SOS, SAFETY_RADIUS_EXIT, CHECK_IN_MISSED }
    public enum EventStatus { PENDING, CONFIRMED, CANCELLED, RESOLVED }
}
