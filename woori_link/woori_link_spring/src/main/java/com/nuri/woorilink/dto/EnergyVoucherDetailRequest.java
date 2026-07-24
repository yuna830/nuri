package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergyVoucherDetail;
import com.nuri.woorilink.entity.GasDiscountDetail;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnergyVoucherDetailRequest {
    private Boolean incomeCriteriaConfirmed;
    private String livelihoodBenefitTypes;
    private Boolean householdCharacteristicConfirmed;
    private String householdCharacteristics;
    private Boolean winterOtherEnergySupportRecipient;
    private String otherEnergySupportTypes;
    private Boolean duplicateSupportDisqualifying;
    private Integer applicationYear;
    private EnergyVoucherDetail.ApplicationResult applicationResult;
    private String confirmationNote;
    private GasDiscountDetail.UpdatedByRole updatedByRole;
    private Long updatedById;
}
