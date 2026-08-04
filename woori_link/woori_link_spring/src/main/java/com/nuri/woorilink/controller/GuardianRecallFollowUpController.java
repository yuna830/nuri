package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.GuardianRecallFollowUpResponse;
import com.nuri.woorilink.service.GuardianRecallFollowUpService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/guardian/recall-follow-ups")
@RequiredArgsConstructor
public class GuardianRecallFollowUpController {

    private static final String GUARDIAN_ROLE =
            "GUARDIAN";

    private final GuardianRecallFollowUpService
            guardianRecallFollowUpService;


    /**
     * 로그인한 보호자에게 연결된 어르신들의
     * 리콜 후속조치 목록을 조회합니다.
     *
     * 현재 Service의 getList()가
     * AuthenticatedUser를 받기 때문에 user를 그대로 전달합니다.
     */
    @GetMapping
    public List<GuardianRecallFollowUpResponse> getList(
            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireGuardian(
                user
        );

        return guardianRecallFollowUpService
                .getList(
                        user
                );
    }


    /**
     * 로그인한 보호자가 접근할 수 있는
     * 특정 제품의 리콜 후속조치 상세를 조회합니다.
     */
    @GetMapping("/{registeredProductId}")
    public GuardianRecallFollowUpResponse getDetail(
            @AuthenticationPrincipal
            AuthenticatedUser user,

            @PathVariable
            Long registeredProductId
    ) {
        Long guardianId =
                requireGuardian(
                        user
                );

        return guardianRecallFollowUpService
                .getDetail(
                        guardianId,
                        registeredProductId
                );
    }


    /**
     * 로그인 사용자 역할이 보호자인지 확인하고
     * 보호자 사용자 ID를 반환합니다.
     *
     * GUARDIAN과 ROLE_GUARDIAN을 모두 처리합니다.
     */
    private Long requireGuardian(
            AuthenticatedUser user
    ) {
        if (user == null) {
            throw new AccessDeniedException(
                    "로그인이 필요합니다."
            );
        }

        String normalizedRole =
                normalizeRole(
                        user.getRole()
                );

        if (
                !GUARDIAN_ROLE.equals(
                        normalizedRole
                )
        ) {
            throw new AccessDeniedException(
                    "보호자 계정으로 로그인해 주세요."
            );
        }

        if (user.getUserId() == null) {
            throw new AccessDeniedException(
                    "보호자 사용자 정보를 확인할 수 없습니다."
            );
        }

        return user.getUserId();
    }


    private String normalizeRole(
            String role
    ) {
        if (role == null) {
            return "";
        }

        return role
                .replaceFirst(
                        "^ROLE_",
                        ""
                )
                .trim()
                .toUpperCase();
    }
}