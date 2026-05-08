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

    private LocalDateTime createdAt = LocalDateTime.now();
}
