package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "wl_visit_schedules")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class VisitSchedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private Long welfareWorkerId;

    private LocalDate visitDate;
    private String visitTime;

    @Column(length = 200)
    private String purpose;

    @Column(length = 500)
    private String note;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private VisitStatus status = VisitStatus.PLANNED;

    @CreationTimestamp
    private LocalDateTime createdAt;

    public enum VisitStatus { PLANNED, COMPLETED, CANCELLED }
}
