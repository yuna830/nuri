package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.GasDiscountDetailDto;
import com.nuri.woorilink.dto.GasDiscountDetailRequest;
import com.nuri.woorilink.entity.GasDiscountDetail;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.GasDiscountDetailRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GasDiscountDetailService {

    private final GasDiscountDetailRepository gasDiscountDetailRepository;
    private final SeniorRepository seniorRepository;

    /**
     * 어르신의 도시가스 상세 정보 조회
     *
     * 아직 저장된 정보가 없으면 null을 반환한다.
     */
    public GasDiscountDetailDto getBySeniorId(
            Long seniorId
    ) {
        validateSeniorId(seniorId);

        return gasDiscountDetailRepository
                .findBySeniorId(seniorId)
                .map(GasDiscountDetailDto::from)
                .orElse(null);
    }

    /**
     * 도시가스 상세 정보 생성 또는 수정
     */
    @Transactional
    public GasDiscountDetailDto saveOrUpdate(
            Long seniorId,
            GasDiscountDetailRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "도시가스 상세 정보가 필요합니다."
            );
        }

        Senior senior = seniorRepository
                .findById(seniorId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "대상자를 찾을 수 없습니다: "
                                        + seniorId
                        )
                );

        GasDiscountDetail detail =
                gasDiscountDetailRepository
                        .findBySeniorId(seniorId)
                        .orElseGet(() ->
                                GasDiscountDetail.builder()
                                        .seniorId(seniorId)
                                        .build()
                        );

        applyRequest(
                detail,
                request
        );

        normalizeAndValidate(detail);

        /*
         * Senior의 기존 필드에도 도시가스 사용 여부를 반영한다.
         *
         * true  → 도시가스
         * false → 도시가스 미사용
         * null  → 미확인
         */
        applyGasTypeToSenior(
                senior,
                detail.getUsesCityGas()
        );

        /*
         * 도시가스 경감 가능 여부를 간단히 다시 계산한다.
         *
         * 상세 정보 저장 후 복지 자격과 도시가스 사용 여부가
         * 모두 확인된 경우 true로 저장한다.
         */
        senior.setGasDiscountEligible(
                calculateGasDiscountEligibility(
                        senior,
                        detail
                )
        );

        seniorRepository.save(senior);

        GasDiscountDetail saved =
                gasDiscountDetailRepository.save(
                        detail
                );

        return GasDiscountDetailDto.from(
                saved
        );
    }

    /**
     * 도시가스 상세 정보 삭제
     *
     * 실제 서비스에서는 삭제보다 수정 이력 보존이 더 적절하지만,
     * 개발 및 데이터 초기화 용도로 사용할 수 있다.
     */
    @Transactional
    public void deleteBySeniorId(
            Long seniorId
    ) {
        validateSeniorId(seniorId);

        gasDiscountDetailRepository
                .findBySeniorId(seniorId)
                .ifPresent(detail ->
                        gasDiscountDetailRepository.delete(
                                detail
                        )
                );
    }

    private void validateSeniorId(
            Long seniorId
    ) {
        if (seniorId == null) {
            throw new IllegalArgumentException(
                    "대상자 ID가 필요합니다."
            );
        }

        if (!seniorRepository.existsById(seniorId)) {
            throw new IllegalArgumentException(
                    "대상자를 찾을 수 없습니다: "
                            + seniorId
            );
        }
    }

    private void applyRequest(
            GasDiscountDetail detail,
            GasDiscountDetailRequest request
    ) {
        detail.setUsesCityGas(
                request.getUsesCityGas()
        );

        detail.setGasUseType(
                request.getGasUseType()
        );

        detail.setGasHeatingType(
                request.getGasHeatingType()
        );

        detail.setGasCompany(
                trimToNull(
                        request.getGasCompany()
                )
        );

        detail.setGasCustomerNumber(
                trimToNull(
                        request.getGasCustomerNumber()
                )
        );

        detail.setGasContractorName(
                trimToNull(
                        request.getGasContractorName()
                )
        );

        detail.setAddressSame(
                request.getAddressSame()
        );

        detail.setGasServiceAddress(
                trimToNull(
                        request.getGasServiceAddress()
                )
        );

        detail.setRecentBillChecked(
                request.getRecentBillChecked()
        );

        detail.setSevereDisabilityOrMerit(
                request.getSevereDisabilityOrMerit()
        );

        detail.setBasicOrNearPoor(
                request.getBasicOrNearPoor()
        );

        detail.setMultiChildHousehold(
                request.getMultiChildHousehold()
        );

        detail.setEnergyVoucherRecipient(
                request.getEnergyVoucherRecipient()
        );

        detail.setNote(
                trimToNull(
                        request.getNote()
                )
        );

        detail.setUpdatedByRole(
                request.getUpdatedByRole()
        );

        detail.setUpdatedById(
                request.getUpdatedById()
        );
    }

    private void normalizeAndValidate(
            GasDiscountDetail detail
    ) {
        /*
         * 도시가스를 사용하지 않는 경우에는
         * 도시가스 계약 관련 정보를 제거한다.
         */
        if (Boolean.FALSE.equals(
                detail.getUsesCityGas()
        )) {
            detail.setGasUseType(null);
            detail.setGasHeatingType(null);
            detail.setGasCompany(null);
            detail.setGasCustomerNumber(null);
            detail.setGasContractorName(null);
            detail.setAddressSame(null);
            detail.setGasServiceAddress(null);
            detail.setRecentBillChecked(null);

            return;
        }

        /*
         * 도시가스 사용 여부가 아직 미확인이라면
         * 필수값 검사를 하지 않는다.
         */
        if (detail.getUsesCityGas() == null) {
            return;
        }

        /*
         * 도시가스를 사용한다고 확인한 경우
         * 가스회사는 필수로 입력한다.
         */
        if (isBlank(detail.getGasCompany())) {
            throw new IllegalArgumentException(
                    "도시가스 회사를 입력해 주세요."
            );
        }

        /*
         * 고객번호와 계약자명은 실제 신청 지원을 진행할 때
         * 반드시 필요한 값으로 처리한다.
         */
        if (isBlank(
                detail.getGasCustomerNumber()
        )) {
            throw new IllegalArgumentException(
                    "도시가스 고객번호를 입력해 주세요."
            );
        }

        if (isBlank(
                detail.getGasContractorName()
        )) {
            throw new IllegalArgumentException(
                    "도시가스 계약자명을 입력해 주세요."
            );
        }

        /*
         * 실제 거주 주소와 도시가스 사용 주소가 다르다면
         * 도시가스 사용 주소를 입력해야 한다.
         */
        if (
                Boolean.FALSE.equals(
                        detail.getAddressSame()
                )
                        && isBlank(
                        detail.getGasServiceAddress()
                )
        ) {
            throw new IllegalArgumentException(
                    "도시가스 사용 주소를 입력해 주세요."
            );
        }

        /*
         * 주소가 같으면 별도 사용 주소는 저장하지 않는다.
         */
        if (Boolean.TRUE.equals(
                detail.getAddressSame()
        )) {
            detail.setGasServiceAddress(null);
        }
    }

    private void applyGasTypeToSenior(
            Senior senior,
            Boolean usesCityGas
    ) {
        if (usesCityGas == null) {
            /*
             * 미확인 상태에서는 기존 gasType 값을 유지한다.
             */
            return;
        }

        if (Boolean.TRUE.equals(
                usesCityGas
        )) {
            senior.setGasType(
                    "CITY_GAS"
            );
        } else {
            senior.setGasType(
                    "NOT_CITY_GAS"
            );
        }
    }

    /**
     * 도시가스요금 경감 가능성 계산
     *
     * null  → 도시가스 사용 여부 또는 복지 자격 정보 부족
     * true  → 도시가스 사용 + 복지 자격 조건 확인
     * false → 도시가스를 사용하지 않음
     */
    private Boolean calculateGasDiscountEligibility(
            Senior senior,
            GasDiscountDetail detail
    ) {
        if (detail.getUsesCityGas() == null) {
            return null;
        }

        if (Boolean.FALSE.equals(
                detail.getUsesCityGas()
        )) {
            return false;
        }

        boolean hasQualification =
                Boolean.TRUE.equals(
                        detail.getSevereDisabilityOrMerit()
                )
                        || Boolean.TRUE.equals(
                        detail.getBasicOrNearPoor()
                )
                        || Boolean.TRUE.equals(
                        detail.getMultiChildHousehold()
                )
                        || Boolean.TRUE.equals(
                        detail.getEnergyVoucherRecipient()
                )
                        || Boolean.TRUE.equals(
                        senior.getLivelihoodBenefit()
                )
                        || Boolean.TRUE.equals(
                        senior.getMedicalBenefit()
                )
                        || Boolean.TRUE.equals(
                        senior.getHousingBenefit()
                )
                        || Boolean.TRUE.equals(
                        senior.getEducationBenefit()
                )
                        || (
                        senior.getDisabilityGrade() != null
                                && !senior
                                .getDisabilityGrade()
                                .isBlank()
                );

        /*
         * 모든 자격 항목이 아직 입력되지 않았다면
         * false가 아닌 미확인(null)으로 처리한다.
         */
        boolean qualificationInformationExists =
                detail.getSevereDisabilityOrMerit()
                        != null
                        || detail.getBasicOrNearPoor()
                        != null
                        || detail.getMultiChildHousehold()
                        != null
                        || detail.getEnergyVoucherRecipient()
                        != null
                        || senior.getLivelihoodBenefit()
                        != null
                        || senior.getMedicalBenefit()
                        != null
                        || senior.getHousingBenefit()
                        != null
                        || senior.getEducationBenefit()
                        != null
                        || (
                        senior.getDisabilityGrade() != null
                                && !senior
                                .getDisabilityGrade()
                                .isBlank()
                );

        if (!qualificationInformationExists) {
            return null;
        }

        return hasQualification;
    }

    private String trimToNull(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String trimmed =
                value.trim();

        return trimmed.isEmpty()
                ? null
                : trimmed;
    }

    private boolean isBlank(
            String value
    ) {
        return value == null
                || value.isBlank();
    }
}