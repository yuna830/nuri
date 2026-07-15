package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "wl_energy_support_cases", uniqueConstraints =
        @UniqueConstraint(columnNames = {"senior_id", "support_type"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class EnergySupportCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "senior_id", nullable = false)
    private Long seniorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "support_type", nullable = false)
    private SupportType supportType;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private SupportStatus status = SupportStatus.CONFIRMATION_NEEDED;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ExistingApplicationStatus existingApplicationStatus = ExistingApplicationStatus.UNKNOWN;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ApplicationIntent applicationIntent = ApplicationIntent.UNKNOWN;

    @Enumerated(EnumType.STRING)
    private DeclineReason declineReason;

    private String contactMethod;
    private LocalDate nextActionDate;

    @Column(length = 1000)
    private String note;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum SupportType { VOUCHER, ELECTRICITY }

    public enum EligibilityLevel { HIGH, CONFIRMATION_NEEDED, LOW }

    public enum ExistingApplicationStatus { UNKNOWN, NOT_APPLIED, ALREADY_APPLIED }

    public enum ApplicationIntent { UNKNOWN, WANTS_TO_APPLY, DOES_NOT_WANT, DISCUSS_WITH_GUARDIAN, DECIDE_LATER }

    public enum DeclineReason { SELF_DECLINED, FAMILY_DISCUSSION_REQUIRED, USING_OTHER_SUPPORT, OTHER }

    public enum SupportStatus {
        CONFIRMATION_NEEDED,
        CONTACT_SCHEDULED,
        CONSULTED,
        DOCUMENTS_PREPARING,
        APPLICATION_SUPPORTING,
        APPLICATION_COMPLETED,
        RESULT_CONFIRMED,
        ALREADY_APPLIED,
        NOT_ELIGIBLE,
        DECLINED,
        UNREACHABLE,
        ON_HOLD
    }
}
