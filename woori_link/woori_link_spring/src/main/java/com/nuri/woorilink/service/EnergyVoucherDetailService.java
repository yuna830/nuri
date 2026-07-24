package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergyVoucherDetailDto;
import com.nuri.woorilink.dto.EnergyVoucherDetailRequest;
import com.nuri.woorilink.entity.EnergyVoucherDetail;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.EnergyVoucherDetailRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnergyVoucherDetailService {

    private final EnergyVoucherDetailRepository detailRepository;
    private final SeniorRepository seniorRepository;

    public EnergyVoucherDetailDto getBySeniorId(Long seniorId) {
        validateSenior(seniorId);
        return detailRepository.findBySeniorId(seniorId)
                .map(EnergyVoucherDetailDto::from)
                .orElse(null);
    }

    @Transactional
    public EnergyVoucherDetailDto saveOrUpdate(
            Long seniorId,
            EnergyVoucherDetailRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("에너지바우처 상세 정보가 필요합니다.");
        }

        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "대상자를 찾을 수 없습니다: " + seniorId
                ));

        EnergyVoucherDetail detail = detailRepository.findBySeniorId(seniorId)
                .orElseGet(() -> EnergyVoucherDetail.builder()
                        .seniorId(seniorId)
                        .build());

        detail.setIncomeCriteriaConfirmed(request.getIncomeCriteriaConfirmed());
        detail.setLivelihoodBenefitTypes(
                trimToNull(request.getLivelihoodBenefitTypes())
        );
        detail.setHouseholdCharacteristicConfirmed(
                request.getHouseholdCharacteristicConfirmed()
        );
        detail.setHouseholdCharacteristics(
                trimToNull(request.getHouseholdCharacteristics())
        );
        detail.setWinterOtherEnergySupportRecipient(
                request.getWinterOtherEnergySupportRecipient()
        );
        detail.setOtherEnergySupportTypes(
                trimToNull(request.getOtherEnergySupportTypes())
        );
        detail.setDuplicateSupportDisqualifying(
                request.getDuplicateSupportDisqualifying()
        );
        detail.setApplicationYear(request.getApplicationYear());
        detail.setApplicationResult(request.getApplicationResult());
        detail.setConfirmationNote(trimToNull(request.getConfirmationNote()));
        detail.setUpdatedByRole(request.getUpdatedByRole());
        detail.setUpdatedById(request.getUpdatedById());

        normalizeAndValidate(detail);

        senior.setEnergyVoucherEligible(calculateEligibility(detail));
        seniorRepository.save(senior);

        return EnergyVoucherDetailDto.from(detailRepository.save(detail));
    }

    @Transactional
    public void deleteBySeniorId(Long seniorId) {
        validateSenior(seniorId);
        detailRepository.findBySeniorId(seniorId)
                .ifPresent(detailRepository::delete);
    }

    private void normalizeAndValidate(EnergyVoucherDetail detail) {
        if (Boolean.TRUE.equals(detail.getIncomeCriteriaConfirmed())
                && isBlank(detail.getLivelihoodBenefitTypes())) {
            throw new IllegalArgumentException("기초생활수급 종류를 입력해 주세요.");
        }
        if (Boolean.TRUE.equals(detail.getHouseholdCharacteristicConfirmed())
                && isBlank(detail.getHouseholdCharacteristics())) {
            throw new IllegalArgumentException("세대원 특성 상세를 입력해 주세요.");
        }
        if (Boolean.TRUE.equals(detail.getWinterOtherEnergySupportRecipient())
                && isBlank(detail.getOtherEnergySupportTypes())) {
            throw new IllegalArgumentException(
                    "중복되는 겨울철 에너지 지원명을 입력해 주세요."
            );
        }
        if (!Boolean.TRUE.equals(detail.getWinterOtherEnergySupportRecipient())) {
            detail.setOtherEnergySupportTypes(null);
            detail.setDuplicateSupportDisqualifying(false);
        }
        if (detail.getApplicationYear() != null
                && (detail.getApplicationYear() < 2000
                || detail.getApplicationYear() > 2100)) {
            throw new IllegalArgumentException("신청 연도를 확인해 주세요.");
        }
    }

    private Boolean calculateEligibility(EnergyVoucherDetail detail) {
        if (Boolean.FALSE.equals(detail.getIncomeCriteriaConfirmed())
                || Boolean.FALSE.equals(
                detail.getHouseholdCharacteristicConfirmed()
        )) {
            return false;
        }
        if (Boolean.TRUE.equals(detail.getIncomeCriteriaConfirmed())
                && Boolean.TRUE.equals(
                detail.getHouseholdCharacteristicConfirmed()
        )
                && Boolean.FALSE.equals(
                detail.getWinterOtherEnergySupportRecipient()
        )
                || Boolean.TRUE.equals(
                detail.getWinterOtherEnergySupportRecipient()
        ) && Boolean.FALSE.equals(
                detail.getDuplicateSupportDisqualifying()
        )) {
            return true;
        }
        if (Boolean.TRUE.equals(detail.getDuplicateSupportDisqualifying())) {
            return false;
        }
        return null;
    }

    private void validateSenior(Long seniorId) {
        if (seniorId == null || !seniorRepository.existsById(seniorId)) {
            throw new IllegalArgumentException(
                    "대상자를 찾을 수 없습니다: " + seniorId
            );
        }
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
