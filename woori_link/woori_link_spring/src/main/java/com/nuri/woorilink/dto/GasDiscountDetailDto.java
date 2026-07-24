package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.GasDiscountDetail;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GasDiscountDetailDto {

    private Long id;

    private Long seniorId;

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

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    public static GasDiscountDetailDto from(
            GasDiscountDetail detail
    ) {
        if (detail == null) {
            return null;
        }

        return GasDiscountDetailDto.builder()
                .id(detail.getId())
                .seniorId(detail.getSeniorId())
                .usesCityGas(detail.getUsesCityGas())
                .gasUseType(detail.getGasUseType())
                .gasHeatingType(detail.getGasHeatingType())
                .gasCompany(detail.getGasCompany())
                .gasCustomerNumber(detail.getGasCustomerNumber())
                .gasContractorName(detail.getGasContractorName())
                .addressSame(detail.getAddressSame())
                .gasServiceAddress(detail.getGasServiceAddress())
                .recentBillChecked(detail.getRecentBillChecked())
                .severeDisabilityOrMerit(
                        detail.getSevereDisabilityOrMerit()
                )
                .basicOrNearPoor(
                        detail.getBasicOrNearPoor()
                )
                .multiChildHousehold(
                        detail.getMultiChildHousehold()
                )
                .energyVoucherRecipient(
                        detail.getEnergyVoucherRecipient()
                )
                .note(detail.getNote())
                .updatedByRole(
                        detail.getUpdatedByRole()
                )
                .updatedById(
                        detail.getUpdatedById()
                )
                .createdAt(
                        detail.getCreatedAt()
                )
                .updatedAt(
                        detail.getUpdatedAt()
                )
                .build();
    }
}