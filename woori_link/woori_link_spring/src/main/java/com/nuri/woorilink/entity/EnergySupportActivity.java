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

    @Enumerated(EnumType.STRING)
    private EnergySupportCase.ExistingApplicationStatus existingApplicationStatus;

    @Enumerated(EnumType.STRING)
    private EnergySupportCase.ApplicationIntent applicationIntent;

    @Enumerated(EnumType.STRING)
    private EnergySupportCase.DeclineReason declineReason;

    private String contactMethod;
    private LocalDate nextActionDate;

    @Column(length = 1000)
    private String note;

    @Column(length = 30)
    private String updatedByRole;

    private Long updatedById;

    @Column(length = 2000)
    private String changeSummary;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
