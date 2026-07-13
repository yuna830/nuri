package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "wl_safety_zones", uniqueConstraints = @UniqueConstraint(columnNames = "seniorId"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class SafetyZone {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long seniorId;
    @Column(nullable = false) private Double latitude;
    @Column(nullable = false) private Double longitude;
    @Column(nullable = false) private Integer radiusMeters;
    @Column(nullable = false) private Boolean enabled;
}
