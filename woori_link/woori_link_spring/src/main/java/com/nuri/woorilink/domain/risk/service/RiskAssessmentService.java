package com.nuri.woorilink.domain.risk.service;

import com.nuri.woorilink.domain.product.entity.RegisteredProduct;
import com.nuri.woorilink.domain.product.repository.RegisteredProductRepository;
import com.nuri.woorilink.domain.risk.dto.RiskAssessmentDto;
import com.nuri.woorilink.domain.risk.entity.RiskAssessment;
import com.nuri.woorilink.domain.risk.repository.RiskAssessmentRepository;
import com.nuri.woorilink.domain.senior.entity.Senior;
import com.nuri.woorilink.domain.senior.repository.SeniorRepository;
import com.nuri.woorilink.common.client.WeatherAlertApiClient;
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

        int score = 0;
        List<String> reasons = new ArrayList<>();
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
                .riskReason(r.getRiskReason())
                .assessedAt(r.getAssessedAt())
                .build();
    }

    private boolean isEnergyVoucherEligible(Senior s) {
        boolean lowIncome = s.getIncomeLevel() == Senior.IncomeLevel.BASIC_LIVELIHOOD
                || s.getIncomeLevel() == Senior.IncomeLevel.NEAR_POVERTY;
        boolean elderly = s.getAge() != null && s.getAge() >= 65;
        boolean disabled = s.getDisabilityGrade() != null && !s.getDisabilityGrade().isBlank();
        return lowIncome && (elderly || disabled);
    }
}
