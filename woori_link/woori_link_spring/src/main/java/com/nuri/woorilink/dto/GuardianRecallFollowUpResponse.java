package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.RegisteredProduct;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 보호자에게 공개하는 리콜 후속조치 진행 정보입니다.
 *
 * 복지사 내부 메모, 기관 담당자 개인정보,
 * 변경 이력, 연락 실패 상세 사유는 포함하지 않습니다.
 */
public record GuardianRecallFollowUpResponse(

        /*
         * 등록 제품 정보
         */
        Long registeredProductId,

        /*
         * 보호자와 연결된 어르신 정보
         */
        Long seniorId,
        String seniorName,

        /*
         * 제품 기본 정보
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
         * 보호자 공개용 진행 상태
         */
        PublicStatus publicStatus,
        String publicStatusLabel,
        String publicStatusDescription,

        /*
         * 주요 진행 날짜
         */
        LocalDateTime receivedAt,
        LocalDate nextActionDate,

        /*
         * 일정이 등록된 경우에만 공개
         */
        LocalDateTime scheduledAt,
        String scheduleType,
        String schedulePlace,

        /*
         * 기관 연계가 완료된 경우 기관명만 공개
         */
        String referralAgency,
        LocalDateTime referredAt,

        /*
         * 최종 처리 결과
         */
        RegisteredProduct.FinalResult finalResult,
        String finalResultLabel,
        LocalDateTime completedAt,

        /*
         * 보호자 결과 안내 여부
         */
        Boolean guardianNotificationCompleted,
        LocalDateTime guardianNotifiedAt,

        /*
         * 데이터 갱신 시각
         */
        LocalDateTime updatedAt
) {

    /**
     * 내부 처리 상태를 보호자에게 이해하기 쉬운 상태로 변환합니다.
     */
    public enum PublicStatus {
        RECEIVED,
        WORKER_ASSIGNED,
        CONTACT_IN_PROGRESS,
        PRODUCT_CONFIRMED,
        SCHEDULED,
        AGENCY_LINKED,
        COMPLETED,
        RESULT_NOTIFIED
    }
}