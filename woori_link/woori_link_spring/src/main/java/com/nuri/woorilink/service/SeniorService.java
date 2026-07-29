package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.EnergyVoucherEvaluationResult;
import com.nuri.woorilink.dto.SeniorProfileUpdateRequest;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SeniorService {

    private final SeniorRepository seniorRepository;
    private final EnergyVoucherEligibilityService energyVoucherEligibilityService;
    private final SeniorAccessService seniorAccessService;

    public List<Senior> getAll() {
        return seniorRepository.findAll();
    }

    public Senior getById(Long id) {
        return seniorRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("님을 찾을 수 없습니다: " + id));
    }

    public List<Senior> getByGuardian(Long guardianId) {
        return seniorRepository.findByGuardianId(guardianId);
    }

    public List<Senior> getByWelfareWorker(Long welfareWorkerId) {
        return seniorRepository.findByWelfareWorkerId(welfareWorkerId);
    }

    public List<Senior> getVoucherUnapplied() {
        return seniorRepository.findEnergyVoucherUnappliedTargets();
    }

    @Transactional
    public Senior create(Senior senior) {
        senior.setPhone(normalizePhone(senior.getPhone()));
        applyEnergyVoucherEligibility(senior);
        return seniorRepository.save(senior);
    }

    @Transactional
    public Senior update(Long id, Senior req) {
        Senior senior = getById(id);

        if (req.getName() != null) {
            senior.setName(req.getName());
        }
        if (req.getBirthDate() != null) {
            senior.setBirthDate(req.getBirthDate());
        }
        if (req.getAddress() != null) {
            senior.setAddress(req.getAddress());
        }
        if (req.getLatitude() != null) {
            senior.setLatitude(req.getLatitude());
        }
        if (req.getLongitude() != null) {
            senior.setLongitude(req.getLongitude());
        }
        if (req.getPhone() != null) {
            senior.setPhone(normalizePhone(req.getPhone()));
        }
        if (req.getGender() != null) {
            senior.setGender(req.getGender());
        }
        if (req.getIncomeLevel() != null) {
            senior.setIncomeLevel(req.getIncomeLevel());
        }
        if (req.getDisabilityGrade() != null) {
            senior.setDisabilityGrade(req.getDisabilityGrade());
        }
        if (req.getLongTermCare() != null) {
            senior.setLongTermCare(req.getLongTermCare());
        }
        if (req.getLivingAlone() != null) {
            senior.setLivingAlone(req.getLivingAlone());
        }
        if (req.getHouseholdType() != null) {
            senior.setHouseholdType(req.getHouseholdType());
        }
        if (req.getGasType() != null) {
            senior.setGasType(req.getGasType());
        }
        if (req.getHousingType() != null) {
            senior.setHousingType(req.getHousingType());
        }

        if (req.getEnergyVoucherApplied() != null) {
            senior.setEnergyVoucherApplied(req.getEnergyVoucherApplied());
        }
        if (req.getElectricityDiscountApplied() != null) {
            senior.setElectricityDiscountApplied(
                    req.getElectricityDiscountApplied()
            );
        }
        if (req.getGasDiscountApplied() != null) {
            senior.setGasDiscountApplied(req.getGasDiscountApplied());
        }
        if (req.getElectricityDiscountEligible() != null) {
            senior.setElectricityDiscountEligible(req.getElectricityDiscountEligible());
        }
        if (req.getGasDiscountEligible() != null) {
            senior.setGasDiscountEligible(req.getGasDiscountEligible());
        }
        if (req.getAiCheckStatus() != null) {
            senior.setAiCheckStatus(req.getAiCheckStatus());
        }
        if (req.getAiConsecutiveNoResponse() != null) {
            senior.setAiConsecutiveNoResponse(req.getAiConsecutiveNoResponse());
        }
        if (req.getAiCheckResolved() != null) {
            senior.setAiCheckResolved(req.getAiCheckResolved());
        }
        if (req.getLocationStatus() != null) {
            senior.setLocationStatus(req.getLocationStatus());
        }
        if (req.getUnresolvedGeofenceExit() != null) {
            senior.setUnresolvedGeofenceExit(req.getUnresolvedGeofenceExit());
        }
        if (req.getLocationEventResolved() != null) {
            senior.setLocationEventResolved(req.getLocationEventResolved());
        }

        if (req.getLivelihoodBenefit() != null) {
            senior.setLivelihoodBenefit(req.getLivelihoodBenefit());
        }
        if (req.getMedicalBenefit() != null) {
            senior.setMedicalBenefit(req.getMedicalBenefit());
        }
        if (req.getHousingBenefit() != null) {
            senior.setHousingBenefit(req.getHousingBenefit());
        }
        if (req.getEducationBenefit() != null) {
            senior.setEducationBenefit(req.getEducationBenefit());
        }

        if (req.getElderlyHouseholdMember() != null) {
            senior.setElderlyHouseholdMember(
                    req.getElderlyHouseholdMember()
            );
        }
        if (req.getInfantHouseholdMember() != null) {
            senior.setInfantHouseholdMember(
                    req.getInfantHouseholdMember()
            );
        }
        if (req.getDisabledHouseholdMember() != null) {
            senior.setDisabledHouseholdMember(
                    req.getDisabledHouseholdMember()
            );
        }
        if (req.getPregnantHouseholdMember() != null) {
            senior.setPregnantHouseholdMember(
                    req.getPregnantHouseholdMember()
            );
        }
        if (req.getSevereDiseaseHouseholdMember() != null) {
            senior.setSevereDiseaseHouseholdMember(
                    req.getSevereDiseaseHouseholdMember()
            );
        }
        if (req.getRareDiseaseHouseholdMember() != null) {
            senior.setRareDiseaseHouseholdMember(
                    req.getRareDiseaseHouseholdMember()
            );
        }
        if (req.getIntractableDiseaseHouseholdMember() != null) {
            senior.setIntractableDiseaseHouseholdMember(
                    req.getIntractableDiseaseHouseholdMember()
            );
        }
        if (req.getSingleParentFamily() != null) {
            senior.setSingleParentFamily(req.getSingleParentFamily());
        }
        if (req.getChildHeadedHousehold() != null) {
            senior.setChildHeadedHousehold(
                    req.getChildHeadedHousehold()
            );
        }
        if (req.getMultiChildHousehold() != null) {
            senior.setMultiChildHousehold(req.getMultiChildHousehold());
        }

        if (req.getAllMembersInFacility() != null) {
            senior.setAllMembersInFacility(
                    req.getAllMembersInFacility()
            );
        }
        if (req.getWinterFuelSupport() != null) {
            senior.setWinterFuelSupport(req.getWinterFuelSupport());
        }
        if (req.getCoalCoupon() != null) {
            senior.setCoalCoupon(req.getCoalCoupon());
        }
        if (req.getCoalEnergyVoucher() != null) {
            senior.setCoalEnergyVoucher(req.getCoalEnergyVoucher());
        }
        if (req.getWelfareWorkerId() != null) {
            senior.setWelfareWorkerId(req.getWelfareWorkerId());
        }
        if (req.getRecallReminderEnabled() != null) {
            senior.setRecallReminderEnabled(req.getRecallReminderEnabled());
        }
        if (req.getScheduleReminderEnabled() != null) {
            senior.setScheduleReminderEnabled(req.getScheduleReminderEnabled());
        }
        if (req.getChatbotVoiceEnabled() != null) {
            senior.setChatbotVoiceEnabled(req.getChatbotVoiceEnabled());
        }

        applyEnergyVoucherEligibility(senior);
        return seniorRepository.save(senior);
    }

    public List<Senior> search(String name, String phone) {
        return seniorRepository.findByNameContainingAndPhone(
                name,
                normalizePhone(phone)
        );
    }

    @Transactional
    public Senior connectGuardian(Long guardianId, String name, String phone) {
        if (guardianId == null || name == null || name.isBlank() || phone == null || phone.isBlank()) {
            throw new IllegalArgumentException("님 이름과 전화번호를 모두 입력해 주세요.");
        }

        Senior senior = seniorRepository.findFirstByPhoneAndName(
                normalizePhone(phone),
                name.trim()
        ).orElseThrow(() -> new IllegalArgumentException("입력한 정보와 일치하는 님을 찾을 수 없습니다."));

        if (senior.getGuardianId() != null && !guardianId.equals(senior.getGuardianId())) {
            throw new IllegalArgumentException("이미 다른 보호자와 연결된 님입니다.");
        }

        senior.setGuardianId(guardianId);
        senior.setGuardianLinkedAt(java.time.LocalDateTime.now());
        return seniorRepository.save(senior);
    }

    @Transactional
    public Senior updateProfile(Long id, SeniorProfileUpdateRequest req) {
        Senior senior = getById(id);

        if (req.getBirthDate() != null && req.getBirthDate().isAfter(java.time.LocalDate.now())) {
            throw new IllegalArgumentException("생년월일은 미래 날짜일 수 없습니다.");
        }
        validateIncomeBenefits(req);

        senior.setName(req.getName());
        senior.setBirthDate(req.getBirthDate());
        senior.setGender(blankToNull(req.getGender()));
        senior.setPhone(normalizePhone(req.getPhone()));
        senior.setAddress(blankToNull(req.getAddress()));
        senior.setDetailAddress(blankToNull(req.getDetailAddress()));
        senior.setGuardianId(req.getGuardianId());
        senior.setHouseholdType(blankToNull(req.getHouseholdType()));
        senior.setHousingType(blankToNull(req.getHousingType()));
        senior.setLivingAlone(req.getLivingAlone());
        senior.setDisabilityGrade(blankToNull(req.getDisabilityGrade()));
        senior.setLongTermCare(req.getLongTermCare());
        senior.setIncomeLevel(req.getIncomeLevel());
        senior.setLivelihoodBenefit(req.getLivelihoodBenefit());
        senior.setMedicalBenefit(req.getMedicalBenefit());
        senior.setHousingBenefit(req.getHousingBenefit());
        senior.setEducationBenefit(req.getEducationBenefit());
        senior.setEnergyVoucherEligible(req.getEnergyVoucherEligible());
        senior.setEnergyVoucherApplied(Boolean.TRUE.equals(req.getEnergyVoucherEligible()) ? req.getEnergyVoucherApplied() : null);
        senior.setElectricityDiscountEligible(req.getElectricityDiscountEligible());
        senior.setElectricityDiscountApplied(Boolean.TRUE.equals(req.getElectricityDiscountEligible()) ? req.getElectricityDiscountApplied() : null);
        senior.setGasDiscountEligible(req.getGasDiscountEligible());
        senior.setGasDiscountApplied(Boolean.TRUE.equals(req.getGasDiscountEligible()) ? req.getGasDiscountApplied() : null);

        return seniorRepository.save(senior);
    }

    private void validateIncomeBenefits(SeniorProfileUpdateRequest req) {
        if (req.getIncomeLevel() == null || req.getIncomeLevel() == Senior.IncomeLevel.NONE) return;
        boolean matches = switch (req.getIncomeLevel()) {
            case LIVELIHOOD -> Boolean.TRUE.equals(req.getLivelihoodBenefit());
            case MEDICAL -> Boolean.TRUE.equals(req.getMedicalBenefit());
            case HOUSING -> Boolean.TRUE.equals(req.getHousingBenefit());
            case EDUCATION -> Boolean.TRUE.equals(req.getEducationBenefit());
            case NONE -> true;
        };
        if (!matches) throw new IllegalArgumentException("소득구분과 급여 여부가 일치하지 않습니다.");
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Transactional
    public void delete(Long id) {
        seniorRepository.deleteById(id);
    }

    private void applyEnergyVoucherEligibility(Senior senior) {
        EnergyVoucherEvaluationResult result =
                energyVoucherEligibilityService.evaluate(senior);

        senior.setEnergyVoucherEligible(result.eligible());
        senior.setEnergyVoucherReason(result.reason());
    }

    private String normalizePhone(String phone) {
        return phone == null ? null : phone.replaceAll("\\D", "");
    }

    @Transactional
    public void disconnectGuardian(AuthenticatedUser user, Long seniorId) {
        Senior senior = seniorAccessService.requireGuardianSenior(user, seniorId);

        senior.setGuardianId(null);
        senior.setGuardianRelationship(null);
        senior.setGuardianLinkedAt(null);
        seniorRepository.save(senior);
    }
}
