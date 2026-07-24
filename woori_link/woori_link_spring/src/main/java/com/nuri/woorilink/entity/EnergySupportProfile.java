package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "wl_energy_support_profiles",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_energy_support_profile_senior",
                columnNames = "senior_id"
        )
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnergySupportProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "senior_id", nullable = false)
    private Long seniorId;

    @Column(name = "basic_livelihood_recipient")
    private Boolean basicLivelihoodRecipient;

    @Column(name = "near_poverty")
    private Boolean nearPoverty;

    @Column(name = "disabled_household")
    private Boolean disabledHousehold;

    @Column(name = "national_merit_household")
    private Boolean nationalMeritHousehold;

    @Column(name = "senior_household")
    private Boolean seniorHousehold;

    @Column(name = "infant_household")
    private Boolean infantHousehold;

    @Column(name = "pregnant_household")
    private Boolean pregnantHousehold;

    @Column(name = "single_parent_household")
    private Boolean singleParentHousehold;

    @Column(name = "multi_child_household")
    private Boolean multiChildHousehold;

    @Column(name = "household_size")
    private Integer householdSize;

    @Column(name = "energy_voucher_recipient")
    private Boolean energyVoucherRecipient;

    @Column(name = "heating_energy_type", length = 50)
    private String heatingEnergyType;

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
}
