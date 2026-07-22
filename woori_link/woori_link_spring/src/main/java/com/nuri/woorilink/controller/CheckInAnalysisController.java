package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.CheckInAnalysisResponse;
import com.nuri.woorilink.service.CheckInAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping(
        "/api/care/seniors/{seniorId}/check-in-analysis"
)
@RequiredArgsConstructor
public class CheckInAnalysisController {

    private final CheckInAnalysisService checkInAnalysisService;

    /**
     * 최근 7일 안부 확인 통계를 조회한다.
     *
     * GET /api/care/seniors/{seniorId}/check-in-analysis
     */
    @GetMapping
    public CheckInAnalysisResponse getCheckInAnalysis(
            @PathVariable Long seniorId,
            Authentication authentication
    ) {
        AuthenticatedUser guardian =
                requireGuardian(authentication);

        log.info(
                "Check-in analysis requested. seniorId={}, guardianUserId={}, role={}",
                seniorId,
                guardian.getUserId(),
                guardian.getRole()
        );

        return checkInAnalysisService.analyze(
                seniorId,
                guardian.getUserId()
        );
    }

    /**
     * 보호자 계정인지 확인한다.
     */
    private AuthenticatedUser requireGuardian(
            Authentication authentication
    ) {
        if (authentication == null) {
            log.warn(
                    "Check-in analysis authentication rejected: authentication is null"
            );

            throw new AccessDeniedException(
                    "Guardian authentication is required"
            );
        }

        Object principal = authentication.getPrincipal();

        if (!(principal instanceof AuthenticatedUser user)) {
            log.warn(
                    "Check-in analysis authentication rejected: principalType={}",
                    principal == null
                            ? "null"
                            : principal.getClass().getName()
            );

            throw new AccessDeniedException(
                    "Guardian authentication is required"
            );
        }

        if (!"GUARDIAN".equals(user.getRole())) {
            log.warn(
                    "Check-in analysis authentication rejected: userId={}, role={}",
                    user.getUserId(),
                    user.getRole()
            );

            throw new AccessDeniedException(
                    "Guardian authentication is required"
            );
        }

        return user;
    }
}