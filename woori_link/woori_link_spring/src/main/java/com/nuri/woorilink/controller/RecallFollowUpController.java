package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.RecallFollowUpCreateRequest;
import com.nuri.woorilink.dto.RecallFollowUpRecordUpdateRequest;
import com.nuri.woorilink.dto.RecallFollowUpResponse;
import com.nuri.woorilink.dto.RecallFollowUpStatusUpdateRequest;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.service.RecallFollowUpService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recall-follow-ups")
public class RecallFollowUpController {

    private final RecallFollowUpService
            recallFollowUpService;

    /**
     * 후속조치를 생성하고
     * 현재 로그인한 복지사를 담당자로 배정합니다.
     *
     * POST /api/recall-follow-ups
     */
    @PostMapping
    public ResponseEntity<RecallFollowUpResponse> create(
            @AuthenticationPrincipal
            AuthenticatedUser authenticatedUser,

            @RequestBody
            RecallFollowUpCreateRequest request
    ) {
        RecallFollowUpResponse response =
                recallFollowUpService.create(
                        authenticatedUser,
                        request
                );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    /**
     * 현재 로그인한 복지사가 담당하는
     * 어르신의 후속조치만 조회합니다.
     *
     * GET /api/recall-follow-ups
     * GET /api/recall-follow-ups?seniorId=5
     * GET /api/recall-follow-ups?status=CONTACTING
     *
     * welfareWorkerId 쿼리 값은 받지 않습니다.
     * 로그인한 JWT 사용자를 기준으로 조회합니다.
     */
    @GetMapping
    public ResponseEntity<
            List<RecallFollowUpResponse>
            > getList(
            @AuthenticationPrincipal
            AuthenticatedUser authenticatedUser,

            @RequestParam(required = false)
            Long seniorId,

            @RequestParam(required = false)
            RegisteredProduct.FollowUpStatus status
    ) {
        List<RecallFollowUpResponse> responses =
                recallFollowUpService.getList(
                        authenticatedUser,
                        seniorId,
                        status
                );

        return ResponseEntity.ok(
                responses
        );
    }

    /**
     * 현재 복지사가 담당하는 대상의
     * 후속조치 상세만 조회합니다.
     */
    @GetMapping("/{registeredProductId}")
    public ResponseEntity<RecallFollowUpResponse>
    getDetail(
            @AuthenticationPrincipal
            AuthenticatedUser authenticatedUser,

            @PathVariable
            Long registeredProductId
    ) {
        return ResponseEntity.ok(
                recallFollowUpService.getDetail(
                        authenticatedUser,
                        registeredProductId
                )
        );
    }

    /**
     * 현재 복지사가 담당하는 대상의
     * 후속조치 상태만 변경할 수 있습니다.
     */
    @PatchMapping("/{registeredProductId}/status")
    public ResponseEntity<RecallFollowUpResponse>
    updateStatus(
            @AuthenticationPrincipal
            AuthenticatedUser authenticatedUser,

            @PathVariable
            Long registeredProductId,

            @RequestBody
            RecallFollowUpStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(
                recallFollowUpService.updateStatus(
                        authenticatedUser,
                        registeredProductId,
                        request
                )
        );
    }

    /**
     * 현재 복지사가 담당하는 대상의
     * 상세 기록만 수정할 수 있습니다.
     */
    @PatchMapping("/{registeredProductId}")
    public ResponseEntity<RecallFollowUpResponse>
    updateRecord(
            @AuthenticationPrincipal
            AuthenticatedUser authenticatedUser,

            @PathVariable
            Long registeredProductId,

            @RequestBody
            RecallFollowUpRecordUpdateRequest request
    ) {
        return ResponseEntity.ok(
                recallFollowUpService.updateRecord(
                        authenticatedUser,
                        registeredProductId,
                        request
                )
        );
    }

    /**
     * 현재 복지사가 담당하는 대상의
     * 처리 이력만 조회할 수 있습니다.
     */
    @GetMapping("/{registeredProductId}/histories")
    public ResponseEntity<
            List<RecallFollowUpResponse.HistoryResponse>
            > getHistories(
            @AuthenticationPrincipal
            AuthenticatedUser authenticatedUser,

            @PathVariable
            Long registeredProductId
    ) {
        return ResponseEntity.ok(
                recallFollowUpService.getHistories(
                        authenticatedUser,
                        registeredProductId
                )
        );
    }
}