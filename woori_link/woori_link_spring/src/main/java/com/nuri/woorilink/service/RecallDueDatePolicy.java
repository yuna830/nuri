package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.RecallNotice;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.entity.RiskAssessment;
import com.nuri.woorilink.repository.RecallNoticeRepository;
import com.nuri.woorilink.repository.RiskAssessmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecallDueDatePolicy {

    private static final Pattern IMMEDIATE_STOP_PATTERN =
            Pattern.compile(
                    "즉시.{0,12}(사용.{0,4}(중지|중단)|회수)"
                            + "|사용.{0,4}(중지|중단|금지)",
                    Pattern.CASE_INSENSITIVE
            );

    private final RiskAssessmentRepository
            riskAssessmentRepository;

    private final RecallNoticeRepository
            recallNoticeRepository;

    /**
     * 리콜 후속조치의 처리 예정일을 계산합니다.
     *
     * 우선순위:
     * 1. 복지사가 직접 선택한 날짜
     * 2. 이미 완료된 후속조치
     * 3. 즉시 사용 중지 + 현재 사용 중
     * 4. 어르신 위험도 HIGH
     * 5. 어르신 위험도 MEDIUM
     * 6. 공식 리콜 확정
     * 7. 추가 확인 필요
     * 8. 일반 후속조치
     */
    public DueDateDecision decide(
            RegisteredProduct product,
            LocalDate requestedDate
    ) {
        if (product == null) {
            throw new IllegalArgumentException(
                    "처리 기한을 계산할 제품 정보가 필요합니다."
            );
        }

        /*
         * 복지사가 직접 입력한 날짜가 가장 우선입니다.
         */
        if (requestedDate != null) {
            return new DueDateDecision(
                    requestedDate,
                    DueDatePriority.MANUAL,
                    "복지사가 직접 처리 예정일을 지정했습니다."
            );
        }

        /*
         * 이미 완료된 건은 처리 예정일을 설정하지 않습니다.
         */
        if (isCompleted(product)) {
            return new DueDateDecision(
                    null,
                    DueDatePriority.COMPLETED,
                    "이미 완료된 후속조치이므로 처리 예정일을 설정하지 않습니다."
            );
        }

        LocalDate today =
                LocalDate.now();

        /*
         * 제품을 현재 사용 중이고,
         * 공식 안내에 즉시 사용 중지 문구가 있는 경우
         * 오늘을 처리 예정일로 설정합니다.
         */
        if (
                isCurrentlyInUse(product)
                        && requiresImmediateStop(product)
        ) {
            return new DueDateDecision(
                    today,
                    DueDatePriority.IMMEDIATE,
                    "현재 사용 중인 제품이며 즉시 사용 중지가 필요한 제품이므로 당일 처리 대상으로 설정했습니다."
            );
        }

        RiskAssessment.RiskLevel riskLevel =
                getLatestRiskLevel(
                        product.getSeniorId()
                );

        /*
         * 어르신 최신 위험도 HIGH
         */
        if (
                riskLevel
                        == RiskAssessment.RiskLevel.HIGH
        ) {
            return new DueDateDecision(
                    today.plusDays(1),
                    DueDatePriority.HIGH,
                    "대상 어르신의 최신 위험도가 높음으로 평가되어 1일 이내 처리하도록 설정했습니다."
            );
        }

        /*
         * 어르신 최신 위험도 MEDIUM
         */
        if (
                riskLevel
                        == RiskAssessment.RiskLevel.MEDIUM
        ) {
            return new DueDateDecision(
                    today.plusDays(3),
                    DueDatePriority.MEDIUM,
                    "대상 어르신의 최신 위험도가 보통으로 평가되어 3일 이내 처리하도록 설정했습니다."
            );
        }

        /*
         * 공식 리콜 확정
         */
        if (isRecallConfirmed(product)) {
            return new DueDateDecision(
                    today.plusDays(3),
                    DueDatePriority.RECALL_CONFIRMED,
                    "공식 리콜 대상 제품으로 확인되어 3일 이내 처리하도록 설정했습니다."
            );
        }

        /*
         * 추가 확인 필요
         */
        if (
                product.getRecallDecisionStatus()
                        == RegisteredProduct
                        .RecallDecisionStatus
                        .REVIEW_REQUIRED
        ) {
            return new DueDateDecision(
                    today.plusDays(5),
                    DueDatePriority.REVIEW_REQUIRED,
                    "제품 식별정보 또는 리콜 범위 추가 확인이 필요하여 5일 이내 확인하도록 설정했습니다."
            );
        }

        /*
         * 일반 후속조치
         */
        return new DueDateDecision(
                today.plusDays(5),
                DueDatePriority.GENERAL,
                "일반 리콜 후속조치 대상으로 5일 이내 확인하도록 설정했습니다."
        );
    }

    /**
     * 어르신의 가장 최근 위험도 평가 등급을 조회합니다.
     */
    private RiskAssessment.RiskLevel
    getLatestRiskLevel(
            Long seniorId
    ) {
        if (seniorId == null) {
            return null;
        }

        return riskAssessmentRepository
                .findTopBySeniorIdOrderByAssessedAtDesc(
                        seniorId
                )
                .map(
                        RiskAssessment::getLevel
                )
                .orElse(null);
    }

    /**
     * 이미 완료된 후속조치인지 확인합니다.
     */
    private boolean isCompleted(
            RegisteredProduct product
    ) {
        RegisteredProduct.FollowUpStatus status =
                product.getFollowUpStatus();

        return status
                == RegisteredProduct
                .FollowUpStatus
                .COMPLETED
                || status
                == RegisteredProduct
                .FollowUpStatus
                .GUARDIAN_NOTIFIED;
    }

    /**
     * 현재 제품을 사용 중인지 확인합니다.
     */
    private boolean isCurrentlyInUse(
            RegisteredProduct product
    ) {
        return product.getCurrentUseStatus()
                == RegisteredProduct
                .CurrentUseStatus
                .IN_USE;
    }

    /**
     * 공식 리콜 대상으로 확정된 제품인지 확인합니다.
     */
    private boolean isRecallConfirmed(
            RegisteredProduct product
    ) {
        return product.getRecallStatus()
                == RegisteredProduct
                .RecallStatus
                .RECALLED
                || product.getRecallDecisionStatus()
                == RegisteredProduct
                .RecallDecisionStatus
                .RECALL_CONFIRMED;
    }

    /**
     * 공식 소비자 행동요령 또는 기존 리콜 사유에
     * 즉시 사용 중지 안내가 포함되어 있는지 확인합니다.
     */
    private boolean requiresImmediateStop(
            RegisteredProduct product
    ) {
        String officialConsumerAction =
                getOfficialConsumerAction(
                        product
                );

        if (nonBlank(officialConsumerAction)) {
            return IMMEDIATE_STOP_PATTERN
                    .matcher(
                            officialConsumerAction
                    )
                    .find();
        }

        String fallbackText =
                product.getRecallReason();

        return nonBlank(fallbackText)
                && IMMEDIATE_STOP_PATTERN
                .matcher(
                        fallbackText
                )
                .find();
    }

    /**
     * 제품과 일치한 공식 리콜 공고의
     * 소비자 행동요령을 조회합니다.
     */
    private String getOfficialConsumerAction(
            RegisteredProduct product
    ) {
        Long recallNoticeId =
                product.getMatchedRecallNoticeId();

        if (recallNoticeId == null) {
            return null;
        }

        return recallNoticeRepository
                .findById(
                        recallNoticeId
                )
                .map(
                        RecallNotice::getConsumerAction
                )
                .orElse(null);
    }

    private boolean nonBlank(
            String value
    ) {
        return value != null
                && !value.isBlank();
    }

    public enum DueDatePriority {
        MANUAL,
        IMMEDIATE,
        HIGH,
        MEDIUM,
        RECALL_CONFIRMED,
        REVIEW_REQUIRED,
        GENERAL,
        COMPLETED
    }

    public record DueDateDecision(
            LocalDate dueDate,
            DueDatePriority priority,
            String reason
    ) {
    }
}