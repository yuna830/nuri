package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_senior_locations")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SeniorLocation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long seniorId;
    @Column(nullable = false) private Double latitude;
    @Column(nullable = false) private Double longitude;
    @Column(nullable = false) private Boolean outsideSafetyZone;
    @CreationTimestamp private LocalDateTime recordedAt;
}
