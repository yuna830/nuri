package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergySupportProfileDto;
import com.nuri.woorilink.dto.EnergySupportProfileRequest;
import com.nuri.woorilink.entity.EnergySupportProfile;
import com.nuri.woorilink.repository.EnergySupportProfileRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnergySupportProfileService {

    private final EnergySupportProfileRepository profileRepository;
    private final SeniorRepository seniorRepository;

    public EnergySupportProfileDto getBySeniorId(Long seniorId) {
        validateSenior(seniorId);
        return profileRepository.findBySeniorId(seniorId)
                .map(EnergySupportProfileDto::from)
                .orElse(null);
    }

    @Transactional
    public EnergySupportProfileDto saveOrUpdate(
            Long seniorId,
            EnergySupportProfileRequest request
    ) {
        validateSenior(seniorId);
        if (request == null) {
            throw new IllegalArgumentException("공통 에너지복지 정보가 필요합니다.");
        }
        if (request.getHouseholdSize() != null
                && request.getHouseholdSize() < 1) {
            throw new IllegalArgumentException("세대원 수는 1명 이상이어야 합니다.");
        }

        EnergySupportProfile profile = profileRepository
                .findBySeniorId(seniorId)
                .orElseGet(() -> EnergySupportProfile.builder()
                        .seniorId(seniorId)
                        .build());

        profile.setBasicLivelihoodRecipient(
                request.getBasicLivelihoodRecipient());
        profile.setNearPoverty(request.getNearPoverty());
        profile.setDisabledHousehold(request.getDisabledHousehold());
        profile.setNationalMeritHousehold(request.getNationalMeritHousehold());
        profile.setSeniorHousehold(request.getSeniorHousehold());
        profile.setInfantHousehold(request.getInfantHousehold());
        profile.setPregnantHousehold(request.getPregnantHousehold());
        profile.setSingleParentHousehold(request.getSingleParentHousehold());
        profile.setMultiChildHousehold(request.getMultiChildHousehold());
        profile.setHouseholdSize(request.getHouseholdSize());
        profile.setEnergyVoucherRecipient(request.getEnergyVoucherRecipient());
        profile.setHeatingEnergyType(trimToNull(request.getHeatingEnergyType()));
        profile.setUpdatedByRole(request.getUpdatedByRole());
        profile.setUpdatedById(request.getUpdatedById());

        return EnergySupportProfileDto.from(profileRepository.save(profile));
    }

    private void validateSenior(Long seniorId) {
        if (seniorId == null || !seniorRepository.existsById(seniorId)) {
            throw new IllegalArgumentException(
                    "대상자를 찾을 수 없습니다: " + seniorId);
        }
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
