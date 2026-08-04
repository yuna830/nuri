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

    /**
     * 변경하려는 후속조치 상태
     */
    private RegisteredProduct.FollowUpStatus
            followUpStatus;

    /**
     * 이전 프론트엔드 호환용 필드입니다.
     *
     * 서버 권한 검증이나 이력 작성자 판단에는
     * 사용하지 않습니다.
     */
    @Deprecated
    private Long welfareWorkerId;

    /**
     * 다음 업무 정보
     */
    private String followUpType;

    private LocalDate nextActionDate;

    /**
     * CONTACTING 상태 정보
     */
    private String contactTarget;

    private String contactMethod;

    private RegisteredProduct.ContactResult
            contactResult;

    private String contactMemo;

    /**
     * CONFIRMED 상태 정보
     */
    private RegisteredProduct.CurrentUseStatus
            currentUseStatus;

    private String confirmationMemo;

    /**
     * SCHEDULED 상태 정보
     */
    private LocalDateTime scheduledAt;

    private String scheduleType;

    private String schedulePlace;

    private String scheduleMemo;

    /**
     * REFERRED 상태 정보
     */
    private String referralAgency;

    private String referralContactName;

    private String referralContactPhone;

    private String referralMemo;

    /**
     * COMPLETED 상태 정보
     */
    private RegisteredProduct.FinalResult
            finalResult;

    private String completionMemo;

    /**
     * GUARDIAN_NOTIFIED 상태 정보
     */
    private String guardianNotificationMethod;

    private String guardianNotificationMemo;

    /**
     * 예외 결과
     */
    private RegisteredProduct.FollowUpOutcome
            followUpOutcome;

    /**
     * 변경 이력에 저장할 사유
     */
    private String changeMemo;
}