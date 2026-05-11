package com.nuri.woori.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "climate_alerts",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_climate_alert_senior_event", columnNames = {"senior_id", "event_id"})
        }
)
public class ClimateAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "senior_id")
    private Long seniorId;

    @Column(name = "event_id")
    private String eventId;

    private String type;
    private String level;

    @Column(length = 1000)
    private String message;

    private String region;
    private String source;
    private LocalDate alertDate = LocalDate.now();
    private LocalDateTime issuedAt = LocalDateTime.now();
    private LocalDateTime createdAt = LocalDateTime.now();
}
