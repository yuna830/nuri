package com.nuri.woori.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "job_preference")
public class JobPreference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private String payType;

    @Column(columnDefinition = "TEXT")
    private String hopeDays;

    @Column(columnDefinition = "TEXT")
    private String hopeJobType;

    @Column(columnDefinition = "TEXT")
    private String hopeCondition;

    @Column(columnDefinition = "TEXT")
    private String memo;

    private LocalDateTime createdAt = LocalDateTime.now();
}
