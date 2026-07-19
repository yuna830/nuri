package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "wl_action_records")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ActionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private Long welfareWorkerId;

    @Enumerated(EnumType.STRING)
    private ActionType actionType;

    @Enumerated(EnumType.STRING)
    private ActionSubject actionSubject;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_status", nullable = false)
    @Builder.Default
    private ActionStatus status = ActionStatus.PENDING;

    @Column(length = 1000)
    private String note;

    private String productName;
    private LocalDate dueDate;

    @Builder.Default
    private Boolean immediateRisk = false;

    @Enumerated(EnumType.STRING)
    private FallEnvironmentRisk fallEnvironmentRisk;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Transient
    private String seniorName;

    @Transient
    private Integer seniorAge;

    public enum ActionType {
        SOS, RECALL, VOUCHER, GAS_CHECK, ELECTRIC_CHECK, FIRE_CHECK, HEATING_CHECK, FALL_CHECK, VISIT, OTHER
    }

    public enum ActionSubject {
        SENIOR, WELFARE_WORKER, GUARDIAN, SYSTEM
    }

    public enum ActionStatus {
        PENDING, IN_PROGRESS, COMPLETED, CANCELLED
    }

    public enum FallEnvironmentRisk {
        GOOD, CAUTION, DANGER, UNCHECKED
    }
}
