package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

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
    private String barcode;
    private String certificationNumber;
    private LocalDate manufacturingDate;
    private String serialNumber;
    private String lotNumber;

    @Enumerated(EnumType.STRING)
    private RecallDecisionStatus recallDecisionStatus;
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private RecallCheckStatus recallCheckStatus = RecallCheckStatus.NOT_CHECKED;
    private Long matchedRecallNoticeId;
    @Column(columnDefinition = "text") private String recallDecisionReason;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default private List<String> recallMatchedFields = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default private List<String> recallMissingFields = new ArrayList<>();
    private LocalDateTime lastSuccessfulCheckedAt;
    private LocalDateTime lastCheckFailedAt;
    private String lastCheckErrorCode;
    @Column(columnDefinition = "text") private String lastCheckErrorMessage;

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

    private String kcStatus;
    private String kcCertNum;
    private String kcCertState;
    private String kcCertOrganName;
    private String kcCertProductName;
    private String kcCertModelName;
    private String kcCertManufacturer;

    private LocalDateTime lastCheckedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum RecallStatus {
        UNKNOWN, SAFE, RECALLED
    }
    public enum RecallDecisionStatus { RECALL_CONFIRMED, NO_MATCH_FOUND, REVIEW_REQUIRED }
    public enum RecallCheckStatus { SUCCESS, FAILED, NOT_CHECKED }

    public enum CurrentUseStatus { UNKNOWN, IN_USE, NOT_IN_USE, STOPPED, DISPOSED, NOT_OWNED }
    public enum ModelMatchStatus { UNKNOWN, MATCHED, NEEDS_REVIEW, NOT_MATCHED }
    public enum GuardianContactStatus { UNKNOWN, SCHEDULED, COMPLETED, UNREACHABLE }
    public enum FollowUpProgressStatus { PLANNED, IN_PROGRESS, COMPLETED, ON_HOLD, UNREACHABLE, DECLINED }
    public enum FinalResult { USE_STOPPED, RECOVERED, EXCHANGED, REPAIRED, REFUNDED, NOT_OWNED, NOT_RECALLED, UNREACHABLE, DECLINED }
}
