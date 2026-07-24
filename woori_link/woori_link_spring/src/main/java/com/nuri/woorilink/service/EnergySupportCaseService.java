package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergySupportActivityDto;
import com.nuri.woorilink.dto.EnergySupportCaseDto;
import com.nuri.woorilink.dto.EnergySupportCaseUpdateRequest;
import com.nuri.woorilink.entity.EnergySupportActivity;
import com.nuri.woorilink.entity.EnergySupportCase;
import com.nuri.woorilink.entity.EnergyVoucherDetail;
import com.nuri.woorilink.entity.ElectricityDiscountDetail;
import com.nuri.woorilink.entity.GasDiscountDetail;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.EnergySupportActivityRepository;
import com.nuri.woorilink.repository.EnergySupportCaseRepository;
import com.nuri.woorilink.repository.EnergyVoucherDetailRepository;
import com.nuri.woorilink.repository.ElectricityDiscountDetailRepository;
import com.nuri.woorilink.repository.GasDiscountDetailRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnergySupportCaseService {

    private final EnergySupportCaseRepository caseRepository;
    private final EnergySupportActivityRepository activityRepository;
    private final SeniorRepository seniorRepository;

    /*
     * 도시가스 상세 정보 조회용 Repository
     */
    private final GasDiscountDetailRepository gasDiscountDetailRepository;
    private final ElectricityDiscountDetailRepository electricityDiscountDetailRepository;
    private final EnergyVoucherDetailRepository energyVoucherDetailRepository;

    public List<EnergySupportCaseDto> getCandidates(
            Long welfareWorkerId,
            EnergySupportCase.SupportType supportType,
            CandidateScope scope
    ) {
        return seniorRepository.findByWelfareWorkerId(welfareWorkerId)
                .stream()
                .map(senior -> toCandidate(senior, supportType))
                .filter(candidate -> candidate != null)
                .filter(candidate -> matchesScope(candidate, scope))
                .toList();
    }

    public enum CandidateScope {
        ACTIVE,
        COMPLETED,
        ALL
    }

    private boolean matchesScope(
            EnergySupportCaseDto candidate,
            CandidateScope scope
    ) {
        if (scope == CandidateScope.ALL) return true;

        boolean completed = switch (candidate.status()) {
            case APPLICATION_COMPLETED,
                 RESULT_CONFIRMED,
                 ALREADY_APPLIED,
                 NOT_ELIGIBLE,
                 DECLINED,
                 ON_HOLD -> true;
            default -> false;
        };

        return scope == CandidateScope.COMPLETED
                ? completed
                : !completed;
    }

    @Transactional
    public EnergySupportCaseDto update(
            Long seniorId,
            EnergySupportCase.SupportType supportType,
            EnergySupportCaseUpdateRequest request,
            String updatedByRole,
            Long updatedById
    ) {
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "대상자를 찾을 수 없습니다: " + seniorId
                        )
                );

        EnergySupportCase supportCase = caseRepository
                .findBySeniorIdAndSupportType(
                        seniorId,
                        supportType
                )
                .orElseGet(() ->
                        EnergySupportCase.builder()
                                .seniorId(seniorId)
                                .supportType(supportType)
                                .build()
                );

        EnergySupportCase.SupportStatus previousStatus =
                supportCase.getStatus();

        EnergySupportCase.ExistingApplicationStatus previousExistingStatus =
                supportCase.getExistingApplicationStatus();

        EnergySupportCase.ApplicationIntent previousApplicationIntent =
                supportCase.getApplicationIntent();

        EnergySupportCase.DeclineReason previousDeclineReason =
                supportCase.getDeclineReason();

        String previousContactMethod =
                supportCase.getContactMethod();

        var previousNextActionDate =
                supportCase.getNextActionDate();

        String previousNote =
                supportCase.getNote();

        if (request.getStatus() != null) {
            supportCase.setStatus(
                    request.getStatus()
            );
        }

        if (
                request.getExistingApplicationStatus()
                        != null
        ) {
            supportCase.setExistingApplicationStatus(
                    request.getExistingApplicationStatus()
            );
        }

        if (request.getApplicationIntent() != null) {
            supportCase.setApplicationIntent(
                    request.getApplicationIntent()
            );
        }

        supportCase.setDeclineReason(
                request.getDeclineReason()
        );

        supportCase.setContactMethod(
                request.getContactMethod()
        );

        supportCase.setNextActionDate(
                request.getNextActionDate()
        );

        supportCase.setNote(
                request.getNote()
        );

        normalizeAndValidate(
                supportCase
        );

        boolean changed =
                previousStatus != supportCase.getStatus()
                        || previousExistingStatus
                        != supportCase.getExistingApplicationStatus()
                        || previousApplicationIntent
                        != supportCase.getApplicationIntent()
                        || previousDeclineReason
                        != supportCase.getDeclineReason()
                        || !Objects.equals(
                        previousContactMethod,
                        supportCase.getContactMethod()
                )
                        || !Objects.equals(
                        previousNextActionDate,
                        supportCase.getNextActionDate()
                )
                        || !Objects.equals(
                        previousNote,
                        supportCase.getNote()
                );

        synchronizeAppliedStatus(
                senior,
                supportType,
                supportCase.getStatus()
        );

        seniorRepository.save(
                senior
        );

        EnergySupportCase saved =
                caseRepository.save(
                        supportCase
                );

        if (changed) {
            String changeSummary = buildChangeSummary(
                    previousStatus,
                    previousExistingStatus,
                    previousApplicationIntent,
                    previousDeclineReason,
                    previousContactMethod,
                    previousNextActionDate,
                    previousNote,
                    supportCase
            );

            activityRepository.save(
                    EnergySupportActivity.builder()
                            .caseId(saved.getId())
                            .seniorId(seniorId)
                            .supportType(supportType)
                            .status(saved.getStatus())
                            .existingApplicationStatus(
                                    saved.getExistingApplicationStatus()
                            )
                            .applicationIntent(saved.getApplicationIntent())
                            .declineReason(saved.getDeclineReason())
                            .contactMethod(
                                    saved.getContactMethod()
                            )
                            .nextActionDate(
                                    saved.getNextActionDate()
                            )
                            .note(saved.getNote())
                            .updatedByRole(updatedByRole)
                            .updatedById(updatedById)
                            .changeSummary(changeSummary)
                            .build()
            );
        }

        return toDto(
                senior,
                saved,
                supportType
        );
    }

    private EnergySupportCaseDto toCandidate(
            Senior senior,
            EnergySupportCase.SupportType type
    ) {
        EnergySupportCase existing =
                caseRepository
                        .findBySeniorIdAndSupportType(
                                senior.getId(),
                                type
                        )
                        .orElse(null);

        GasDiscountDetail gasDetail =
                getGasDetail(
                        senior.getId(),
                        type
                );

        boolean possible =
                isEligibilityPossible(
                        senior,
                        type,
                        gasDetail
                );

        boolean applicationUnconfirmed =
                !isApplied(
                        senior,
                        type
                );

        if (
                existing == null
                        && (
                        !possible
                                || !applicationUnconfirmed
                )
        ) {
            return null;
        }

        return toDto(
                senior,
                existing,
                type,
                gasDetail
        );
    }

    private EnergySupportCaseDto toDto(
            Senior senior,
            EnergySupportCase supportCase,
            EnergySupportCase.SupportType type
    ) {
        GasDiscountDetail gasDetail =
                getGasDetail(
                        senior.getId(),
                        type
                );

        return toDto(
                senior,
                supportCase,
                type,
                gasDetail
        );
    }

    private EnergySupportCaseDto toDto(
            Senior senior,
            EnergySupportCase supportCase,
            EnergySupportCase.SupportType type,
            GasDiscountDetail gasDetail
    ) {
        return new EnergySupportCaseDto(
                supportCase != null
                        ? supportCase.getId()
                        : null,

                senior.getId(),
                senior.getName(),
                senior.getAge(),
                senior.getAddress(),
                senior.getIncomeLevel(),
                senior.getDisabilityGrade(),

                type,

                isEligibilityPossible(
                        senior,
                        type,
                        gasDetail
                ),

                eligibilityLevel(
                        senior,
                        type,
                        gasDetail
                ),

                eligibilityReason(
                        senior,
                        type,
                        gasDetail
                ),

                missingInformation(
                        senior,
                        type,
                        supportCase,
                        gasDetail
                ),

                supportCase != null
                        && supportCase
                        .getExistingApplicationStatus()
                        != null
                        ? supportCase
                        .getExistingApplicationStatus()
                        : EnergySupportCase
                        .ExistingApplicationStatus
                        .UNKNOWN,

                supportCase != null
                        && supportCase
                        .getApplicationIntent()
                        != null
                        ? supportCase
                        .getApplicationIntent()
                        : EnergySupportCase
                        .ApplicationIntent
                        .UNKNOWN,

                supportCase != null
                        ? supportCase.getDeclineReason()
                        : null,

                supportCase != null
                        ? supportCase.getStatus()
                        : EnergySupportCase
                        .SupportStatus
                        .CONFIRMATION_NEEDED,

                supportCase != null
                        ? supportCase.getContactMethod()
                        : null,

                supportCase != null
                        ? supportCase.getNextActionDate()
                        : null,

                supportCase != null
                        ? supportCase.getNote()
                        : null,

                supportCase != null
                        ? supportCase.getUpdatedAt()
                        : null,

                activityRepository
                        .findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(
                                senior.getId(),
                                type
                        )
                        .stream()
                        .map(activity ->
                                new EnergySupportActivityDto(
                                        activity.getId(),
                                        activity.getStatus(),
                                        activity.getExistingApplicationStatus(),
                                        activity.getApplicationIntent(),
                                        activity.getDeclineReason(),
                                        activity.getContactMethod(),
                                        activity.getNextActionDate(),
                                        activity.getNote(),
                                        activity.getUpdatedByRole(),
                                        activity.getUpdatedById(),
                                        activity.getChangeSummary(),
                                        activity.getCreatedAt()
                                )
                        )
                        .toList()
        );
    }

    private GasDiscountDetail getGasDetail(
            Long seniorId,
            EnergySupportCase.SupportType type
    ) {
        if (
                seniorId == null
                        || type
                        != EnergySupportCase
                        .SupportType
                        .GAS
        ) {
            return null;
        }

        return gasDiscountDetailRepository
                .findBySeniorId(seniorId)
                .orElse(null);
    }

    private boolean isEligibilityPossible(
            Senior senior,
            EnergySupportCase.SupportType type,
            GasDiscountDetail gasDetail
    ) {
        if (
                senior == null
                        || type == null
        ) {
            return false;
        }

        return switch (type) {
            case VOUCHER ->
                    isEnergyVoucherEligible(
                            senior,
                            getEnergyVoucherDetail(senior.getId())
                    );

            case ELECTRICITY -> {
                ElectricityDiscountDetail detail =
                        getElectricityDetail(senior.getId());
                yield !Boolean.FALSE.equals(
                        detail == null ? null : detail.getUsesElectricity()
                ) && hasElectricityWelfareQualification(senior, detail);
            }

            case GAS -> {
                Boolean cityGasUser =
                        isCityGasUser(
                                senior,
                                gasDetail
                        );

                boolean welfareQualification =
                        hasGasWelfareQualification(
                                senior,
                                gasDetail
                        );

                /*
                 * 도시가스 미사용이 확정된 경우에는
                 * 후보에서 제외한다.
                 *
                 * 도시가스 사용 여부가 아직 미확인이더라도
                 * 복지 자격이 있다면 확인 대상으로 포함한다.
                 */
                yield !Boolean.FALSE.equals(
                        cityGasUser
                )
                        && welfareQualification;
            }
        };
    }

    private Boolean isCityGasUser(
            Senior senior,
            GasDiscountDetail gasDetail
    ) {
        /*
         * 도시가스 상세 테이블에 값이 있으면
         * 그 값을 가장 우선해서 사용한다.
         */
        if (
                gasDetail != null
                        && gasDetail.getUsesCityGas()
                        != null
        ) {
            return gasDetail.getUsesCityGas();
        }

        /*
         * 상세 정보가 아직 없거나 미확인인 경우에는
         * 기존 Senior.gasType 값을 보조적으로 사용한다.
         */
        if (
                senior == null
                        || senior.getGasType() == null
                        || senior.getGasType().isBlank()
        ) {
            return null;
        }

        String gasType =
                senior.getGasType()
                        .trim();

        if (
                gasType.equalsIgnoreCase(
                        "CITY_GAS"
                )
                        || gasType.contains(
                        "도시가스"
                )
        ) {
            return true;
        }

        if (
                gasType.equalsIgnoreCase(
                        "LPG"
                )
                        || gasType
                        .toUpperCase()
                        .contains("LPG")
                        || gasType.contains(
                        "엘피지"
                )
                        || gasType.contains(
                        "등유"
                )
                        || gasType.contains(
                        "전기"
                )
                        || gasType.contains(
                        "연탄"
                )
        ) {
            return false;
        }

        return null;
    }

    private boolean hasGasWelfareQualification(
            Senior senior,
            GasDiscountDetail gasDetail
    ) {
        if (senior == null) {
            return false;
        }

        /*
         * 도시가스 상세 조사에서 확인된 복지 자격
         */
        if (gasDetail != null) {
            if (
                    Boolean.TRUE.equals(
                            gasDetail.getSevereDisabilityOrMerit()
                    )
                            || Boolean.TRUE.equals(
                            gasDetail.getBasicOrNearPoor()
                    )
                            || Boolean.TRUE.equals(
                            gasDetail.getMultiChildHousehold()
                    )
                            || Boolean.TRUE.equals(
                            gasDetail.getEnergyVoucherRecipient()
                    )
            ) {
                return true;
            }
        }

        /*
         * Senior 기본 정보에서 확인되는 복지 자격
         */
        return Boolean.TRUE.equals(
                senior.getGasDiscountEligible()
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
                || hasDisabilityInformation(
                senior
        );
    }

    private boolean hasDisabilityInformation(
            Senior senior
    ) {
        return senior != null
                && senior.getDisabilityGrade()
                != null
                && !senior.getDisabilityGrade()
                .isBlank();
    }

    private boolean isApplied(
            Senior senior,
            EnergySupportCase.SupportType type
    ) {
        if (
                senior == null
                        || type == null
        ) {
            return false;
        }

        return switch (type) {
            case VOUCHER ->
                    Boolean.TRUE.equals(
                            senior.getEnergyVoucherApplied()
                    );

            case ELECTRICITY ->
                    Boolean.TRUE.equals(
                            senior.getElectricityDiscountApplied()
                    );

            case GAS ->
                    Boolean.TRUE.equals(
                            senior.getGasDiscountApplied()
                    );
        };
    }

    private String eligibilityReason(
            Senior senior,
            EnergySupportCase.SupportType type,
            GasDiscountDetail gasDetail
    ) {
        if (type == null) {
            return "지원 유형 확인이 필요합니다.";
        }

        return switch (type) {
            case VOUCHER ->
                    energyVoucherEligibilityReason(
                            senior,
                            getEnergyVoucherDetail(senior.getId())
                    );

            case ELECTRICITY ->
                    electricityEligibilityReason(
                            senior,
                            getElectricityDetail(senior.getId())
                    );

            case GAS ->
                    gasEligibilityReason(
                            senior,
                            gasDetail
                    );
        };
    }

    private String gasEligibilityReason(
            Senior senior,
            GasDiscountDetail gasDetail
    ) {
        Boolean cityGasUser =
                isCityGasUser(
                        senior,
                        gasDetail
                );

        boolean welfareQualification =
                hasGasWelfareQualification(
                        senior,
                        gasDetail
                );

        if (
                Boolean.FALSE.equals(
                        cityGasUser
                )
        ) {
            return "도시가스 사용 세대가 아님";
        }

        if (
                cityGasUser == null
                        && welfareQualification
        ) {
            return "복지 자격 확인됨 · 도시가스 사용 여부 확인 필요";
        }

        if (
                Boolean.TRUE.equals(
                        cityGasUser
                )
                        && !welfareQualification
        ) {
            return "도시가스 사용 확인됨 · 복지 자격 확인 필요";
        }

        if (
                Boolean.TRUE.equals(
                        cityGasUser
                )
                        && welfareQualification
        ) {
            if (
                    gasDetail == null
                            || !hasCompleteGasContractInformation(
                            gasDetail
                    )
            ) {
                return "신청 가능성이 높음 · 도시가스 계약 정보 추가 확인 필요";
            }

            if (
                    Boolean.FALSE.equals(
                            gasDetail.getAddressSame()
                    )
            ) {
                return "도시가스 사용 주소가 거주 주소와 달라 확인 필요";
            }

            if (
                    Boolean.FALSE.equals(
                            gasDetail.getRecentBillChecked()
                    )
            ) {
                return "신청 가능성이 높음 · 최근 도시가스 고지서 확인 필요";
            }

            return "신청 가능 : 도시가스 사용, 복지 자격 및 계약 정보 확인됨";
        }

        return "도시가스 사용 여부와 복지 자격 확인 필요";
    }

    private List<String> missingInformation(
            Senior senior,
            EnergySupportCase.SupportType type,
            EnergySupportCase supportCase,
            GasDiscountDetail gasDetail
    ) {
        List<String> missing =
                new ArrayList<>();

        switch (type) {
            case VOUCHER ->
                    addEnergyVoucherMissingInformation(
                            missing,
                            senior,
                            getEnergyVoucherDetail(senior.getId())
                    );

            case ELECTRICITY ->
                    addElectricityMissingInformation(
                        missing,
                        senior,
                        getElectricityDetail(senior.getId())
                );

            case GAS ->
                    addGasMissingInformation(
                            missing,
                            senior,
                            gasDetail
                    );
        }

        if (
                supportCase == null
                        || supportCase
                        .getExistingApplicationStatus()
                        == null
                        || supportCase
                        .getExistingApplicationStatus()
                        == EnergySupportCase
                        .ExistingApplicationStatus
                        .UNKNOWN
        ) {
            missing.add(
                    "기존 신청 여부"
            );
        }

        return missing;
    }

    private void addGasMissingInformation(
            List<String> missing,
            Senior senior,
            GasDiscountDetail gasDetail
    ) {
        Boolean cityGasUser =
                isCityGasUser(
                        senior,
                        gasDetail
                );

        if (cityGasUser == null) {
            missing.add(
                    "도시가스 사용 여부"
            );
        }

        if (
                !hasGasWelfareQualification(
                        senior,
                        gasDetail
                )
                        && (
                        senior.getGasDiscountEligible()
                                == null
                                || gasDetail == null
                                || !hasCompleteGasQualificationInformation(
                                gasDetail
                        )
                )
        ) {
            missing.add(
                    "복지 자격"
            );
        }

        /*
         * 도시가스를 사용하지 않는 것이 확정된 경우에는
         * 계약 정보 누락 항목을 추가하지 않는다.
         */
        if (
                Boolean.FALSE.equals(
                        cityGasUser
                )
        ) {
            return;
        }

        if (gasDetail == null) {
            missing.add(
                    "도시가스 계약 정보"
            );
            return;
        }

        if (
                isBlank(
                        gasDetail.getGasCompany()
                )
        ) {
            missing.add(
                    "가스회사"
            );
        }

        if (
                isBlank(
                        gasDetail.getGasCustomerNumber()
                )
        ) {
            missing.add(
                    "고객번호"
            );
        }

        if (
                isBlank(
                        gasDetail.getGasContractorName()
                )
        ) {
            missing.add(
                    "계약자명"
            );
        }

        if (
                gasDetail.getAddressSame()
                        == null
        ) {
            missing.add(
                    "주소 일치 여부"
            );
        } else if (
                Boolean.FALSE.equals(
                        gasDetail.getAddressSame()
                )
                        && isBlank(
                        gasDetail.getGasServiceAddress()
                )
        ) {
            missing.add(
                    "도시가스 사용 주소"
            );
        }

        if (
                gasDetail.getRecentBillChecked()
                        == null
        ) {
            missing.add(
                    "최근 고지서 확인 여부"
            );
        } else if (
                Boolean.FALSE.equals(
                        gasDetail.getRecentBillChecked()
                )
        ) {
            missing.add(
                    "최근 도시가스 고지서"
            );
        }
    }

    private boolean hasCompleteGasContractInformation(
            GasDiscountDetail gasDetail
    ) {
        if (gasDetail == null) {
            return false;
        }

        if (
                !Boolean.TRUE.equals(
                        gasDetail.getUsesCityGas()
                )
        ) {
            return false;
        }

        if (
                isBlank(
                        gasDetail.getGasCompany()
                )
                        || isBlank(
                        gasDetail.getGasCustomerNumber()
                )
                        || isBlank(
                        gasDetail.getGasContractorName()
                )
        ) {
            return false;
        }

        if (
                gasDetail.getAddressSame()
                        == null
        ) {
            return false;
        }

        if (
                Boolean.FALSE.equals(
                        gasDetail.getAddressSame()
                )
                        && isBlank(
                        gasDetail.getGasServiceAddress()
                )
        ) {
            return false;
        }

        return Boolean.TRUE.equals(
                gasDetail.getRecentBillChecked()
        );
    }

    private boolean hasCompleteGasQualificationInformation(
            GasDiscountDetail gasDetail
    ) {
        if (gasDetail == null) {
            return false;
        }

        return gasDetail.getSevereDisabilityOrMerit()
                != null
                && gasDetail.getBasicOrNearPoor()
                != null
                && gasDetail.getMultiChildHousehold()
                != null
                && gasDetail.getEnergyVoucherRecipient()
                != null;
    }

    private EnergyVoucherDetail getEnergyVoucherDetail(Long seniorId) {
        if (seniorId == null) return null;
        return energyVoucherDetailRepository
                .findBySeniorId(seniorId)
                .orElse(null);
    }

    private boolean isEnergyVoucherEligible(
            Senior senior,
            EnergyVoucherDetail detail
    ) {
        if (detail == null) {
            return true;
        }

        return !Boolean.FALSE.equals(resolveVoucherIncome(detail))
                && !Boolean.FALSE.equals(
                resolveVoucherHouseholdCharacteristic(detail)
        )
                && !Boolean.TRUE.equals(
                detail.getDuplicateSupportDisqualifying()
        );
    }

    private Boolean resolveVoucherIncome(
            EnergyVoucherDetail detail
    ) {
        return detail == null
                ? null
                : detail.getIncomeCriteriaConfirmed();
    }

    private Boolean resolveVoucherHouseholdCharacteristic(
            EnergyVoucherDetail detail
    ) {
        return detail == null
                ? null
                : detail.getHouseholdCharacteristicConfirmed();
    }

    private void addEnergyVoucherMissingInformation(
            List<String> missing,
            Senior senior,
            EnergyVoucherDetail detail
    ) {
        if (detail == null) {
            missing.add("에너지바우처 상세 정보");
            return;
        }
        if (resolveVoucherIncome(detail) == null) {
            missing.add("소득 기준");
        } else if (Boolean.TRUE.equals(resolveVoucherIncome(detail))
                && isBlank(detail.getLivelihoodBenefitTypes())) {
            missing.add("기초생활수급 종류");
        }
        if (resolveVoucherHouseholdCharacteristic(detail) == null) {
            missing.add("세대원 특성");
        } else if (Boolean.TRUE.equals(
                resolveVoucherHouseholdCharacteristic(detail)
        ) && isBlank(detail.getHouseholdCharacteristics())) {
            missing.add("세대원 특성 상세");
        }
        if (detail.getWinterOtherEnergySupportRecipient() == null) {
            missing.add("중복 지원 여부");
        } else if (Boolean.TRUE.equals(
                detail.getWinterOtherEnergySupportRecipient()
        ) && isBlank(detail.getOtherEnergySupportTypes())) {
            missing.add("중복 에너지 지원명");
        }
        if (Boolean.TRUE.equals(
                detail.getWinterOtherEnergySupportRecipient()
        ) && detail.getDuplicateSupportDisqualifying() == null) {
            missing.add("중복 지원 제한 여부");
        }
    }

    private EnergySupportCase.EligibilityLevel energyVoucherEligibilityLevel(
            Senior senior,
            EnergyVoucherDetail detail
    ) {
        if (detail == null) {
            return EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED;
        }
        Boolean incomeCriteria = resolveVoucherIncome(detail);
        Boolean householdCharacteristic =
                resolveVoucherHouseholdCharacteristic(detail);

        if (Boolean.FALSE.equals(incomeCriteria)
                || Boolean.FALSE.equals(
                householdCharacteristic
        )
                || Boolean.TRUE.equals(
                detail.getDuplicateSupportDisqualifying()
        )) {
            return EnergySupportCase.EligibilityLevel.LOW;
        }
        boolean noDuplicateRestriction =
                Boolean.FALSE.equals(
                        detail.getWinterOtherEnergySupportRecipient()
                )
                        || Boolean.TRUE.equals(
                        detail.getWinterOtherEnergySupportRecipient()
                ) && Boolean.FALSE.equals(
                        detail.getDuplicateSupportDisqualifying()
                );

        if (Boolean.TRUE.equals(incomeCriteria)
                && Boolean.TRUE.equals(
                householdCharacteristic
        )
                && noDuplicateRestriction
                && !isBlank(detail.getLivelihoodBenefitTypes())
                && !isBlank(detail.getHouseholdCharacteristics())) {
            return EnergySupportCase.EligibilityLevel.HIGH;
        }
        return EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED;
    }

    private String energyVoucherEligibilityReason(
            Senior senior,
            EnergyVoucherDetail detail
    ) {
        if (detail == null) {
            return "에너지바우처 상세 정보 확인 필요";
        }
        Boolean incomeCriteria = resolveVoucherIncome(detail);
        Boolean householdCharacteristic =
                resolveVoucherHouseholdCharacteristic(detail);

        if (Boolean.FALSE.equals(incomeCriteria)) {
            return "소득 기준 미충족";
        }
        if (Boolean.FALSE.equals(
                householdCharacteristic
        )) {
            return "세대원 특성 기준 미충족";
        }
        if (Boolean.TRUE.equals(
                detail.getDuplicateSupportDisqualifying()
        )) {
            return "중복 지원으로 신청 불가";
        }
        if (Boolean.TRUE.equals(
                detail.getWinterOtherEnergySupportRecipient()
        )) {
            if (isBlank(detail.getOtherEnergySupportTypes())) {
                return "겨울철 중복 지원 종류 확인 필요";
            }
            return detail.getDuplicateSupportDisqualifying() == null
                    ? "중복 지원 제한 여부 확인 필요: "
                    + detail.getOtherEnergySupportTypes()
                    : "중복 제한 문제 없음: "
                    + detail.getOtherEnergySupportTypes();
        }

        List<String> missing = new ArrayList<>();
        addEnergyVoucherMissingInformation(missing, senior, detail);
        if (!missing.isEmpty()) {
            return missing.get(0) + " 확인 필요";
        }
        return "신청 가능: 소득 기준, 세대원 특성 및 중복 지원 여부 확인됨";
    }

    private ElectricityDiscountDetail getElectricityDetail(Long seniorId) {
        if (seniorId == null) return null;
        return electricityDiscountDetailRepository
                .findBySeniorId(seniorId)
                .orElse(null);
    }

    private boolean hasElectricityWelfareQualification(
            Senior senior,
            ElectricityDiscountDetail detail
    ) {
        Boolean detailEligibility =
                detail == null ? null : detail.getWelfareEligible();
        if (detailEligibility != null) {
            return detailEligibility;
        }

        return Boolean.TRUE.equals(senior.getElectricityDiscountEligible())
                || Boolean.TRUE.equals(senior.getLivelihoodBenefit())
                || Boolean.TRUE.equals(senior.getMedicalBenefit())
                || Boolean.TRUE.equals(senior.getHousingBenefit())
                || Boolean.TRUE.equals(senior.getEducationBenefit())
                || hasDisabilityInformation(senior);
    }

    private boolean hasCompleteElectricityContractInformation(
            ElectricityDiscountDetail detail
    ) {
        if (detail == null
                || !Boolean.TRUE.equals(detail.getUsesElectricity())) {
            return false;
        }

        return !isBlank(detail.getElectricityProvider())
                && !isBlank(detail.getCustomerNumber())
                && !isBlank(detail.getContractorName())
                && detail.getAddressSame() != null
                && (!Boolean.FALSE.equals(detail.getAddressSame())
                || !isBlank(detail.getServiceAddress()))
                && Boolean.TRUE.equals(detail.getRecentBillChecked());
    }

    private void addElectricityMissingInformation(
            List<String> missing,
            Senior senior,
            ElectricityDiscountDetail detail
    ) {
        if (detail == null) {
            missing.add("전기 계약 정보");
            return;
        }
        if (detail.getUsesElectricity() == null) {
            missing.add("전기 사용 여부");
        }
        if (detail.getWelfareEligible() == null
                && senior.getElectricityDiscountEligible() == null
                && !hasElectricityQualificationInformation(senior)) {
            missing.add("전기요금 할인 자격");
        }
        if (Boolean.FALSE.equals(detail.getUsesElectricity())) {
            return;
        }
        if (isBlank(detail.getElectricityProvider())) {
            missing.add("전기 공급사");
        }
        if (isBlank(detail.getCustomerNumber())) {
            missing.add("전기 고객번호");
        }
        if (isBlank(detail.getContractorName())) {
            missing.add("계약자명");
        }
        if (detail.getAddressSame() == null) {
            missing.add("주소 일치 여부");
        } else if (Boolean.FALSE.equals(detail.getAddressSame())
                && isBlank(detail.getServiceAddress())) {
            missing.add("전기 사용 주소");
        }
        if (detail.getRecentBillChecked() == null) {
            missing.add("최근 고지서 확인 여부");
        } else if (Boolean.FALSE.equals(detail.getRecentBillChecked())) {
            missing.add("최근 전기요금 고지서");
        }
    }

    private boolean hasElectricityQualificationInformation(Senior senior) {
        return senior.getLivelihoodBenefit() != null
                || senior.getMedicalBenefit() != null
                || senior.getHousingBenefit() != null
                || senior.getEducationBenefit() != null
                || hasDisabilityInformation(senior);
    }

    private EnergySupportCase.EligibilityLevel electricityEligibilityLevel(
            Senior senior,
            ElectricityDiscountDetail detail
    ) {
        if (Boolean.FALSE.equals(
                detail == null ? null : detail.getUsesElectricity()
        )) {
            return EnergySupportCase.EligibilityLevel.LOW;
        }
        if (hasElectricityWelfareQualification(senior, detail)
                && hasCompleteElectricityContractInformation(detail)) {
            return EnergySupportCase.EligibilityLevel.HIGH;
        }
        if (detail != null
                && Boolean.FALSE.equals(detail.getWelfareEligible())) {
            return EnergySupportCase.EligibilityLevel.LOW;
        }
        if ((detail == null || detail.getWelfareEligible() == null)
                && Boolean.FALSE.equals(senior.getElectricityDiscountEligible())
                && !hasElectricityWelfareQualification(senior, detail)) {
            return EnergySupportCase.EligibilityLevel.LOW;
        }
        return EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED;
    }

    private String electricityEligibilityReason(
            Senior senior,
            ElectricityDiscountDetail detail
    ) {
        if (Boolean.FALSE.equals(
                detail == null ? null : detail.getUsesElectricity()
        )) {
            return "전기 미사용으로 할인 대상이 아닙니다.";
        }
        if (!hasElectricityWelfareQualification(senior, detail)) {
            return "전기요금 할인 복지 자격 확인이 필요합니다.";
        }
        if (detail == null) {
            return "복지 자격 확인됨 · 전기 계약 정보 확인 필요";
        }
        if (isBlank(detail.getCustomerNumber())) {
            return "복지 자격 확인됨 · 전기 고객번호 확인 필요";
        }
        if (isBlank(detail.getContractorName())) {
            return "복지 자격 확인됨 · 계약자명 확인 필요";
        }
        if (detail.getAddressSame() == null) {
            return "복지 자격 확인됨 · 주소 일치 여부 확인 필요";
        }
        if (Boolean.FALSE.equals(detail.getAddressSame())
                && isBlank(detail.getServiceAddress())) {
            return "복지 자격 확인됨 · 전기 사용 주소 확인 필요";
        }
        if (!Boolean.TRUE.equals(detail.getRecentBillChecked())) {
            return "복지 자격 확인됨 · 최근 전기요금 고지서 확인 필요";
        }
        if (!hasCompleteElectricityContractInformation(detail)) {
            return "복지 자격 확인됨 · 전기 계약 정보 추가 확인 필요";
        }
        if (Boolean.FALSE.equals(detail.getAddressSame())) {
            return "전기 사용 주소가 거주 주소와 달라 확인이 필요합니다.";
        }
        return "신청 가능 : 복지 자격 및 전기 계약 정보 확인됨";
    }

    private boolean isBlank(
            String value
    ) {
        return value == null
                || value.isBlank();
    }

    private EnergySupportCase.EligibilityLevel eligibilityLevel(
            Senior senior,
            EnergySupportCase.SupportType type,
            GasDiscountDetail gasDetail
    ) {
        if (type == null) {
            return EnergySupportCase
                    .EligibilityLevel
                    .CONFIRMATION_NEEDED;
        }

        return switch (type) {
            case VOUCHER ->
                    energyVoucherEligibilityLevel(
                            senior,
                            getEnergyVoucherDetail(senior.getId())
                    );

            case ELECTRICITY ->
                    electricityEligibilityLevel(
                            senior,
                            getElectricityDetail(senior.getId())
                    );

            case GAS ->
                    gasEligibilityLevel(
                            senior,
                            gasDetail
                    );
        };
    }

    private EnergySupportCase.EligibilityLevel gasEligibilityLevel(
            Senior senior,
            GasDiscountDetail gasDetail
    ) {
        Boolean cityGasUser =
                isCityGasUser(
                        senior,
                        gasDetail
                );

        boolean welfareQualification =
                hasGasWelfareQualification(
                        senior,
                        gasDetail
                );

        if (
                Boolean.FALSE.equals(
                        cityGasUser
                )
        ) {
            return EnergySupportCase
                    .EligibilityLevel
                    .LOW;
        }

        if (
                Boolean.TRUE.equals(
                        cityGasUser
                )
                        && welfareQualification
                        && hasCompleteGasContractInformation(
                        gasDetail
                )
        ) {
            return EnergySupportCase
                    .EligibilityLevel
                    .HIGH;
        }

        if (
                Boolean.FALSE.equals(
                        senior.getGasDiscountEligible()
                )
                        && !welfareQualification
        ) {
            return EnergySupportCase
                    .EligibilityLevel
                    .LOW;
        }

        return EnergySupportCase
                .EligibilityLevel
                .CONFIRMATION_NEEDED;
    }

    private String buildChangeSummary(
            EnergySupportCase.SupportStatus previousStatus,
            EnergySupportCase.ExistingApplicationStatus previousExistingStatus,
            EnergySupportCase.ApplicationIntent previousApplicationIntent,
            EnergySupportCase.DeclineReason previousDeclineReason,
            String previousContactMethod,
            java.time.LocalDate previousNextActionDate,
            String previousNote,
            EnergySupportCase current
    ) {
        List<String> changes = new ArrayList<>();
        addChange(changes, "진행 상태", previousStatus, current.getStatus());
        addChange(
                changes,
                "기존 신청 여부",
                previousExistingStatus,
                current.getExistingApplicationStatus()
        );
        addChange(
                changes,
                "신청 의사",
                previousApplicationIntent,
                current.getApplicationIntent()
        );
        addChange(
                changes,
                "신청 거절 사유",
                previousDeclineReason,
                current.getDeclineReason()
        );
        addChange(
                changes,
                "상담 방법",
                previousContactMethod,
                current.getContactMethod()
        );
        addChange(
                changes,
                "다음 조치일",
                previousNextActionDate,
                current.getNextActionDate()
        );
        addChange(changes, "메모", previousNote, current.getNote());
        return String.join("\n", changes);
    }

    private void addChange(
            List<String> changes,
            String label,
            Object previous,
            Object current
    ) {
        if (Objects.equals(previous, current)) return;
        changes.add(
                label + ": "
                        + valueOrEmpty(previous)
                        + " → "
                        + valueOrEmpty(current)
        );
    }

    private String valueOrEmpty(Object value) {
        return value == null || value.toString().isBlank()
                ? "없음"
                : value.toString();
    }

    private void normalizeAndValidate(
            EnergySupportCase supportCase
    ) {
        if (
                supportCase.getExistingApplicationStatus()
                        == EnergySupportCase
                        .ExistingApplicationStatus
                        .ALREADY_APPLIED
        ) {
            supportCase.setStatus(
                    EnergySupportCase
                            .SupportStatus
                            .ALREADY_APPLIED
            );

            /*
             * 이미 신청한 경우에는 추가 신청 의사와
             * 다음 조치일이 필요하지 않다.
             */
            supportCase.setApplicationIntent(
                    EnergySupportCase
                            .ApplicationIntent
                            .UNKNOWN
            );

            supportCase.setDeclineReason(null);
            supportCase.setNextActionDate(null);
        }

        if (
                supportCase.getApplicationIntent()
                        == EnergySupportCase
                        .ApplicationIntent
                        .DOES_NOT_WANT
        ) {
            supportCase.setStatus(
                    EnergySupportCase
                            .SupportStatus
                            .DECLINED
            );

            if (supportCase.getDeclineReason() == null) {
                throw new IllegalArgumentException(
                        "신청하지 않는 사유를 선택해 주세요."
                );
            }
        } else {
            supportCase.setDeclineReason(null);
        }

        boolean nextActionRequired =
                supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .CONTACT_SCHEDULED
                        || supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .CONSULTED
                        || supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .DOCUMENTS_PREPARING
                        || supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .APPLICATION_SUPPORTING
                        || supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .UNREACHABLE
                        || supportCase.getApplicationIntent()
                        == EnergySupportCase
                        .ApplicationIntent
                        .DISCUSS_WITH_GUARDIAN
                        || supportCase.getApplicationIntent()
                        == EnergySupportCase
                        .ApplicationIntent
                        .DECIDE_LATER;

        if (
                nextActionRequired
                        && supportCase.getNextActionDate() == null
        ) {
            throw new IllegalArgumentException(
                    "현재 지원 상태에서는 다음 조치일을 입력해야 합니다."
            );
        }

        if (
                supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .NOT_ELIGIBLE
                        && (
                        supportCase.getNote() == null
                                || supportCase.getNote().isBlank()
                )
        ) {
            throw new IllegalArgumentException(
                    "자격 미충족 사유를 메모에 입력해 주세요."
            );
        }

        if (
                supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .APPLICATION_COMPLETED
                        && (
                        supportCase.getNote() == null
                                || supportCase.getNote().isBlank()
                )
        ) {
            throw new IllegalArgumentException(
                    "신청 완료 내용을 메모에 입력해 주세요."
            );
        }

        if (
                supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .DECLINED
                        && (
                        supportCase.getNote() == null
                                || supportCase.getNote().isBlank()
                )
        ) {
            throw new IllegalArgumentException(
                    "거절 또는 보류 사유를 메모에 입력해 주세요."
            );
        }

        boolean completed =
                supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .APPLICATION_COMPLETED
                        || supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .RESULT_CONFIRMED
                        || supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .ALREADY_APPLIED
                        || supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .NOT_ELIGIBLE
                        || supportCase.getStatus()
                        == EnergySupportCase
                        .SupportStatus
                        .DECLINED;

        /*
         * 모든 종료 상태에서는 다음 조치일 제거
         */
        if (completed) {
            supportCase.setNextActionDate(null);
        }
    }

    private boolean hasIncomeInformation(
            Senior senior
    ) {
        if (
                Boolean.TRUE.equals(
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
        ) {
            return true;
        }

        return senior.getLivelihoodBenefit()
                != null
                && senior.getMedicalBenefit()
                != null
                && senior.getHousingBenefit()
                != null
                && senior.getEducationBenefit()
                != null;
    }

    private boolean hasHouseholdInformation(
            Senior senior
    ) {
        if (
                Boolean.TRUE.equals(
                        senior.getElderlyHouseholdMember()
                )
                        || Boolean.TRUE.equals(
                        senior.getInfantHouseholdMember()
                )
                        || Boolean.TRUE.equals(
                        senior.getDisabledHouseholdMember()
                )
                        || Boolean.TRUE.equals(
                        senior.getPregnantHouseholdMember()
                )
                        || Boolean.TRUE.equals(
                        senior.getSevereDiseaseHouseholdMember()
                )
                        || Boolean.TRUE.equals(
                        senior.getRareDiseaseHouseholdMember()
                )
                        || Boolean.TRUE.equals(
                        senior.getIntractableDiseaseHouseholdMember()
                )
                        || Boolean.TRUE.equals(
                        senior.getSingleParentFamily()
                )
                        || Boolean.TRUE.equals(
                        senior.getChildHeadedHousehold()
                )
                        || Boolean.TRUE.equals(
                        senior.getMultiChildHousehold()
                )
        ) {
            return true;
        }

        return senior.getElderlyHouseholdMember()
                != null
                && senior.getInfantHouseholdMember()
                != null
                && senior.getDisabledHouseholdMember()
                != null
                && senior.getPregnantHouseholdMember()
                != null
                && senior.getSevereDiseaseHouseholdMember()
                != null
                && senior.getRareDiseaseHouseholdMember()
                != null
                && senior.getIntractableDiseaseHouseholdMember()
                != null
                && senior.getSingleParentFamily()
                != null
                && senior.getChildHeadedHousehold()
                != null
                && senior.getMultiChildHousehold()
                != null;
    }

    private void synchronizeAppliedStatus(
            Senior senior,
            EnergySupportCase.SupportType type,
            EnergySupportCase.SupportStatus status
    ) {
        boolean applied =
                status
                        == EnergySupportCase
                        .SupportStatus
                        .APPLICATION_COMPLETED
                        || status
                        == EnergySupportCase
                        .SupportStatus
                        .RESULT_CONFIRMED
                        || status
                        == EnergySupportCase
                        .SupportStatus
                        .ALREADY_APPLIED;

        switch (type) {
            case VOUCHER ->
                    senior.setEnergyVoucherApplied(
                            applied
                    );

            case ELECTRICITY ->
                    senior.setElectricityDiscountApplied(
                            applied
                    );

            case GAS ->
                    senior.setGasDiscountApplied(
                            applied
                    );
        }
    }
}
