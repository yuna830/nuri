package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.CheckInScheduleRequest;
import com.nuri.woorilink.dto.CheckInScheduleResponse;
import com.nuri.woorilink.service.CheckInScheduleService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 보호자의 자동 안부 확인 설정 API.
 */
@RestController
@RequestMapping(
        "/api/care/seniors/{seniorId}/check-in-schedule"
)
@RequiredArgsConstructor
public class CheckInScheduleController {

    private final CheckInScheduleService
            checkInScheduleService;

    /**
     * 자동 안부 확인 설정 조회.
     *
     * GET
     * /api/care/seniors/{seniorId}/check-in-schedule
     */
    @GetMapping
    public CheckInScheduleResponse getSchedule(
            @PathVariable Long seniorId,
            Authentication authentication
    ) {
        Long guardianId =
                requireGuardian(
                        authentication
                );

        return checkInScheduleService
                .getSchedule(
                        seniorId,
                        guardianId
                );
    }

    /**
     * 자동 안부 확인 설정 저장 또는 수정.
     *
     * PUT
     * /api/care/seniors/{seniorId}/check-in-schedule
     */
    @PutMapping
    public CheckInScheduleResponse saveSchedule(
            @PathVariable Long seniorId,
            @RequestBody CheckInScheduleRequest request,
            Authentication authentication
    ) {
        Long guardianId =
                requireGuardian(
                        authentication
                );

        return checkInScheduleService
                .saveSchedule(
                        seniorId,
                        guardianId,
                        request
                );
    }

    /**
     * 보호자 계정인지 확인하고
     * 로그인한 보호자 ID를 반환한다.
     */
    private Long requireGuardian(
            Authentication authentication
    ) {
        if (authentication == null
                || !(authentication.getPrincipal()
                instanceof AuthenticatedUser user)
                || !"GUARDIAN".equals(
                user.getRole()
        )) {

            throw new AccessDeniedException(
                    "Guardian authentication is required"
            );
        }

        return user.getUserId();
    }
}