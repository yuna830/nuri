package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.GasDiscountDetail;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GasDiscountDetailRequest {

    private Boolean usesCityGas;

    private GasDiscountDetail.GasUseType gasUseType;

    private GasDiscountDetail.GasHeatingType gasHeatingType;

    private String gasCompany;

    private String gasCustomerNumber;

    private String gasContractorName;

    private Boolean addressSame;

    private String gasServiceAddress;

    private Boolean recentBillChecked;

    private Boolean severeDisabilityOrMerit;

    private Boolean basicOrNearPoor;

    private Boolean multiChildHousehold;

    private Boolean energyVoucherRecipient;

    private String note;

    private GasDiscountDetail.UpdatedByRole updatedByRole;

    private Long updatedById;
}