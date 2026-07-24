package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "wl_energy_support_consultation_requests",
        indexes = {
                @Index(
                        name = "idx_energy_consultation_senior",
                        columnList = "senior_id"
                ),
                @Index(
                        name = "idx_energy_consultation_worker",
                        columnList = "welfare_worker_id"
                ),
                @Index(
                        name = "idx_energy_consultation_status",
                        columnList = "status"
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnergySupportConsultationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(
            name = "senior_id",
            nullable = false
    )
    private Long seniorId;

    @Column(
            name = "guardian_id",
            nullable = false
    )
    private Long guardianId;

    @Column(
            name = "welfare_worker_id",
            nullable = false
    )
    private Long welfareWorkerId;

    @Column(
            name = "missing_count",
            nullable = false
    )
    private Integer missingCount;

    @Column(
            name = "missing_information",
            nullable = false,
            length = 4000
    )
    private String missingInformation;

    @Column(
            name = "request_message",
            length = 1000
    )
    private String requestMessage;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 30
    )
    @Builder.Default
    private ConsultationStatus status =
            ConsultationStatus.REQUESTED;

    @Column(
            name = "resolved_by"
    )
    private Long resolvedBy;

    @Column(
            name = "resolution_note",
            length = 1000
    )
    private String resolutionNote;

    @Column(
            name = "resolved_at"
    )
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(
            name = "updated_at",
            nullable = false
    )
    private LocalDateTime updatedAt;


    public enum ConsultationStatus {
        REQUESTED,
        IN_PROGRESS,
        RESOLVED,
        CANCELLED
    }
}