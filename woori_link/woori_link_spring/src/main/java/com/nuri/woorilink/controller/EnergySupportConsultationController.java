package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.EnergySupportConsultationRequestDto;
import com.nuri.woorilink.service.EnergySupportAccessService;
import com.nuri.woorilink.service.EnergySupportConsultationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping(
        "/api/energy-support/consultations"
)
@RequiredArgsConstructor
public class EnergySupportConsultationController {

    private final EnergySupportConsultationService
            consultationService;

    private final EnergySupportAccessService
            accessService;


    /**
     * 보호자가 복지사에게 상담 요청
     */
    @PostMapping(
            "/seniors/{seniorId}"
    )
    @ResponseStatus(
            HttpStatus.CREATED
    )
    public EnergySupportConsultationRequestDto
    requestConsultation(
            @PathVariable Long seniorId,

            @RequestBody
            ConsultationRequest request,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireGuardian(user);

        accessService.validateWriteAccess(
                user,
                seniorId
        );

        return consultationService
                .requestConsultation(
                        seniorId,
                        user.getUserId(),
                        request.message()
                );
    }


    /**
     * 보호자 화면에서 현재 요청 상태 조회
     */
    @GetMapping(
            "/seniors/{seniorId}/active"
    )
    public ResponseEntity<
            EnergySupportConsultationRequestDto
            >
    getActiveRequest(
            @PathVariable Long seniorId,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        accessService.validateReadAccess(
                user,
                seniorId
        );

        EnergySupportConsultationRequestDto result =
                consultationService
                        .getActiveRequest(
                                seniorId
                        );

        if (result == null) {
            return ResponseEntity
                    .noContent()
                    .build();
        }

        return ResponseEntity.ok(
                result
        );
    }


    /**
     * 복지사 화면의 상담 요청 목록
     */
    @GetMapping(
            "/worker"
    )
    public List<
            EnergySupportConsultationRequestDto
            >
    getWorkerRequests(
            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireWelfareWorker(
                user
        );

        return consultationService
                .getWorkerRequests(
                        user.getUserId()
                );
    }


    /**
     * 복지사가 처리 시작
     */
    @PatchMapping(
            "/{requestId}/start"
    )
    public EnergySupportConsultationRequestDto
    startConsultation(
            @PathVariable Long requestId,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireWelfareWorker(
                user
        );

        return consultationService
                .startConsultation(
                        requestId,
                        user.getUserId()
                );
    }


    /**
     * 복지사가 처리 완료
     */
    @PatchMapping(
            "/{requestId}/resolve"
    )
    public EnergySupportConsultationRequestDto
    resolveConsultation(
            @PathVariable Long requestId,

            @RequestBody
            ResolveRequest request,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireWelfareWorker(
                user
        );

        return consultationService
                .resolveConsultation(
                        requestId,
                        user.getUserId(),
                        request.resolutionNote()
                );
    }


    private void requireGuardian(
            AuthenticatedUser user
    ) {
        if (
                user == null
                        || !"GUARDIAN".equals(
                        user.getRole()
                )
        ) {
            throw new AccessDeniedException(
                    "보호자 권한이 필요합니다."
            );
        }
    }


    private void requireWelfareWorker(
            AuthenticatedUser user
    ) {
        if (
                user == null
                        || !"WELFARE_WORKER".equals(
                        user.getRole()
                )
        ) {
            throw new AccessDeniedException(
                    "복지사 권한이 필요합니다."
            );
        }
    }


    public record ConsultationRequest(
            String message
    ) {
    }


    public record ResolveRequest(
            String resolutionNote
    ) {
    }
}