package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.RecallFollowUpHistory;
import com.nuri.woorilink.entity.RegisteredProduct;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public record RecallFollowUpResponse(

        /*
         * 등록 제품 및 대상자 정보
         */
        Long registeredProductId,
        Long seniorId,
        String seniorName,

        /*
         * 제품 정보
         */
        String productName,
        String manufacturer,
        String modelNumber,

        /*
         * 리콜 판정 정보
         */
        RegisteredProduct.RecallStatus recallStatus,
        RegisteredProduct.RecallDecisionStatus recallDecisionStatus,

        /*
         * 후속조치 전체 상태
         */
        RegisteredProduct.FollowUpStatus followUpStatus,
        RegisteredProduct.FollowUpOutcome followUpOutcome,

        /*
         * 담당자 배정 정보
         */
        Long assignedWorkerId,
        String assignedWorkerName,
        LocalDateTime assignedAt,

        /*
         * 다음 업무 계획
         */
        String followUpType,
        LocalDate nextActionDate,

        /*
         * 연락 정보
         */
        String contactTarget,
        String contactMethod,
        LocalDateTime contactedAt,
        RegisteredProduct.ContactResult contactResult,
        String contactMemo,

        /*
         * 제품 상태 확인 정보
         */
        RegisteredProduct.CurrentUseStatus currentUseStatus,
        LocalDateTime confirmedAt,
        String confirmationMemo,

        /*
         * 일정 정보
         */
        LocalDateTime scheduledAt,
        String scheduleType,
        String schedulePlace,
        String scheduleMemo,

        /*
         * 외부 기관 연계 정보
         */
        String referralAgency,
        String referralContactName,
        String referralContactPhone,
        LocalDateTime referredAt,
        String referralMemo,

        /*
         * 완료 정보
         */
        RegisteredProduct.FinalResult finalResult,
        LocalDateTime completedAt,
        String completionMemo,

        /*
         * 보호자 통보 정보
         */
        String guardianNotificationMethod,
        LocalDateTime guardianNotifiedAt,
        String guardianNotificationMemo,

        /*
         * 공통 메모와 생성·수정 시각
         */
        String note,
        LocalDateTime receivedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,

        /*
         * 상세 조회 시에만 포함하는 변경 이력
         */
        List<HistoryResponse> histories
) {

    public record HistoryResponse(
            Long id,
            RegisteredProduct.FollowUpStatus previousStatus,
            RegisteredProduct.FollowUpStatus newStatus,
            RecallFollowUpHistory.ChangeType changeType,
            Long changedBy,
            String changedByName,
            String changeMemo,
            LocalDateTime createdAt
    ) {
    }
}