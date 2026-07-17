package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.time.LocalDate;

@Entity
@Table(name = "wl_registered_products")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RegisteredProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;

    @Column(nullable = false)
    private String productName;
    private String productType;

    private String manufacturer;
    private String modelNumber;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private RecallStatus recallStatus = RecallStatus.UNKNOWN;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private CurrentUseStatus currentUseStatus = CurrentUseStatus.UNKNOWN;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ModelMatchStatus modelMatchStatus = ModelMatchStatus.UNKNOWN;

    private String contactMethod;

    @Builder.Default
    private Boolean stopGuidanceCompleted = false;
    private LocalDateTime stopGuidanceCompletedAt;
    private String stopGuidanceMethod;
    private String stopGuidanceTarget;
    private Long stopGuidanceWorkerId;

    @Column(length = 1000)
    private String stopGuidanceMemo;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private GuardianContactStatus guardianContactStatus = GuardianContactStatus.UNKNOWN;

    private String followUpType;
    private LocalDate nextActionDate;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private FollowUpProgressStatus followUpProgressStatus = FollowUpProgressStatus.PLANNED;

    @Column(length = 1000)
    private String note;

    @Enumerated(EnumType.STRING)
    private FinalResult finalResult;

    @Column(length = 1000)
    private String recallReason;

    private LocalDateTime lastCheckedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum RecallStatus {
        UNKNOWN, SAFE, RECALLED
    }

    public enum CurrentUseStatus { UNKNOWN, IN_USE, NOT_IN_USE, STOPPED, DISPOSED, NOT_OWNED }
    public enum ModelMatchStatus { UNKNOWN, MATCHED, NEEDS_REVIEW, NOT_MATCHED }
    public enum GuardianContactStatus { UNKNOWN, SCHEDULED, COMPLETED, UNREACHABLE }
    public enum FollowUpProgressStatus { PLANNED, IN_PROGRESS, COMPLETED, ON_HOLD, UNREACHABLE, DECLINED }
    public enum FinalResult { USE_STOPPED, RECOVERED, EXCHANGED, REPAIRED, REFUNDED, NOT_OWNED, NOT_RECALLED, UNREACHABLE, DECLINED }
}
