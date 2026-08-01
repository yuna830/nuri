package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "wl_registered_products")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisteredProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /*
     * 제품 소유 어르신
     */
    @Column(nullable = false)
    private Long seniorId;

    /*
     * 제품 기본 정보
     */
    private String productName;

    private String productType;

    private String manufacturer;

    private String brandName;

    private String modelNumber;

    private String barcode;

    private String certificationNumber;

    private LocalDate manufacturingDate;

    private String serialNumber;

    private String lotNumber;

    /*
     * SENIOR_APP
     * GUARDIAN_WEB
     * WELFARE_WEB
     * BARCODE_SCAN
     * KC_INPUT
     * MANUAL
     */
    private String registrationSource;

    /*
     * 리콜 자동 판정 정보
     */
    @Enumerated(EnumType.STRING)
    private RecallDecisionStatus recallDecisionStatus;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private RecallCheckStatus recallCheckStatus =
            RecallCheckStatus.NOT_CHECKED;

    /*
     * 일치한 공식 리콜 공고 ID
     */
    private Long matchedRecallNoticeId;

    @Column(columnDefinition = "text")
    private String recallDecisionReason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<String> recallMatchedFields =
            new ArrayList<>();

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private List<String> recallMissingFields =
            new ArrayList<>();

    private LocalDateTime lastSuccessfulCheckedAt;

    private LocalDateTime lastCheckFailedAt;

    private String lastCheckErrorCode;

    @Column(columnDefinition = "text")
    private String lastCheckErrorMessage;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private RecallStatus recallStatus =
            RecallStatus.UNKNOWN;

    /*
     * 제품 현재 사용 상태
     */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private CurrentUseStatus currentUseStatus =
            CurrentUseStatus.UNKNOWN;

    /*
     * 모델번호 일치 상태
     */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private ModelMatchStatus modelMatchStatus =
            ModelMatchStatus.UNKNOWN;

    /*
     * 사용 중단 안내 정보
     */
    @Builder.Default
    @Column(nullable = false)
    private Boolean stopGuidanceCompleted = false;

    private LocalDateTime stopGuidanceCompletedAt;

    private String stopGuidanceMethod;

    private String stopGuidanceTarget;

    private Long stopGuidanceWorkerId;

    @Column(length = 1000)
    private String stopGuidanceMemo;

    /*
     * 기존 보호자 연락 관리 정보
     *
     * 일반적인 보호자 연락 여부를 관리합니다.
     * 최종 결과 통보 정보는 아래 guardianNotification 계열을 사용합니다.
     */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private GuardianContactStatus guardianContactStatus =
            GuardianContactStatus.UNKNOWN;

    private String guardianContactMethod;

    private LocalDateTime guardianContactedAt;

    @Column(length = 1000)
    private String guardianContactMemo;

    /*
     * 다음 업무 계획
     */
    private String followUpType;

    private LocalDate nextActionDate;

    /*
     * 후속조치 전체 진행 단계
     *
     * RECEIVED
     * → ASSIGNED
     * → CONTACTING
     * → CONFIRMED 또는 SCHEDULED
     * → REFERRED
     * → COMPLETED
     * → GUARDIAN_NOTIFIED
     */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private FollowUpStatus followUpStatus =
            FollowUpStatus.RECEIVED;

    /*
     * 접수 정보
     */
    private LocalDateTime receivedAt;

    /*
     * 담당 복지사 배정 정보
     */
    private Long assignedWorkerId;

    private LocalDateTime assignedAt;

    /*
     * 연락 정보
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

    @Enumerated(EnumType.STRING)
    private ContactResult contactResult;

    @Column(length = 1000)
    private String contactMemo;

    /*
     * 제품 상태 확인 완료 정보
     */
    private LocalDateTime confirmedAt;

    @Column(length = 1000)
    private String confirmationMemo;

    /*
     * 상담·방문·제조사 문의 일정 정보
     */
    private LocalDateTime scheduledAt;

    /*
     * PHONE_CONSULTATION
     * HOME_VISIT
     * AGENCY_VISIT
     * MANUFACTURER_CONTACT
     */
    private String scheduleType;

    private String schedulePlace;

    @Column(length = 1000)
    private String scheduleMemo;

    /*
     * 외부 기관 연계 정보
     */
    private String referralAgency;

    private String referralContactName;

    private String referralContactPhone;

    private LocalDateTime referredAt;

    @Column(length = 1000)
    private String referralMemo;

    /*
     * 조치 완료 정보
     */
    private LocalDateTime completedAt;

    @Column(length = 1000)
    private String completionMemo;

    /*
     * 보호자 최종 결과 통보 정보
     *
     * guardianNotificationMethod:
     * PHONE, MESSAGE, APP_NOTIFICATION, IN_PERSON
     */
    private String guardianNotificationMethod;

    private LocalDateTime guardianNotifiedAt;

    @Column(length = 1000)
    private String guardianNotificationMemo;

    /*
     * 정상적인 진행 단계와 별도로 관리하는 예외 결과
     */
    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private FollowUpOutcome followUpOutcome =
            FollowUpOutcome.NONE;

    /*
     * 복지사 공통 메모
     */
    @Column(length = 1000)
    private String note;

    /*
     * 실제 최종 조치 결과
     */
    @Enumerated(EnumType.STRING)
    private FinalResult finalResult;

    /*
     * 리콜 및 KC 조회 결과
     */
    @Column(length = 1000)
    private String recallReason;

    private String kcStatus;

    private String kcCertNum;

    private String kcCertState;

    private String kcCertOrganName;

    private String kcCertProductName;

    private String kcCertModelName;

    private String kcCertManufacturer;

    private LocalDateTime lastCheckedAt;

    /*
     * 데이터 생성·수정 시각
     */
    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /*
     * 최초 등록 시 기본값 설정
     */
    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();

        if (receivedAt == null) {
            receivedAt = now;
        }

        if (followUpStatus == null) {
            followUpStatus = FollowUpStatus.RECEIVED;
        }

        if (followUpOutcome == null) {
            followUpOutcome = FollowUpOutcome.NONE;
        }

        if (recallCheckStatus == null) {
            recallCheckStatus =
                    RecallCheckStatus.NOT_CHECKED;
        }

        if (recallStatus == null) {
            recallStatus = RecallStatus.UNKNOWN;
        }

        if (currentUseStatus == null) {
            currentUseStatus =
                    CurrentUseStatus.UNKNOWN;
        }

        if (modelMatchStatus == null) {
            modelMatchStatus =
                    ModelMatchStatus.UNKNOWN;
        }

        if (guardianContactStatus == null) {
            guardianContactStatus =
                    GuardianContactStatus.UNKNOWN;
        }

        if (stopGuidanceCompleted == null) {
            stopGuidanceCompleted = false;
        }

        if (recallMatchedFields == null) {
            recallMatchedFields =
                    new ArrayList<>();
        }

        if (recallMissingFields == null) {
            recallMissingFields =
                    new ArrayList<>();
        }
    }

    /*
     * 공식 리콜 여부
     */
    public enum RecallStatus {
        UNKNOWN,
        SAFE,
        RECALLED
    }

    /*
     * 리콜 자동 판정 결과
     */
    public enum RecallDecisionStatus {
        RECALL_CONFIRMED,
        NO_MATCH_FOUND,
        REVIEW_REQUIRED
    }

    /*
     * 리콜 조회 성공 여부
     */
    public enum RecallCheckStatus {
        SUCCESS,
        FAILED,
        NOT_CHECKED
    }

    /*
     * 제품 사용 상태
     */
    public enum CurrentUseStatus {
        UNKNOWN,
        IN_USE,
        NOT_IN_USE,
        STOPPED,
        DISPOSED,
        NOT_OWNED
    }

    /*
     * 제품 모델 일치 상태
     */
    public enum ModelMatchStatus {
        UNKNOWN,
        MATCHED,
        NEEDS_REVIEW,
        NOT_MATCHED
    }

    /*
     * 기존 보호자 연락 상태
     */
    public enum GuardianContactStatus {
        UNKNOWN,
        SCHEDULED,
        COMPLETED,
        UNREACHABLE
    }

    /*
     * 후속조치 전체 진행 상태
     */
    public enum FollowUpStatus {
        RECEIVED,
        ASSIGNED,
        CONTACTING,
        CONFIRMED,
        SCHEDULED,
        REFERRED,
        COMPLETED,
        GUARDIAN_NOTIFIED;

        /*
         * 현재 상태에서 다음 상태로 변경할 수 있는지 확인합니다.
         */
        public boolean canTransitionTo(
                FollowUpStatus next
        ) {
            if (next == null) {
                return false;
            }

            /*
             * 동일 상태 저장은 허용합니다.
             * 메모나 상세 정보만 수정할 때 필요합니다.
             */
            if (this == next) {
                return true;
            }

            return switch (this) {
                case RECEIVED ->
                        next == ASSIGNED;

                case ASSIGNED ->
                        next == CONTACTING;

                case CONTACTING ->
                        next == CONFIRMED
                                || next == SCHEDULED;

                case CONFIRMED ->
                        next == SCHEDULED
                                || next == REFERRED
                                || next == COMPLETED;

                case SCHEDULED ->
                        next == CONFIRMED
                                || next == REFERRED
                                || next == COMPLETED;

                case REFERRED ->
                        next == COMPLETED;

                case COMPLETED ->
                        next == GUARDIAN_NOTIFIED;

                case GUARDIAN_NOTIFIED ->
                        false;
            };
        }
    }

    /*
     * 후속조치 예외 결과
     */
    public enum FollowUpOutcome {
        NONE,
        UNREACHABLE,
        DECLINED,
        NOT_OWNED,
        NOT_RECALLED
    }

    /*
     * 어르신 또는 보호자 연락 결과
     */
    public enum ContactResult {
        UNKNOWN,

        /*
         * 연락 후 제품 보유 여부 및 상태를 확인함
         */
        CONFIRMED,

        /*
         * 추후 다시 연락해야 함
         */
        CALLBACK_REQUIRED,

        /*
         * 전화나 메시지로 연락하지 못함
         */
        UNREACHABLE,

        /*
         * 어르신 또는 보호자가 조치를 거부함
         */
        DECLINED,

        /*
         * 해당 제품을 보유하지 않음
         */
        NOT_OWNED
    }

    /*
     * 최종 조치 결과
     */
    public enum FinalResult {
        USE_STOPPED,
        RECOVERED,
        EXCHANGED,
        REPAIRED,
        REFUNDED,
        NOT_OWNED,
        NOT_RECALLED,
        UNREACHABLE,
        DECLINED
    }
}