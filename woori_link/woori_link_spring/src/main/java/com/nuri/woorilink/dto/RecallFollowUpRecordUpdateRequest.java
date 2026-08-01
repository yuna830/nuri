package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.RegisteredProduct;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class RecallFollowUpRecordUpdateRequest {

    /*
     * 기록 수정 작업을 수행하는 복지사 ID
     */
    private Long welfareWorkerId;

    /*
     * 담당자 정보
     */
    private Long assignedWorkerId;

    /*
     * 다음 업무 계획
     */
    private String followUpType;

    private LocalDate nextActionDate;

    /*
     * 연락 정보
     */
    private String contactTarget;

    private String contactMethod;

    private LocalDateTime contactedAt;

    private RegisteredProduct.ContactResult contactResult;

    private String contactMemo;

    /*
     * 제품 사용 확인 정보
     */
    private RegisteredProduct.CurrentUseStatus currentUseStatus;

    private LocalDateTime confirmedAt;

    private String confirmationMemo;

    /*
     * 예약 정보
     */
    private LocalDateTime scheduledAt;

    private String scheduleType;

    private String schedulePlace;

    private String scheduleMemo;

    /*
     * 외부 기관 연계 정보
     */
    private String referralAgency;

    private String referralContactName;

    private String referralContactPhone;

    private LocalDateTime referredAt;

    private String referralMemo;

    /*
     * 완료 정보
     */
    private RegisteredProduct.FinalResult finalResult;

    private LocalDateTime completedAt;

    private String completionMemo;

    /*
     * 보호자 최종 통보 정보
     */
    private String guardianNotificationMethod;

    private LocalDateTime guardianNotifiedAt;

    private String guardianNotificationMemo;

    /*
     * 예외 결과
     */
    private RegisteredProduct.FollowUpOutcome followUpOutcome;

    /*
     * 복지사 공통 메모
     */
    private String note;

    /*
     * 변경 이력에 저장할 수정 사유
     */
    private String changeMemo;
}