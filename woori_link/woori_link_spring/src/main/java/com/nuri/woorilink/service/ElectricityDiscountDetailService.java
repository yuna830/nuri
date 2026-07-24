package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.ElectricityDiscountDetailDto;
import com.nuri.woorilink.dto.ElectricityDiscountDetailRequest;
import com.nuri.woorilink.entity.ElectricityDiscountDetail;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.ElectricityDiscountDetailRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ElectricityDiscountDetailService {

    private final ElectricityDiscountDetailRepository detailRepository;
    private final SeniorRepository seniorRepository;

    public ElectricityDiscountDetailDto getBySeniorId(Long seniorId) {
        validateSenior(seniorId);
        return detailRepository.findBySeniorId(seniorId)
                .map(ElectricityDiscountDetailDto::from)
                .orElse(null);
    }

    @Transactional
    public ElectricityDiscountDetailDto saveOrUpdate(
            Long seniorId,
            ElectricityDiscountDetailRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException("전기요금 상세 정보가 필요합니다.");
        }

        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "대상자를 찾을 수 없습니다: " + seniorId
                ));

        ElectricityDiscountDetail detail = detailRepository
                .findBySeniorId(seniorId)
                .orElseGet(() -> ElectricityDiscountDetail.builder()
                        .seniorId(seniorId)
                        .build());

        detail.setUsesElectricity(request.getUsesElectricity());
        detail.setElectricityProvider(trimToNull(
                request.getElectricityCompany() != null
                        ? request.getElectricityCompany()
                        : request.getElectricityProvider()
        ));
        detail.setCustomerNumber(trimToNull(request.getCustomerNumber()));
        detail.setContractorName(trimToNull(request.getContractorName()));
        detail.setAddressSame(request.getAddressSame());
        detail.setServiceAddress(trimToNull(request.getServiceAddress()));
        detail.setRecentBillChecked(request.getRecentBillChecked());
        detail.setCurrentDiscountStatus(request.getCurrentDiscountStatus());
        detail.setWelfareEligible(request.getWelfareEligible());
        detail.setNote(trimToNull(request.getNote()));
        detail.setUpdatedByRole(request.getUpdatedByRole());
        detail.setUpdatedById(request.getUpdatedById());

        normalizeAndValidate(detail);

        senior.setElectricityDiscountEligible(
                calculateEligibility(senior, detail)
        );
        seniorRepository.save(senior);

        return ElectricityDiscountDetailDto.from(
                detailRepository.save(detail)
        );
    }

    @Transactional
    public void deleteBySeniorId(Long seniorId) {
        validateSenior(seniorId);
        detailRepository.findBySeniorId(seniorId)
                .ifPresent(detailRepository::delete);
    }

    private void normalizeAndValidate(ElectricityDiscountDetail detail) {
        if (Boolean.FALSE.equals(detail.getUsesElectricity())) {
            detail.setElectricityProvider(null);
            detail.setCustomerNumber(null);
            detail.setContractorName(null);
            detail.setAddressSame(null);
            detail.setServiceAddress(null);
            detail.setRecentBillChecked(null);
            return;
        }

        if (detail.getUsesElectricity() == null) return;

        if (isBlank(detail.getElectricityProvider())) {
            throw new IllegalArgumentException("전기 공급사를 입력해 주세요.");
        }
        if (isBlank(detail.getCustomerNumber())) {
            throw new IllegalArgumentException("전기 고객번호를 입력해 주세요.");
        }
        if (isBlank(detail.getContractorName())) {
            throw new IllegalArgumentException("전기 계약자명을 입력해 주세요.");
        }
        if (Boolean.FALSE.equals(detail.getAddressSame())
                && isBlank(detail.getServiceAddress())) {
            throw new IllegalArgumentException("전기 사용 주소를 입력해 주세요.");
        }
        if (Boolean.TRUE.equals(detail.getAddressSame())) {
            detail.setServiceAddress(null);
        }
    }

    private Boolean calculateEligibility(
            Senior senior,
            ElectricityDiscountDetail detail
    ) {
        if (detail.getUsesElectricity() == null) return null;
        if (Boolean.FALSE.equals(detail.getUsesElectricity())) return false;
        if (detail.getWelfareEligible() != null) {
            return detail.getWelfareEligible();
        }

        boolean qualified = Boolean.TRUE.equals(senior.getLivelihoodBenefit())
                || Boolean.TRUE.equals(senior.getMedicalBenefit())
                || Boolean.TRUE.equals(senior.getHousingBenefit())
                || Boolean.TRUE.equals(senior.getEducationBenefit())
                || (senior.getDisabilityGrade() != null
                && !senior.getDisabilityGrade().isBlank());
        return qualified ? true : null;
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
