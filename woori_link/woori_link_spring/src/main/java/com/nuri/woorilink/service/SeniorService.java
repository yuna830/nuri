package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergyVoucherEvaluationResult;
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

    public List<Senior> getAll() {
        return seniorRepository.findAll();
    }

    public Senior getById(Long id) {
        return seniorRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("어르신을 찾을 수 없습니다: " + id));
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

        if (req.getName() != null) senior.setName(req.getName());
        if (req.getAge() != null) senior.setAge(req.getAge());
        if (req.getAddress() != null) senior.setAddress(req.getAddress());
        if (req.getLatitude() != null) senior.setLatitude(req.getLatitude());
        if (req.getLongitude() != null) senior.setLongitude(req.getLongitude());
        if (req.getPhone() != null) senior.setPhone(normalizePhone(req.getPhone()));
        if (req.getGender() != null) senior.setGender(req.getGender());
        if (req.getIncomeLevel() != null) senior.setIncomeLevel(req.getIncomeLevel());
        if (req.getDisabilityGrade() != null) senior.setDisabilityGrade(req.getDisabilityGrade());
        if (req.getLongTermCare() != null) senior.setLongTermCare(req.getLongTermCare());
        if (req.getLivingAlone() != null) senior.setLivingAlone(req.getLivingAlone());
        if (req.getHouseholdType() != null) senior.setHouseholdType(req.getHouseholdType());
        if (req.getGasType() != null) senior.setGasType(req.getGasType());
        if (req.getHousingType() != null) senior.setHousingType(req.getHousingType());

        if (req.getEnergyVoucherApplied() != null) {
            senior.setEnergyVoucherApplied(req.getEnergyVoucherApplied());
        }
        if (req.getElectricityDiscountApplied() != null) {
            senior.setElectricityDiscountApplied(req.getElectricityDiscountApplied());
        }
        if (req.getGasDiscountApplied() != null) {
            senior.setGasDiscountApplied(req.getGasDiscountApplied());
        }

        if (req.getLivelihoodBenefit() != null) senior.setLivelihoodBenefit(req.getLivelihoodBenefit());
        if (req.getMedicalBenefit() != null) senior.setMedicalBenefit(req.getMedicalBenefit());
        if (req.getHousingBenefit() != null) senior.setHousingBenefit(req.getHousingBenefit());
        if (req.getEducationBenefit() != null) senior.setEducationBenefit(req.getEducationBenefit());

        if (req.getElderlyHouseholdMember() != null) {
            senior.setElderlyHouseholdMember(req.getElderlyHouseholdMember());
        }
        if (req.getInfantHouseholdMember() != null) {
            senior.setInfantHouseholdMember(req.getInfantHouseholdMember());
        }
        if (req.getDisabledHouseholdMember() != null) {
            senior.setDisabledHouseholdMember(req.getDisabledHouseholdMember());
        }
        if (req.getPregnantHouseholdMember() != null) {
            senior.setPregnantHouseholdMember(req.getPregnantHouseholdMember());
        }
        if (req.getSevereDiseaseHouseholdMember() != null) {
            senior.setSevereDiseaseHouseholdMember(req.getSevereDiseaseHouseholdMember());
        }
        if (req.getRareDiseaseHouseholdMember() != null) {
            senior.setRareDiseaseHouseholdMember(req.getRareDiseaseHouseholdMember());
        }
        if (req.getIntractableDiseaseHouseholdMember() != null) {
            senior.setIntractableDiseaseHouseholdMember(req.getIntractableDiseaseHouseholdMember());
        }
        if (req.getSingleParentFamily() != null) {
            senior.setSingleParentFamily(req.getSingleParentFamily());
        }
        if (req.getChildHeadedHousehold() != null) {
            senior.setChildHeadedHousehold(req.getChildHeadedHousehold());
        }
        if (req.getMultiChildHousehold() != null) {
            senior.setMultiChildHousehold(req.getMultiChildHousehold());
        }

        if (req.getAllMembersInFacility() != null) {
            senior.setAllMembersInFacility(req.getAllMembersInFacility());
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

        applyEnergyVoucherEligibility(senior);
        return seniorRepository.save(senior);
    }

    @Transactional
    public void delete(Long id) {
        seniorRepository.deleteById(id);
    }

    private void applyEnergyVoucherEligibility(Senior senior) {
        EnergyVoucherEvaluationResult result = energyVoucherEligibilityService.evaluate(senior);
        senior.setEnergyVoucherEligible(result.eligible());
        senior.setEnergyVoucherReason(result.reason());
    }

    private String normalizePhone(String phone) {
        return phone == null ? null : phone.replaceAll("\\D", "");
    }
}