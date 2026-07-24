package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.GasDiscountDetail;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class EnergySupportProfileRequest {
    private Boolean basicLivelihoodRecipient;
    private Boolean nearPoverty;
    private Boolean disabledHousehold;
    private Boolean nationalMeritHousehold;
    private Boolean seniorHousehold;
    private Boolean infantHousehold;
    private Boolean pregnantHousehold;
    private Boolean singleParentHousehold;
    private Boolean multiChildHousehold;
    private Integer householdSize;
    private Boolean energyVoucherRecipient;
    private String heatingEnergyType;
    private GasDiscountDetail.UpdatedByRole updatedByRole;
    private Long updatedById;
}
