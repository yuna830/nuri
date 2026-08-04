package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.GuardianRecallFollowUpResponse;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.GuardianRepository;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GuardianRecallFollowUpService {

    private static final String GUARDIAN_ROLE =
            "GUARDIAN";

    private final RegisteredProductRepository
            productRepository;

    private final SeniorRepository
            seniorRepository;

    private final GuardianRepository
            guardianRepository;

    /**
     * 로그인한 보호자와 연결된 모든 어르신의
     * 리콜 후속조치 진행 정보를 조회합니다.
     */
    public List<GuardianRecallFollowUpResponse> getList(
            AuthenticatedUser authenticatedUser
    ) {
        Long guardianId =
                requireGuardian(
                        authenticatedUser
                );

        List<Senior> linkedSeniors =
                seniorRepository.findByGuardianId(
                        guardianId
                );

        if (linkedSeniors.isEmpty()) {
            return List.of();
        }

        List<Long> seniorIds =
                linkedSeniors
                        .stream()
                        .map(
                                Senior::getId
                        )
                        .toList();

        return productRepository
                .findBySeniorIdInOrderByUpdatedAtDesc(
                        seniorIds
                )
                .stream()
                .filter(
                        this::isRecallFollowUpTarget
                )
                .map(product ->
                        toResponse(
                                product,
                                findSeniorName(
                                        linkedSeniors,
                                        product.getSeniorId()
                                )
                        )
                )
                .toList();
    }

    /**
     * 특정 제품의 보호자 공개용 진행 정보를 조회합니다.
     *
     * 로그인한 보호자와 연결되지 않은 어르신의 제품이면
     * 조회를 차단합니다.
     */
    public GuardianRecallFollowUpResponse getDetail(
            Long guardianId,
            Long registeredProductId
    ) {
        if (guardianId == null) {
            throw new AccessDeniedException(
                    "보호자 정보가 확인되지 않습니다."
            );
        }

        if (registeredProductId == null) {
            throw new IllegalArgumentException(
                    "등록 제품 ID가 필요합니다."
            );
        }

        RegisteredProduct product =
                productRepository
                        .findById(
                                registeredProductId
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "등록 제품을 찾을 수 없습니다: "
                                                + registeredProductId
                                )
                        );

        if (product.getSeniorId() == null) {
            throw new IllegalArgumentException(
                    "제품 사용자 정보가 등록되어 있지 않습니다."
            );
        }

        Senior senior =
                seniorRepository
                        .findById(
                                product.getSeniorId()
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "제품 사용자 정보를 찾을 수 없습니다."
                                )
                        );

        if (
                senior.getGuardianId() == null
                        || !guardianId.equals(
                        senior.getGuardianId()
                )
        ) {
            throw new AccessDeniedException(
                    "이 제품의 진행 상태를 조회할 권한이 없습니다."
            );
        }

        return toResponse(
                product,
                senior.getName()
        );
    }

    /**
     * JWT 사용자가 보호자인지 확인하고
     * 보호자 사용자 ID를 반환합니다.
     */
    private Long requireGuardian(
            AuthenticatedUser authenticatedUser
    ) {
        if (authenticatedUser == null) {
            throw new AccessDeniedException(
                    "로그인 정보가 확인되지 않습니다."
            );
        }

        String role =
                normalizeRole(
                        authenticatedUser.getRole()
                );

        if (!GUARDIAN_ROLE.equals(role)) {
            throw new AccessDeniedException(
                    "보호자만 리콜 진행 상태를 조회할 수 있습니다."
            );
        }

        Long guardianId =
                authenticatedUser.getUserId();

        if (guardianId == null) {
            throw new AccessDeniedException(
                    "보호자 사용자 ID가 확인되지 않습니다."
            );
        }

        if (
                !guardianRepository.existsById(
                        guardianId
                )
        ) {
            throw new AccessDeniedException(
                    "보호자 계정을 찾을 수 없습니다."
            );
        }

        return guardianId;
    }

    /**
     * 제품을 조회합니다.
     */
    private RegisteredProduct getProduct(
            Long registeredProductId
    ) {
        if (registeredProductId == null) {
            throw new IllegalArgumentException(
                    "등록 제품 ID가 필요합니다."
            );
        }

        return productRepository
                .findById(
                        registeredProductId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "등록 제품을 찾을 수 없습니다: "
                                        + registeredProductId
                        )
                );
    }

    /**
     * 제품 소유 어르신을 조회합니다.
     */
    private Senior getSenior(
            Long seniorId
    ) {
        if (seniorId == null) {
            throw new IllegalArgumentException(
                    "제품에 연결된 어르신 정보가 없습니다."
            );
        }

        return seniorRepository
                .findById(
                        seniorId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "어르신을 찾을 수 없습니다: "
                                        + seniorId
                        )
                );
    }

    /**
     * 로그인 보호자와 어르신의 연결 관계를 검증합니다.
     */
    private void validateGuardianSeniorRelation(
            Long guardianId,
            Senior senior
    ) {
        boolean linked =
                seniorRepository
                        .findByGuardianId(
                                guardianId
                        )
                        .stream()
                        .anyMatch(linkedSenior ->
                                linkedSenior
                                        .getId()
                                        .equals(
                                                senior.getId()
                                        )
                        );

        if (!linked) {
            throw new AccessDeniedException(
                    "현재 보호자와 연결된 어르신의 제품이 아닙니다."
            );
        }
    }

    /**
     * 보호자 화면에 공개할 리콜 관련 제품인지 확인합니다.
     */
    private boolean isRecallFollowUpTarget(
            RegisteredProduct product
    ) {
        if (product == null) {
            return false;
        }

        return product.getRecallStatus()
                == RegisteredProduct.RecallStatus.RECALLED

                || product.getRecallDecisionStatus()
                == RegisteredProduct
                .RecallDecisionStatus
                .RECALL_CONFIRMED

                || product.getRecallDecisionStatus()
                == RegisteredProduct
                .RecallDecisionStatus
                .REVIEW_REQUIRED;
    }

    /**
     * 동일 목록에서 어르신 이름을 찾습니다.
     */
    private String findSeniorName(
            List<Senior> seniors,
            Long seniorId
    ) {
        if (seniorId == null) {
            return null;
        }

        return seniors
                .stream()
                .filter(senior ->
                        seniorId.equals(
                                senior.getId()
                        )
                )
                .map(
                        Senior::getName
                )
                .findFirst()
                .orElse(null);
    }

    /**
     * 내부 상태를 보호자 공개 상태로 변환합니다.
     */
    private GuardianRecallFollowUpResponse.PublicStatus
    getPublicStatus(
            RegisteredProduct product
    ) {
        RegisteredProduct.FollowUpStatus status =
                product.getFollowUpStatus();

        if (status == null) {
            return GuardianRecallFollowUpResponse
                    .PublicStatus
                    .RECEIVED;
        }

        return switch (status) {
            case RECEIVED ->
                    GuardianRecallFollowUpResponse
                            .PublicStatus
                            .RECEIVED;

            case ASSIGNED ->
                    GuardianRecallFollowUpResponse
                            .PublicStatus
                            .WORKER_ASSIGNED;

            case CONTACTING ->
                    GuardianRecallFollowUpResponse
                            .PublicStatus
                            .CONTACT_IN_PROGRESS;

            case CONFIRMED ->
                    GuardianRecallFollowUpResponse
                            .PublicStatus
                            .PRODUCT_CONFIRMED;

            case SCHEDULED ->
                    GuardianRecallFollowUpResponse
                            .PublicStatus
                            .SCHEDULED;

            case REFERRED ->
                    GuardianRecallFollowUpResponse
                            .PublicStatus
                            .AGENCY_LINKED;

            case COMPLETED ->
                    GuardianRecallFollowUpResponse
                            .PublicStatus
                            .COMPLETED;

            case GUARDIAN_NOTIFIED ->
                    GuardianRecallFollowUpResponse
                            .PublicStatus
                            .RESULT_NOTIFIED;
        };
    }

    /**
     * 보호자 공개 상태 제목을 반환합니다.
     */
    private String getPublicStatusLabel(
            GuardianRecallFollowUpResponse.PublicStatus status
    ) {
        return switch (status) {
            case RECEIVED ->
                    "리콜 조치 접수";

            case WORKER_ASSIGNED ->
                    "담당 복지사 배정";

            case CONTACT_IN_PROGRESS ->
                    "확인 진행 중";

            case PRODUCT_CONFIRMED ->
                    "제품 상태 확인 완료";

            case SCHEDULED ->
                    "상담 또는 방문 예정";

            case AGENCY_LINKED ->
                    "관련 기관 연계";

            case COMPLETED ->
                    "필요한 조치 완료";

            case RESULT_NOTIFIED ->
                    "처리 결과 안내 완료";
        };
    }

    /**
     * 보호자 공개 상태 설명을 반환합니다.
     */
    private String getPublicStatusDescription(
            GuardianRecallFollowUpResponse.PublicStatus status
    ) {
        return switch (status) {
            case RECEIVED ->
                    "등록된 제품의 리콜 후속조치가 접수되었습니다.";

            case WORKER_ASSIGNED ->
                    "담당 복지사가 배정되어 확인을 준비하고 있습니다.";

            case CONTACT_IN_PROGRESS ->
                    "제품 보유 여부와 현재 사용 상태를 확인하고 있습니다.";

            case PRODUCT_CONFIRMED ->
                    "제품의 보유 여부와 사용 상태 확인이 완료되었습니다.";

            case SCHEDULED ->
                    "전화 상담, 방문 또는 제조사 문의 일정이 등록되었습니다.";

            case AGENCY_LINKED ->
                    "필요한 처리를 위해 관련 기관 또는 제조사에 연계되었습니다.";

            case COMPLETED ->
                    "제품 사용 중단, 교환, 수리 또는 환불 등의 조치가 완료되었습니다.";

            case RESULT_NOTIFIED ->
                    "최종 처리 결과가 보호자에게 안내되었습니다.";
        };
    }

    /**
     * 최종 처리 결과의 보호자 표시 문구를 반환합니다.
     */
    private String getFinalResultLabel(
            RegisteredProduct.FinalResult result
    ) {
        if (result == null) {
            return null;
        }

        return switch (result) {
            case USE_STOPPED ->
                    "제품 사용 중단";

            case RECOVERED ->
                    "제품 회수";

            case EXCHANGED ->
                    "제품 교환";

            case REPAIRED ->
                    "제품 수리";

            case REFUNDED ->
                    "환불 완료";

            case NOT_OWNED ->
                    "제품 미보유";

            case NOT_RECALLED ->
                    "리콜 대상 아님";

            case UNREACHABLE ->
                    "연락 확인 필요";

            case DECLINED ->
                    "조치 진행 안 함";
        };
    }

    /**
     * 일정 유형을 보호자용 문구로 변환합니다.
     */
    private String getPublicScheduleType(
            String scheduleType
    ) {
        if (
                scheduleType == null
                        || scheduleType.isBlank()
        ) {
            return null;
        }

        return switch (
                scheduleType.trim().toUpperCase()
                ) {
            case "PHONE_CONSULTATION" ->
                    "전화 상담";

            case "HOME_VISIT" ->
                    "가정 방문";

            case "AGENCY_VISIT" ->
                    "기관 방문";

            case "MANUFACTURER_CONTACT" ->
                    "제조사 문의";

            default ->
                    "처리 일정";
        };
    }

    /**
     * 보호자 공개용 DTO를 생성합니다.
     */
    private GuardianRecallFollowUpResponse toResponse(
            RegisteredProduct product,
            String seniorName
    ) {
        GuardianRecallFollowUpResponse.PublicStatus
                publicStatus =
                getPublicStatus(
                        product
                );

        boolean guardianNotificationCompleted =
                product.getGuardianNotifiedAt() != null

                        || product.getFollowUpStatus()
                        == RegisteredProduct
                        .FollowUpStatus
                        .GUARDIAN_NOTIFIED;

        return new GuardianRecallFollowUpResponse(
                product.getId(),

                product.getSeniorId(),
                seniorName,

                product.getProductName(),
                product.getManufacturer(),
                product.getModelNumber(),

                product.getRecallStatus(),
                product.getRecallDecisionStatus(),

                publicStatus,
                getPublicStatusLabel(
                        publicStatus
                ),
                getPublicStatusDescription(
                        publicStatus
                ),

                product.getReceivedAt(),
                product.getNextActionDate(),

                product.getScheduledAt(),
                getPublicScheduleType(
                        product.getScheduleType()
                ),
                product.getSchedulePlace(),

                product.getReferralAgency(),
                product.getReferredAt(),

                product.getFinalResult(),
                getFinalResultLabel(
                        product.getFinalResult()
                ),
                product.getCompletedAt(),

                guardianNotificationCompleted,
                product.getGuardianNotifiedAt(),

                product.getUpdatedAt()
        );
    }

    private String normalizeRole(
            String role
    ) {
        if (role == null) {
            return "";
        }

        return role
                .replaceFirst(
                        "^ROLE_",
                        ""
                )
                .trim()
                .toUpperCase();
    }
}