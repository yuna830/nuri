package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergyVoucherDetail;
import com.nuri.woorilink.entity.GasDiscountDetail;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EnergyVoucherDetailDto {
    private Long id;
    private Long seniorId;
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
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static EnergyVoucherDetailDto from(EnergyVoucherDetail detail) {
        if (detail == null) return null;
        return EnergyVoucherDetailDto.builder()
                .id(detail.getId())
                .seniorId(detail.getSeniorId())
                .incomeCriteriaConfirmed(detail.getIncomeCriteriaConfirmed())
                .livelihoodBenefitTypes(detail.getLivelihoodBenefitTypes())
                .householdCharacteristicConfirmed(
                        detail.getHouseholdCharacteristicConfirmed()
                )
                .householdCharacteristics(detail.getHouseholdCharacteristics())
                .winterOtherEnergySupportRecipient(
                        detail.getWinterOtherEnergySupportRecipient()
                )
                .otherEnergySupportTypes(detail.getOtherEnergySupportTypes())
                .duplicateSupportDisqualifying(
                        detail.getDuplicateSupportDisqualifying()
                )
                .applicationYear(detail.getApplicationYear())
                .applicationResult(detail.getApplicationResult())
                .confirmationNote(detail.getConfirmationNote())
                .updatedByRole(detail.getUpdatedByRole())
                .updatedById(detail.getUpdatedById())
                .createdAt(detail.getCreatedAt())
                .updatedAt(detail.getUpdatedAt())
                .build();
    }
}
