package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergySupportProfile;
import com.nuri.woorilink.entity.GasDiscountDetail;
import lombok.Builder;

import java.time.LocalDateTime;

@Builder
public record EnergySupportProfileDto(
        Long seniorId,
        Boolean basicLivelihoodRecipient,
        Boolean nearPoverty,
        Boolean disabledHousehold,
        Boolean nationalMeritHousehold,
        Boolean seniorHousehold,
        Boolean infantHousehold,
        Boolean pregnantHousehold,
        Boolean singleParentHousehold,
        Boolean multiChildHousehold,
        Integer householdSize,
        Boolean energyVoucherRecipient,
        String heatingEnergyType,
        GasDiscountDetail.UpdatedByRole updatedByRole,
        Long updatedById,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static EnergySupportProfileDto from(EnergySupportProfile profile) {
        return EnergySupportProfileDto.builder()
                .seniorId(profile.getSeniorId())
                .basicLivelihoodRecipient(profile.getBasicLivelihoodRecipient())
                .nearPoverty(profile.getNearPoverty())
                .disabledHousehold(profile.getDisabledHousehold())
                .nationalMeritHousehold(profile.getNationalMeritHousehold())
                .seniorHousehold(profile.getSeniorHousehold())
                .infantHousehold(profile.getInfantHousehold())
                .pregnantHousehold(profile.getPregnantHousehold())
                .singleParentHousehold(profile.getSingleParentHousehold())
                .multiChildHousehold(profile.getMultiChildHousehold())
                .householdSize(profile.getHouseholdSize())
                .energyVoucherRecipient(profile.getEnergyVoucherRecipient())
                .heatingEnergyType(profile.getHeatingEnergyType())
                .updatedByRole(profile.getUpdatedByRole())
                .updatedById(profile.getUpdatedById())
                .createdAt(profile.getCreatedAt())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }
}
