package com.nuri.woori.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "guardian_seniors")
public class GuardianSenior {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long guardianId;
    private Long seniorId;
    private String relation;
    private LocalDateTime connectedAt = LocalDateTime.now();
}
