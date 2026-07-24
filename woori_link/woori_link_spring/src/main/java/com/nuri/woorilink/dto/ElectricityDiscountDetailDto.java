package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.ElectricityDiscountDetail;
import com.nuri.woorilink.entity.GasDiscountDetail;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ElectricityDiscountDetailDto {
    private Long id;
    private Long seniorId;
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
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ElectricityDiscountDetailDto from(
            ElectricityDiscountDetail detail
    ) {
        if (detail == null) return null;

        return ElectricityDiscountDetailDto.builder()
                .id(detail.getId())
                .seniorId(detail.getSeniorId())
                .usesElectricity(detail.getUsesElectricity())
                .electricityCompany(detail.getElectricityProvider())
                .electricityProvider(detail.getElectricityProvider())
                .customerNumber(detail.getCustomerNumber())
                .contractorName(detail.getContractorName())
                .addressSame(detail.getAddressSame())
                .serviceAddress(detail.getServiceAddress())
                .recentBillChecked(detail.getRecentBillChecked())
                .currentDiscountStatus(detail.getCurrentDiscountStatus())
                .welfareEligible(detail.getWelfareEligible())
                .note(detail.getNote())
                .updatedByRole(detail.getUpdatedByRole())
                .updatedById(detail.getUpdatedById())
                .createdAt(detail.getCreatedAt())
                .updatedAt(detail.getUpdatedAt())
                .build();
    }
}
