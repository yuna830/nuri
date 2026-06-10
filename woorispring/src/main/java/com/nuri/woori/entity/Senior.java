package com.nuri.woori.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "seniors")
public class Senior {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private LocalDate birthDate;
    private Integer age;
    private String gender;
    private String phone;
    private String address;
    private String region;
    private String emergencyPhone;
    private String disabilityGrade;
    private String disabilityType;
    @Column(columnDefinition = "TEXT")
    private String profileImageUrl;
    private Boolean active = true;
    private Long welfareWorkerId;

    private LocalDateTime lastLoginAt;
    private LocalDateTime createdAt = LocalDateTime.now();

    private String workRequestStatus;
    private String welfareDecision;

    @Column(length = 1000)
    private String welfareDecisionReason;

    private String fallApiUrl;
    private String guardianName;
    private String guardianPhone;
    private String guardianRelation;

    /** 어르신 본인이 신고한 보호자 유무. null/true = 있음(기본), false = 없음 */
    private Boolean hasGuardian;

    public LocalDateTime getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(LocalDateTime lastLoginAt) {
        this.lastLoginAt = lastLoginAt;
    }
}

