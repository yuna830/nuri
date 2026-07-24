package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "wl_energy_voucher_details",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_energy_voucher_detail_senior",
                columnNames = "senior_id"
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnergyVoucherDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "senior_id", nullable = false)
    private Long seniorId;

    @Column(name = "income_criteria_confirmed")
    private Boolean incomeCriteriaConfirmed;

    @Column(name = "livelihood_benefit_types", length = 500)
    private String livelihoodBenefitTypes;

    @Column(name = "household_characteristic_confirmed")
    private Boolean householdCharacteristicConfirmed;

    @Column(name = "household_characteristics", length = 1000)
    private String householdCharacteristics;

    @Column(name = "winter_other_energy_support_recipient")
    private Boolean winterOtherEnergySupportRecipient;

    @Column(name = "other_energy_support_types", length = 1000)
    private String otherEnergySupportTypes;

    @Column(name = "duplicate_support_disqualifying")
    private Boolean duplicateSupportDisqualifying;

    @Column(name = "application_year")
    private Integer applicationYear;

    @Enumerated(EnumType.STRING)
    @Column(name = "application_result", length = 30)
    private ApplicationResult applicationResult;

    @Column(name = "confirmation_note", length = 2000)
    private String confirmationNote;

    @Enumerated(EnumType.STRING)
    @Column(name = "updated_by_role", length = 30)
    private GasDiscountDetail.UpdatedByRole updatedByRole;

    @Column(name = "updated_by_id")
    private Long updatedById;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum ApplicationResult {
        UNKNOWN,
        PENDING,
        APPROVED,
        REJECTED
    }
}
