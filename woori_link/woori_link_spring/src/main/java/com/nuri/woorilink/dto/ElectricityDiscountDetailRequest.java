package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.GasDiscountDetail;
import com.nuri.woorilink.entity.ElectricityDiscountDetail;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElectricityDiscountDetailRequest {
    private Boolean usesElectricity;
    private String electricityCompany;
    private String electricityProvider;
    private String customerNumber;
    private String contractorName;
    private Boolean addressSame;
    private String serviceAddress;
    private Boolean recentBillChecked;
    private ElectricityDiscountDetail.ExistingDiscountStatus
            currentDiscountStatus;
    private Boolean welfareEligible;
    private String note;
    private GasDiscountDetail.UpdatedByRole updatedByRole;
    private Long updatedById;
}
