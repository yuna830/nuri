package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.GuardianSeniorConnectRequest;
import com.nuri.woorilink.dto.SeniorProfileUpdateRequest;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.service.SeniorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/seniors")
@RequiredArgsConstructor
public class SeniorController {

    private static final String GUARDIAN_ROLE =
            "GUARDIAN";

    private final SeniorService seniorService;


    @GetMapping
    public List<Senior> getAll() {
        return seniorService.getAll();
    }


    @GetMapping("/{id}")
    public Senior getById(
            @PathVariable Long id
    ) {
        return seniorService.getById(
                id
        );
    }


    /**
     * 기존 보호자 ID 기반 조회 API입니다.
     *
     * 관리자 또는 내부 기능에서 기존 API를 사용하는 경우를 위해
     * 유지합니다.
     *
     * 보호자 React 화면에서는 이 API 대신
     * /api/seniors/by-guardian/me를 사용해야 합니다.
     */
    @GetMapping("/by-guardian/{guardianId}")
    public List<Senior> getByGuardian(
            @PathVariable Long guardianId
    ) {
        return seniorService.getByGuardian(
                guardianId
        );
    }


    /**
     * 현재 로그인한 보호자와 연결된 어르신을 조회합니다.
     *
     * localStorage나 URL에서 guardianId를 받지 않고,
     * JWT의 사용자 ID를 기준으로 조회합니다.
     */
    @GetMapping("/by-guardian/me")
    public List<Senior> getMyLinkedSeniors(
            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        Long guardianId =
                requireGuardian(
                        user
                );

        return seniorService.getByGuardian(
                guardianId
        );
    }


    @GetMapping(
            "/by-welfare-worker/{welfareWorkerId}"
    )
    public List<Senior> getByWelfareWorker(
            @PathVariable Long welfareWorkerId
    ) {
        return seniorService.getByWelfareWorker(
                welfareWorkerId
        );
    }


    @GetMapping("/voucher-unapplied")
    public List<Senior> getVoucherUnapplied() {
        return seniorService
                .getVoucherUnapplied();
    }


    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Senior create(
            @RequestBody Senior senior
    ) {
        return seniorService.create(
                senior
        );
    }


    @PatchMapping("/{id}")
    public Senior update(
            @PathVariable Long id,
            @RequestBody Senior request
    ) {
        return seniorService.update(
                id,
                request
        );
    }


    @PutMapping("/{id}/profile")
    public Senior updateProfile(
            @PathVariable Long id,
            @RequestBody
            SeniorProfileUpdateRequest request
    ) {
        return seniorService.updateProfile(
                id,
                request
        );
    }


    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id
    ) {
        seniorService.delete(
                id
        );
    }


    @GetMapping("/search")
    public List<Senior> search(
            @RequestParam String name,
            @RequestParam String phone
    ) {
        return seniorService.search(
                name,
                phone
        );
    }


    /**
     * 로그인한 보호자가 이름과 전화번호로
     * 어르신 계정을 연결합니다.
     */
    @PostMapping("/guardian/connect")
    public Senior connectGuardian(
            @AuthenticationPrincipal
            AuthenticatedUser user,
            @RequestBody
            GuardianSeniorConnectRequest request
    ) {
        Long guardianId =
                requireGuardian(
                        user
                );

        if (request == null) {
            throw new IllegalArgumentException(
                    "어르신 연결 요청이 필요합니다."
            );
        }

        if (
                request.getName() == null
                        || request.getName()
                        .isBlank()
        ) {
            throw new IllegalArgumentException(
                    "어르신 이름을 입력해 주세요."
            );
        }

        if (
                request.getPhone() == null
                        || request.getPhone()
                        .isBlank()
        ) {
            throw new IllegalArgumentException(
                    "어르신 전화번호를 입력해 주세요."
            );
        }

        return seniorService.connectGuardian(
                guardianId,
                request.getName().trim(),
                request.getPhone().trim()
        );
    }


    /**
     * 로그인한 보호자가 자신과 연결된
     * 어르신의 연결을 해제합니다.
     *
     * 기존 URL 호환성을 위해 guardianId를 받지만,
     * 실제 권한은 JWT 사용자 ID로 검증합니다.
     */
    @DeleteMapping(
            "/guardian/{guardianId}/{seniorId}"
    )
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnectGuardian(
            @AuthenticationPrincipal
            AuthenticatedUser user,
            @PathVariable Long guardianId,
            @PathVariable Long seniorId
    ) {
        Long authenticatedGuardianId =
                requireGuardian(
                        user
                );

        if (
                !authenticatedGuardianId.equals(
                        guardianId
                )
        ) {
            throw new AccessDeniedException(
                    "현재 로그인한 보호자의 연결만 해제할 수 있습니다."
            );
        }

        seniorService.disconnectGuardian(
                user,
                seniorId
        );
    }


    /**
     * 역할 문자열이 ROLE_GUARDIAN 또는 GUARDIAN 형식이어도
     * 동일하게 처리합니다.
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