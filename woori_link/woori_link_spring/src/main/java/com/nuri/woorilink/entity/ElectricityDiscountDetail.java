package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "wl_electricity_discount_details",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_electricity_discount_detail_senior",
                columnNames = "senior_id"
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElectricityDiscountDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "senior_id", nullable = false)
    private Long seniorId;

    @Column(name = "uses_electricity")
    private Boolean usesElectricity;

    @Column(name = "electricity_provider", length = 100)
    private String electricityProvider;

    @Column(name = "customer_number", length = 100)
    private String customerNumber;

    @Column(name = "contractor_name", length = 100)
    private String contractorName;

    @Column(name = "address_same")
    private Boolean addressSame;

    @Column(name = "service_address", length = 255)
    private String serviceAddress;

    @Column(name = "recent_bill_checked")
    private Boolean recentBillChecked;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_discount_status", length = 30)
    private ExistingDiscountStatus currentDiscountStatus;

    @Column(name = "welfare_eligible")
    private Boolean welfareEligible;

    @Column(length = 1000)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "updated_by_role")
    private GasDiscountDetail.UpdatedByRole updatedByRole;

    @Column(name = "updated_by_id")
    private Long updatedById;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum ExistingDiscountStatus {
        UNKNOWN,
        NOT_RECEIVING,
        RECEIVING
    }
}
