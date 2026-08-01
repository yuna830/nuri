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
public class RecallFollowUpStatusUpdateRequest {

    /*
     * 변경하려는 후속조치 상태
     */
    private RegisteredProduct.FollowUpStatus followUpStatus;

    /*
     * 상태 변경을 수행하는 복지사 ID
     */
    private Long welfareWorkerId;

    /*
     * 다음 업무 정보
     */
    private String followUpType;

    private LocalDate nextActionDate;

    /*
     * CONTACTING 상태에서 사용하는 정보
     */
    private String contactTarget;

    private String contactMethod;

    private RegisteredProduct.ContactResult contactResult;

    private String contactMemo;

    /*
     * CONFIRMED 상태에서 사용하는 정보
     */
    private RegisteredProduct.CurrentUseStatus currentUseStatus;

    private String confirmationMemo;

    /*
     * SCHEDULED 상태에서 사용하는 정보
     */
    private LocalDateTime scheduledAt;

    private String scheduleType;

    private String schedulePlace;

    private String scheduleMemo;

    /*
     * REFERRED 상태에서 사용하는 정보
     */
    private String referralAgency;

    private String referralContactName;

    private String referralContactPhone;

    private String referralMemo;

    /*
     * COMPLETED 상태에서 사용하는 정보
     */
    private RegisteredProduct.FinalResult finalResult;

    private String completionMemo;

    /*
     * GUARDIAN_NOTIFIED 상태에서 사용하는 정보
     */
    private String guardianNotificationMethod;

    private String guardianNotificationMemo;

    /*
     * 연락 불가, 조치 거부 등의 예외 결과
     */
    private RegisteredProduct.FollowUpOutcome followUpOutcome;

    /*
     * 이력에 저장할 상태 변경 사유
     */
    private String changeMemo;
}