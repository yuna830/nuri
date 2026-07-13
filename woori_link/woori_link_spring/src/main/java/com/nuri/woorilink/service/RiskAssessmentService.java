package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import com.nuri.woorilink.dto.RiskAssessmentDto;
import com.nuri.woorilink.entity.RiskAssessment;
import com.nuri.woorilink.repository.RiskAssessmentRepository;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.common.client.WeatherAlertApiClient;
import com.nuri.woorilink.entity.CareEvent;
import com.nuri.woorilink.repository.CareEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RiskAssessmentService {

    private final RiskAssessmentRepository riskRepository;
    private final SeniorRepository seniorRepository;
    private final RegisteredProductRepository productRepository;
    private final WeatherAlertApiClient weatherAlertApiClient;
    private final CareEventRepository careEventRepository;

    public Optional<RiskAssessmentDto> getLatest(Long seniorId) {
        return riskRepository.findTopBySeniorIdOrderByAssessedAtDesc(seniorId)
                .map(this::toDto);
    }

    public List<RiskAssessmentDto> getHighRisk() {
        return riskRepository.findByLevel(RiskAssessment.RiskLevel.HIGH).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public RiskAssessmentDto assess(Long seniorId) {
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("어르신을 찾을 수 없습니다: " + seniorId));

        List<RegisteredProduct> products = productRepository.findBySeniorId(seniorId);
        boolean recallRisk = products.stream()
                .anyMatch(p -> p.getRecallStatus() == RegisteredProduct.RecallStatus.RECALLED);
        boolean voucherUnapplied = !Boolean.TRUE.equals(senior.getEnergyVoucherApplied())
                && isEnergyVoucherEligible(senior);
        boolean weatherRisk = weatherAlertApiClient.hasWeatherAlert(senior.getAddress());
        boolean fallRisk = careEventRepository.existsBySeniorIdAndTypeAndStatus(seniorId, CareEvent.EventType.FALL_DETECTED, CareEvent.EventStatus.PENDING);
        boolean sosRisk = careEventRepository.existsBySeniorIdAndTypeAndStatus(seniorId, CareEvent.EventType.SOS, CareEvent.EventStatus.PENDING);
        boolean checkInRisk = careEventRepository.existsBySeniorIdAndTypeAndStatus(seniorId, CareEvent.EventType.CHECK_IN_MISSED, CareEvent.EventStatus.PENDING);
        boolean safetyZoneRisk = careEventRepository.existsBySeniorIdAndTypeAndStatus(seniorId, CareEvent.EventType.SAFETY_RADIUS_EXIT, CareEvent.EventStatus.PENDING);

        int score = 0;
        List<String> reasons = new ArrayList<>();
        if (fallRisk) { score += 60; reasons.add("Fall detected"); }
        if (sosRisk) { score += 80; reasons.add("SOS requested"); }
        if (checkInRisk) { score += 30; reasons.add("Check-in missed"); }
        if (safetyZoneRisk) { score += 30; reasons.add("Safety zone exited"); }
        if (weatherRisk)      { score += 40; reasons.add("기상특보 발생 지역"); }
        if (recallRisk)       { score += 40; reasons.add("미조치 리콜 제품 보유"); }
        if (voucherUnapplied) { score += 20; reasons.add("에너지바우처 미신청"); }

        RiskAssessment.RiskLevel level = score >= 60 ? RiskAssessment.RiskLevel.HIGH
                : score >= 20 ? RiskAssessment.RiskLevel.MEDIUM : RiskAssessment.RiskLevel.LOW;

        RiskAssessment saved = riskRepository.save(RiskAssessment.builder()
                .seniorId(seniorId)
                .totalScore(score)
                .level(level)
                .weatherRisk(weatherRisk)
                .recallRisk(recallRisk)
                .voucherUnapplied(voucherUnapplied)
                .fallRisk(fallRisk)
                .sosRisk(sosRisk)
                .checkInRisk(checkInRisk)
                .safetyZoneRisk(safetyZoneRisk)
                .riskReason(reasons.isEmpty() ? "위험 요소 없음" : String.join(" + ", reasons))
                .build());

        return toDto(saved, senior);
    }

    @Transactional
    public void assessAll() {
        seniorRepository.findAll().forEach(s -> assess(s.getId()));
    }

    private RiskAssessmentDto toDto(RiskAssessment r) {
        Senior senior = seniorRepository.findById(r.getSeniorId()).orElse(null);
        return toDto(r, senior);
    }

    private RiskAssessmentDto toDto(RiskAssessment r, Senior senior) {
        return RiskAssessmentDto.builder()
                .id(r.getId())
                .seniorId(r.getSeniorId())
                .seniorName(senior != null ? senior.getName() : null)
                .seniorAge(senior != null ? senior.getAge() : null)
                .totalScore(r.getTotalScore())
                .level(r.getLevel())
                .weatherRisk(r.getWeatherRisk())
                .recallRisk(r.getRecallRisk())
                .voucherUnapplied(r.getVoucherUnapplied())
                .fallRisk(r.getFallRisk())
                .sosRisk(r.getSosRisk())
                .checkInRisk(r.getCheckInRisk())
                .safetyZoneRisk(r.getSafetyZoneRisk())
                .riskReason(r.getRiskReason())
                .assessedAt(r.getAssessedAt())
                .build();
    }

    private boolean isEnergyVoucherEligible(Senior s) {
        return Boolean.TRUE.equals(s.getEnergyVoucherEligible());
    }
}
