package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.RecallFollowUpCreateRequest;
import com.nuri.woorilink.dto.RecallFollowUpRecordUpdateRequest;
import com.nuri.woorilink.dto.RecallFollowUpResponse;
import com.nuri.woorilink.dto.RecallFollowUpStatusUpdateRequest;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.service.RecallFollowUpService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/recall-follow-ups")
public class RecallFollowUpController {

    private final RecallFollowUpService recallFollowUpService;

    /*
     * 후속조치 생성 및 담당자 배정
     *
     * POST /api/recall-follow-ups
     */
    @PostMapping
    public ResponseEntity<RecallFollowUpResponse> create(
            @RequestBody RecallFollowUpCreateRequest request
    ) {
        RecallFollowUpResponse response =
                recallFollowUpService.create(request);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    /*
     * 후속조치 목록 조회
     *
     * GET /api/recall-follow-ups
     * GET /api/recall-follow-ups?welfareWorkerId=3
     * GET /api/recall-follow-ups?seniorId=5
     * GET /api/recall-follow-ups?status=CONTACTING
     */
    @GetMapping
    public ResponseEntity<List<RecallFollowUpResponse>>
    getList(
            @RequestParam(required = false)
            Long welfareWorkerId,

            @RequestParam(required = false)
            Long seniorId,

            @RequestParam(required = false)
            RegisteredProduct.FollowUpStatus status
    ) {
        List<RecallFollowUpResponse> responses =
                recallFollowUpService.getList(
                        welfareWorkerId,
                        seniorId,
                        status
                );

        return ResponseEntity.ok(responses);
    }

    /*
     * 후속조치 상세 조회
     *
     * GET /api/recall-follow-ups/{registeredProductId}
     */
    @GetMapping("/{registeredProductId}")
    public ResponseEntity<RecallFollowUpResponse> getDetail(
            @PathVariable Long registeredProductId
    ) {
        return ResponseEntity.ok(
                recallFollowUpService.getDetail(
                        registeredProductId
                )
        );
    }

    /*
     * 후속조치 상태 변경
     *
     * PATCH /api/recall-follow-ups/{registeredProductId}/status
     */
    @PatchMapping("/{registeredProductId}/status")
    public ResponseEntity<RecallFollowUpResponse>
    updateStatus(
            @PathVariable Long registeredProductId,

            @RequestBody
            RecallFollowUpStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(
                recallFollowUpService.updateStatus(
                        registeredProductId,
                        request
                )
        );
    }

    /*
     * 상태를 유지한 채 상세 기록 수정
     *
     * PATCH /api/recall-follow-ups/{registeredProductId}
     */
    @PatchMapping("/{registeredProductId}")
    public ResponseEntity<RecallFollowUpResponse>
    updateRecord(
            @PathVariable Long registeredProductId,

            @RequestBody
            RecallFollowUpRecordUpdateRequest request
    ) {
        return ResponseEntity.ok(
                recallFollowUpService.updateRecord(
                        registeredProductId,
                        request
                )
        );
    }

    /*
     * 후속조치 변경 이력 조회
     *
     * GET /api/recall-follow-ups/{registeredProductId}/histories
     */
    @GetMapping("/{registeredProductId}/histories")
    public ResponseEntity<
            List<RecallFollowUpResponse.HistoryResponse>
            > getHistories(
            @PathVariable Long registeredProductId
    ) {
        return ResponseEntity.ok(
                recallFollowUpService.getHistories(
                        registeredProductId
                )
        );
    }
}