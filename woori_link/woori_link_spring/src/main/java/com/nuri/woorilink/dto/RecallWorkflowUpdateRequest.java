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
public class RecallWorkflowUpdateRequest {

    /*
     * 제품 확인 정보
     */
    private RegisteredProduct.ModelMatchStatus modelMatchStatus;

    private RegisteredProduct.CurrentUseStatus currentUseStatus;

    /*
     * 사용 중단 안내 정보
     */
    private Boolean stopGuidanceCompleted;

    private LocalDateTime stopGuidanceCompletedAt;

    private String stopGuidanceMethod;

    private String stopGuidanceTarget;

    private Long stopGuidanceWorkerId;

    private String stopGuidanceMemo;

    /*
     * 기존 보호자 연락 정보
     *
     * ProductRecallService에서 현재 사용하고 있으므로
     * 제거하지 않고 유지합니다.
     */
    private RegisteredProduct.GuardianContactStatus guardianContactStatus;

    private String guardianContactMethod;

    private LocalDateTime guardianContactedAt;

    private String guardianContactMemo;

    /*
     * 담당 복지사 배정 정보
     */
    private Long assignedWorkerId;

    private LocalDateTime assignedAt;

    /*
     * 일반 연락 정보
     *
     * contactTarget:
     * SENIOR, GUARDIAN, BOTH
     *
     * contactMethod:
     * PHONE, MESSAGE, VISIT, APP_NOTIFICATION
     */
    private String contactTarget;

    private String contactMethod;

    private LocalDateTime contactedAt;

    private RegisteredProduct.ContactResult contactResult;

    private String contactMemo;

    /*
     * 제품 상태 확인 완료 정보
     */
    private LocalDateTime confirmedAt;

    private String confirmationMemo;

    /*
     * 예약 및 일정 정보
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
     * 조치 완료 정보
     */
    private LocalDateTime completedAt;

    private String completionMemo;

    /*
     * 보호자 최종 통보 정보
     */
    private String guardianNotificationMethod;

    private LocalDateTime guardianNotifiedAt;

    private String guardianNotificationMemo;

    /*
     * 후속조치 계획
     */
    private String followUpType;

    private LocalDate nextActionDate;

    /*
     * 후속조치 전체 진행 상태
     */
    private RegisteredProduct.FollowUpStatus followUpStatus;

    /*
     * 연락 불가, 조치 거부 등의 예외 결과
     */
    private RegisteredProduct.FollowUpOutcome followUpOutcome;

    /*
     * 실제 최종 처리 결과
     */
    private RegisteredProduct.FinalResult finalResult;

    /*
     * 복지사 공통 메모
     */
    private String note;

    /*
     * 조치 기록 생성 여부
     */
    private Boolean createAction;

    /*
     * 현재 작업을 수행하는 복지사 ID
     */
    private Long welfareWorkerId;
}