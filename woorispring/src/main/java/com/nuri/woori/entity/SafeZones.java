package com.nuri.woori.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "safe_zones")
public class SafeZones {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "senior_id")
    private Long seniorId;

    private String name;

    private String address;

    @Column(name = "center_latitude")
    private Double centerLatitude;

    @Column(name = "center_longitude")
    private Double centerLongitude;

    @Column(name = "radius_meters")
    private Integer radiusMeters;
}
