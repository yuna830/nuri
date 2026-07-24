package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.EnergySupportConsultationRequestDto;
import com.nuri.woorilink.entity.EnergySupportConsultationRequest;
import com.nuri.woorilink.service.EnergySupportAccessService;
import com.nuri.woorilink.service.EnergySupportConsultationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
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


    @GetMapping(
            "/{requestId}"
    )
    public EnergySupportConsultationRequestDto
    getRequest(
            @PathVariable Long requestId,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireAuthenticated(user);

        return consultationService
                .getRequest(
                        requestId,
                        user.getUserId(),
                        user.getRole()
                );
    }


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
        requireWelfareWorker(user);

        return consultationService
                .getWorkerRequests(
                        user.getUserId()
                );
    }


    /**
     * 복지사가 보호자에게 상담 일정 제안
     */
    @PatchMapping(
            "/{requestId}/schedule/propose"
    )
    public EnergySupportConsultationRequestDto
    proposeSchedule(
            @PathVariable Long requestId,

            @RequestBody
            ScheduleProposalRequest request,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireWelfareWorker(user);

        return consultationService
                .proposeSchedule(
                        requestId,
                        user.getUserId(),
                        request.consultationDate(),
                        request.availableStartTime(),
                        request.availableEndTime(),
                        request.consultationMethod(),
                        request.message()
                );
    }


    /**
     * 보호자가 제안된 상담 일정 가능 응답
     */
    @PatchMapping(
            "/{requestId}/schedule/confirm"
    )
    public EnergySupportConsultationRequestDto
    confirmSchedule(
            @PathVariable Long requestId,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireGuardian(user);

        return consultationService
                .confirmSchedule(
                        requestId,
                        user.getUserId()
                );
    }


    /**
     * 보호자가 다른 날짜·시간 요청
     */
    @PatchMapping(
            "/{requestId}/schedule/request-change"
    )
    public EnergySupportConsultationRequestDto
    requestScheduleChange(
            @PathVariable Long requestId,

            @RequestBody
            ScheduleChangeRequest request,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireGuardian(user);

        return consultationService
                .requestScheduleChange(
                        requestId,
                        user.getUserId(),
                        request.consultationDate(),
                        request.availableStartTime(),
                        request.availableEndTime(),
                        request.message()
                );
    }


    @PatchMapping(
            "/{requestId}/start"
    )
    public EnergySupportConsultationRequestDto
    startConsultation(
            @PathVariable Long requestId,

            @AuthenticationPrincipal
            AuthenticatedUser user
    ) {
        requireWelfareWorker(user);

        return consultationService
                .startConsultation(
                        requestId,
                        user.getUserId()
                );
    }


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
        requireWelfareWorker(user);

        return consultationService
                .resolveConsultation(
                        requestId,
                        user.getUserId(),
                        request.resolutionNote()
                );
    }


    private void requireAuthenticated(
            AuthenticatedUser user
    ) {
        if (user == null) {
            throw new AccessDeniedException(
                    "로그인이 필요합니다."
            );
        }
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


    public record ScheduleProposalRequest(
            LocalDate consultationDate,

            String availableStartTime,

            String availableEndTime,

            EnergySupportConsultationRequest
                    .ConsultationMethod
            consultationMethod,

            String message
    ) {
    }


    public record ScheduleChangeRequest(
            LocalDate consultationDate,

            String availableStartTime,

            String availableEndTime,

            String message
    ) {
    }


    public record ResolveRequest(
            String resolutionNote
    ) {
    }
}