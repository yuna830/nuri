package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "wl_energy_support_activities")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EnergySupportActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long caseId;
    private Long seniorId;

    @Enumerated(EnumType.STRING)
    private EnergySupportCase.SupportType supportType;

    @Enumerated(EnumType.STRING)
    private EnergySupportCase.SupportStatus status;

    private String contactMethod;
    private LocalDate nextActionDate;

    @Column(length = 1000)
    private String note;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
