package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergySupportCaseDto;
import com.nuri.woorilink.dto.EnergySupportActivityDto;
import com.nuri.woorilink.dto.EnergySupportCaseUpdateRequest;
import com.nuri.woorilink.entity.EnergySupportCase;
import com.nuri.woorilink.entity.EnergySupportActivity;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.EnergySupportCaseRepository;
import com.nuri.woorilink.repository.EnergySupportActivityRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.ArrayList;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnergySupportCaseService {

    private final EnergySupportCaseRepository caseRepository;
    private final EnergySupportActivityRepository activityRepository;
    private final SeniorRepository seniorRepository;

    public List<EnergySupportCaseDto> getCandidates(
            Long welfareWorkerId,
            EnergySupportCase.SupportType supportType
    ) {
        return seniorRepository.findByWelfareWorkerId(welfareWorkerId).stream()
                .map(senior -> toCandidate(senior, supportType))
                .filter(candidate -> candidate != null)
                .toList();
    }

    @Transactional
    public EnergySupportCaseDto update(
            Long seniorId,
            EnergySupportCase.SupportType supportType,
            EnergySupportCaseUpdateRequest request
    ) {
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("대상자를 찾을 수 없습니다: " + seniorId));

        EnergySupportCase supportCase = caseRepository
                .findBySeniorIdAndSupportType(seniorId, supportType)
                .orElseGet(() -> EnergySupportCase.builder()
                        .seniorId(seniorId)
                        .supportType(supportType)
                        .build());

        if (request.getStatus() != null) supportCase.setStatus(request.getStatus());
        if (request.getExistingApplicationStatus() != null) {
            supportCase.setExistingApplicationStatus(request.getExistingApplicationStatus());
        }
        if (request.getApplicationIntent() != null) supportCase.setApplicationIntent(request.getApplicationIntent());
        supportCase.setDeclineReason(request.getDeclineReason());
        supportCase.setContactMethod(request.getContactMethod());
        supportCase.setNextActionDate(request.getNextActionDate());
        supportCase.setNote(request.getNote());

        normalizeAndValidate(supportCase);

        applyCompletedStatus(senior, supportType, supportCase.getStatus());
        seniorRepository.save(senior);
        EnergySupportCase saved = caseRepository.save(supportCase);
        activityRepository.save(EnergySupportActivity.builder()
                .caseId(saved.getId())
                .seniorId(seniorId)
                .supportType(supportType)
                .status(saved.getStatus())
                .contactMethod(saved.getContactMethod())
                .nextActionDate(saved.getNextActionDate())
                .note(saved.getNote())
                .build());
        return toDto(senior, saved, supportType);
    }

    private EnergySupportCaseDto toCandidate(Senior senior, EnergySupportCase.SupportType type) {
        EnergySupportCase existing = caseRepository.findBySeniorIdAndSupportType(senior.getId(), type)
                .orElse(null);
        boolean possible = isEligibilityPossible(senior, type);
        boolean applicationUnconfirmed = !isApplied(senior, type);

        if (existing == null && (!possible || !applicationUnconfirmed)) return null;
        return toDto(senior, existing, type);
    }

    private EnergySupportCaseDto toDto(
            Senior senior,
            EnergySupportCase supportCase,
            EnergySupportCase.SupportType type
    ) {
        return new EnergySupportCaseDto(
                supportCase != null ? supportCase.getId() : null,
                senior.getId(),
                senior.getName(),
                senior.getAge(),
                senior.getAddress(),
                senior.getIncomeLevel(),
                senior.getDisabilityGrade(),
                type,
                isEligibilityPossible(senior, type),
                eligibilityLevel(senior, type),
                eligibilityReason(senior, type),
                missingInformation(senior, type, supportCase),
                supportCase != null && supportCase.getExistingApplicationStatus() != null
                        ? supportCase.getExistingApplicationStatus()
                        : EnergySupportCase.ExistingApplicationStatus.UNKNOWN,
                supportCase != null && supportCase.getApplicationIntent() != null
                        ? supportCase.getApplicationIntent()
                        : EnergySupportCase.ApplicationIntent.UNKNOWN,
                supportCase != null ? supportCase.getDeclineReason() : null,
                supportCase != null ? supportCase.getStatus()
                        : EnergySupportCase.SupportStatus.CONFIRMATION_NEEDED,
                supportCase != null ? supportCase.getContactMethod() : null,
                supportCase != null ? supportCase.getNextActionDate() : null,
                supportCase != null ? supportCase.getNote() : null,
                supportCase != null ? supportCase.getUpdatedAt() : null,
                activityRepository.findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(senior.getId(), type)
                        .stream()
                        .map(activity -> new EnergySupportActivityDto(
                                activity.getId(), activity.getStatus(), activity.getContactMethod(),
                                activity.getNextActionDate(), activity.getNote(), activity.getCreatedAt()))
                        .toList()
        );
    }

    private boolean isEligibilityPossible(Senior senior, EnergySupportCase.SupportType type) {
        if (type == EnergySupportCase.SupportType.VOUCHER) {
            return Boolean.TRUE.equals(senior.getEnergyVoucherEligible());
        }
        return Boolean.TRUE.equals(senior.getElectricityDiscountEligible())
                || Boolean.TRUE.equals(senior.getLivelihoodBenefit())
                || Boolean.TRUE.equals(senior.getMedicalBenefit())
                || Boolean.TRUE.equals(senior.getHousingBenefit())
                || Boolean.TRUE.equals(senior.getEducationBenefit())
                || (senior.getDisabilityGrade() != null && !senior.getDisabilityGrade().isBlank());
    }

    private boolean isApplied(Senior senior, EnergySupportCase.SupportType type) {
        return type == EnergySupportCase.SupportType.VOUCHER
                ? Boolean.TRUE.equals(senior.getEnergyVoucherApplied())
                : Boolean.TRUE.equals(senior.getElectricityDiscountApplied());
    }

    private String eligibilityReason(Senior senior, EnergySupportCase.SupportType type) {
        if (type == EnergySupportCase.SupportType.VOUCHER) {
            return senior.getEnergyVoucherReason() != null
                    ? senior.getEnergyVoucherReason()
                    : "소득·세대원 특성과 기존 신청 여부 확인 필요";
        }
        return "할인 유형, 전기 계약 정보와 기존 할인 적용 여부 확인 필요";
    }

    private List<String> missingInformation(
            Senior senior,
            EnergySupportCase.SupportType type,
            EnergySupportCase supportCase
    ) {
        List<String> missing = new ArrayList<>();
        if (type == EnergySupportCase.SupportType.VOUCHER) {
            if (!hasIncomeInformation(senior)) missing.add("소득");
            if (!hasHouseholdInformation(senior)) missing.add("세대원 특성");
        } else {
            if (senior.getElectricityDiscountEligible() == null) missing.add("할인 유형");
            missing.add("전기 계약 정보");
        }
        if (supportCase == null
                || supportCase.getExistingApplicationStatus() == null
                || supportCase.getExistingApplicationStatus() == EnergySupportCase.ExistingApplicationStatus.UNKNOWN) {
            missing.add("기존 신청 여부");
        }
        return missing;
    }

    private EnergySupportCase.EligibilityLevel eligibilityLevel(
            Senior senior,
            EnergySupportCase.SupportType type
    ) {
        if (type == EnergySupportCase.SupportType.VOUCHER) {
            String reason = senior.getEnergyVoucherReason();
            if (Boolean.TRUE.equals(senior.getEnergyVoucherEligible())
                    || (reason != null && reason.contains("신청 가능"))) {
                return EnergySupportCase.EligibilityLevel.HIGH;
            }
            if (reason != null && (reason.contains("미충족") || reason.contains("신청 불가"))) {
                return EnergySupportCase.EligibilityLevel.LOW;
            }
            return EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED;
        }
        if (Boolean.TRUE.equals(senior.getElectricityDiscountEligible()) || isEligibilityPossible(senior, type)) {
            return EnergySupportCase.EligibilityLevel.HIGH;
        }
        if (Boolean.FALSE.equals(senior.getElectricityDiscountEligible())) return EnergySupportCase.EligibilityLevel.LOW;
        return EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED;
    }

    private void normalizeAndValidate(EnergySupportCase supportCase) {
        if (supportCase.getExistingApplicationStatus() == EnergySupportCase.ExistingApplicationStatus.ALREADY_APPLIED) {
            supportCase.setStatus(EnergySupportCase.SupportStatus.ALREADY_APPLIED);
        }
        if (supportCase.getApplicationIntent() == EnergySupportCase.ApplicationIntent.DOES_NOT_WANT) {
            supportCase.setStatus(EnergySupportCase.SupportStatus.DECLINED);
            if (supportCase.getDeclineReason() == null) {
                throw new IllegalArgumentException("신청하지 않는 사유를 선택해 주세요.");
            }
        } else {
            supportCase.setDeclineReason(null);
        }

        boolean nextActionRequired = supportCase.getStatus() == EnergySupportCase.SupportStatus.CONTACT_SCHEDULED
                || supportCase.getStatus() == EnergySupportCase.SupportStatus.CONSULTED
                || supportCase.getStatus() == EnergySupportCase.SupportStatus.DOCUMENTS_PREPARING
                || supportCase.getStatus() == EnergySupportCase.SupportStatus.APPLICATION_SUPPORTING
                || supportCase.getStatus() == EnergySupportCase.SupportStatus.UNREACHABLE
                || supportCase.getApplicationIntent() == EnergySupportCase.ApplicationIntent.DECIDE_LATER;
        if (nextActionRequired && supportCase.getNextActionDate() == null) {
            throw new IllegalArgumentException("현재 지원 상태에서는 다음 조치일을 입력해야 합니다.");
        }
        if (supportCase.getStatus() == EnergySupportCase.SupportStatus.NOT_ELIGIBLE
                && (supportCase.getNote() == null || supportCase.getNote().isBlank())) {
            throw new IllegalArgumentException("자격 미충족 사유를 메모에 입력해 주세요.");
        }

        boolean completed = supportCase.getStatus() == EnergySupportCase.SupportStatus.APPLICATION_COMPLETED
                || supportCase.getStatus() == EnergySupportCase.SupportStatus.RESULT_CONFIRMED
                || supportCase.getStatus() == EnergySupportCase.SupportStatus.ALREADY_APPLIED
                || supportCase.getStatus() == EnergySupportCase.SupportStatus.NOT_ELIGIBLE
                || supportCase.getStatus() == EnergySupportCase.SupportStatus.DECLINED;
        if (completed) supportCase.setNextActionDate(null);
    }

    private boolean hasIncomeInformation(Senior senior) {
        if (Boolean.TRUE.equals(senior.getLivelihoodBenefit())
                || Boolean.TRUE.equals(senior.getMedicalBenefit())
                || Boolean.TRUE.equals(senior.getHousingBenefit())
                || Boolean.TRUE.equals(senior.getEducationBenefit())) return true;
        return senior.getLivelihoodBenefit() != null
                && senior.getMedicalBenefit() != null
                && senior.getHousingBenefit() != null
                && senior.getEducationBenefit() != null;
    }

    private boolean hasHouseholdInformation(Senior senior) {
        if (Boolean.TRUE.equals(senior.getElderlyHouseholdMember())
                || Boolean.TRUE.equals(senior.getInfantHouseholdMember())
                || Boolean.TRUE.equals(senior.getDisabledHouseholdMember())
                || Boolean.TRUE.equals(senior.getPregnantHouseholdMember())
                || Boolean.TRUE.equals(senior.getSevereDiseaseHouseholdMember())
                || Boolean.TRUE.equals(senior.getRareDiseaseHouseholdMember())
                || Boolean.TRUE.equals(senior.getIntractableDiseaseHouseholdMember())
                || Boolean.TRUE.equals(senior.getSingleParentFamily())
                || Boolean.TRUE.equals(senior.getChildHeadedHousehold())
                || Boolean.TRUE.equals(senior.getMultiChildHousehold())) return true;
        return senior.getElderlyHouseholdMember() != null
                && senior.getInfantHouseholdMember() != null
                && senior.getDisabledHouseholdMember() != null
                && senior.getPregnantHouseholdMember() != null
                && senior.getSevereDiseaseHouseholdMember() != null
                && senior.getRareDiseaseHouseholdMember() != null
                && senior.getIntractableDiseaseHouseholdMember() != null
                && senior.getSingleParentFamily() != null
                && senior.getChildHeadedHousehold() != null
                && senior.getMultiChildHousehold() != null;
    }

    private void applyCompletedStatus(
            Senior senior,
            EnergySupportCase.SupportType type,
            EnergySupportCase.SupportStatus status
    ) {
        boolean applied = status == EnergySupportCase.SupportStatus.APPLICATION_COMPLETED
                || status == EnergySupportCase.SupportStatus.RESULT_CONFIRMED
                || status == EnergySupportCase.SupportStatus.ALREADY_APPLIED;
        if (!applied) return;

        if (type == EnergySupportCase.SupportType.VOUCHER) {
            senior.setEnergyVoucherApplied(true);
        } else {
            senior.setElectricityDiscountApplied(true);
        }
    }
}
