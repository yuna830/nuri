package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergyVoucherResult;
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
        return seniorRepository
                .findByEnergyVoucherEligibleTrueAndEnergyVoucherAppliedFalseOrEnergyVoucherEligibleTrueAndEnergyVoucherAppliedIsNull();
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
        if (req.getIncomeLevel() != null) senior.setIncomeLevel(req.getIncomeLevel());
        if (req.getDisabilityGrade() != null) senior.setDisabilityGrade(req.getDisabilityGrade());

        if (req.getEnergyVoucherApplied() != null) {
            senior.setEnergyVoucherApplied(req.getEnergyVoucherApplied());
        }
        if (req.getElectricityDiscountApplied() != null) {
            senior.setElectricityDiscountApplied(req.getElectricityDiscountApplied());
        }
        if (req.getGasDiscountApplied() != null) {
            senior.setGasDiscountApplied(req.getGasDiscountApplied());
        }

        if (req.getPregnant() != null) senior.setPregnant(req.getPregnant());
        if (req.getSevereDisease() != null) senior.setSevereDisease(req.getSevereDisease());
        if (req.getRareDisease() != null) senior.setRareDisease(req.getRareDisease());
        if (req.getSingleParentFamily() != null) senior.setSingleParentFamily(req.getSingleParentFamily());
        if (req.getChildHeadedHousehold() != null) senior.setChildHeadedHousehold(req.getChildHeadedHousehold());
        if (req.getMultiChildHousehold() != null) senior.setMultiChildHousehold(req.getMultiChildHousehold());

        applyEnergyVoucherEligibility(senior);
        return seniorRepository.save(senior);
    }

    @Transactional
    public void delete(Long id) {
        seniorRepository.deleteById(id);
    }

    private void applyEnergyVoucherEligibility(Senior senior) {
        EnergyVoucherResult result = energyVoucherEligibilityService.evaluate(senior);
        senior.setEnergyVoucherEligible(result.eligible());
        senior.setEnergyVoucherReason(result.reason());
    }

    private String normalizePhone(String phone) {
        return phone == null ? null : phone.replaceAll("\\D", "");
    }
}