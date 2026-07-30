package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.RiskAssessmentDto;
import com.nuri.woorilink.service.RiskAssessmentService;
import com.nuri.woorilink.service.SeniorAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/risk")
@RequiredArgsConstructor
public class RiskAssessmentController {

    private final RiskAssessmentService riskAssessmentService;
    private final SeniorAccessService seniorAccessService;

    @GetMapping("/senior/{seniorId}/latest")
    public RiskAssessmentDto getLatest(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        seniorAccessService.requireReadableSenior(user, seniorId);
        return riskAssessmentService.getLatest(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("위험도 평가 이력이 없습니다: " + seniorId));
    }

    @GetMapping("/high-risk")
    public List<RiskAssessmentDto> getHighRisk(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        requireWelfareWorker(user);
        return riskAssessmentService.getHighRisk();
    }

    @PostMapping("/assess/{seniorId}")
    public RiskAssessmentDto assess(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        seniorAccessService.requireAssignedWelfareWorkerSenior(user, seniorId);
        return riskAssessmentService.assess(seniorId);
    }

    @PostMapping("/assess-all")
    public void assessAll(@AuthenticationPrincipal AuthenticatedUser user) {
        requireWelfareWorker(user);
        riskAssessmentService.assessAll();
    }

    private void requireWelfareWorker(AuthenticatedUser user) {
        if (user == null || !"WELFARE_WORKER".equals(user.getRole())) {
            throw new AccessDeniedException("Welfare worker authentication is required.");
        }
    }
}
