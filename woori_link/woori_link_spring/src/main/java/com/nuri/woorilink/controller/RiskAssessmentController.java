package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.RiskAssessmentDto;
import com.nuri.woorilink.service.RiskAssessmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/risk")
@RequiredArgsConstructor
public class RiskAssessmentController {

    private final RiskAssessmentService riskAssessmentService;

    @GetMapping("/senior/{seniorId}/latest")
    public RiskAssessmentDto getLatest(@PathVariable Long seniorId) {
        return riskAssessmentService.getLatest(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("위험도 평가 이력이 없습니다: " + seniorId));
    }

    @GetMapping("/high-risk")
    public List<RiskAssessmentDto> getHighRisk() { return riskAssessmentService.getHighRisk(); }

    @PostMapping("/assess/{seniorId}")
    public RiskAssessmentDto assess(@PathVariable Long seniorId) {
        return riskAssessmentService.assess(seniorId);
    }

    @PostMapping("/assess-all")
    public void assessAll() { riskAssessmentService.assessAll(); }
}
