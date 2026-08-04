package com.nuri.woorilink.service;

import com.nuri.woorilink.common.client.KcApiClient;
import com.nuri.woorilink.common.client.RecallApiClient;
import com.nuri.woorilink.dto.ProductRecallResponse;
import com.nuri.woorilink.dto.RecallNoticeDto;
import com.nuri.woorilink.dto.RecallWorkflowUpdateRequest;
import com.nuri.woorilink.entity.ActionRecord;
import com.nuri.woorilink.entity.RecallNotice;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.entity.VisitSchedule;
import com.nuri.woorilink.repository.ActionRecordRepository;
import com.nuri.woorilink.repository.GuardianRepository;
import com.nuri.woorilink.repository.RecallNoticeRepository;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.repository.VisitScheduleRepository;
import com.nuri.woorilink.repository.WelfareWorkerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductRecallService {

    private final RegisteredProductRepository productRepository;
    private final SeniorRepository seniorRepository;
    private final ActionRecordRepository actionRecordRepository;
    private final RecallApiClient recallApiClient;
    private final KcApiClient kcApiClient;
    private final WelfareWorkerRepository welfareWorkerRepository;
    private final RecallSafetyService recallSafetyService;
    private final RecallNoticeRepository recallNoticeRepository;
    private final GuardianRepository guardianRepository;
    private final VisitScheduleRepository visitScheduleRepository;

    public List<ProductRecallResponse> getBySenior(Long seniorId) {
        return productRepository.findBySeniorId(seniorId)
                .stream()
                .map(this::toRecallResponse)
                .toList();
    }

    public void validateGuardianAccess(
            Long guardianId,
            Long seniorId
    ) {
        if (guardianId == null || seniorId == null) {
            throw new IllegalArgumentException(
                    "보호자와 대상 어르신 정보가 필요합니다."
            );
        }

        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "대상 어르신을 찾을 수 없습니다."
                        )
                );

        if (!guardianId.equals(senior.getGuardianId())) {
            throw new IllegalArgumentException(
                    "연결된 어르신의 제품만 등록할 수 있습니다."
            );
        }
    }

    public List<ProductRecallResponse> getRecalled() {
        return productRepository.findByRecallStatus(
                        RegisteredProduct.RecallStatus.RECALLED
                )
                .stream()
                .map(this::toRecallResponse)
                .toList();
    }

    public List<ProductRecallResponse> getRecalledByWelfareWorker(
            Long welfareWorkerId
    ) {
        List<Long> seniorIds =
                seniorRepository.findByWelfareWorkerId(
                                welfareWorkerId
                        )
                        .stream()
                        .map(Senior::getId)
                        .toList();

        if (seniorIds.isEmpty()) {
            return List.of();
        }

        return productRepository
                .findBySeniorIdInAndRecallStatus(
                        seniorIds,
                        RegisteredProduct.RecallStatus.RECALLED
                )
                .stream()
                .map(this::toRecallResponse)
                .toList();
    }

    private ProductRecallResponse toRecallResponse(
            RegisteredProduct product
    ) {
        Senior senior = product.getSeniorId() == null
                ? null
                : seniorRepository.findById(
                product.getSeniorId()
        ).orElse(null);

        String stopGuidanceWorkerName =
                product.getStopGuidanceWorkerId() == null
                        ? null
                        : welfareWorkerRepository
                        .findById(
                                product.getStopGuidanceWorkerId()
                        )
                        .map(worker -> worker.getName())
                        .orElse(null);

        RecallNotice notice =
                product.getMatchedRecallNoticeId() == null
                        ? null
                        : recallNoticeRepository.findById(
                        product.getMatchedRecallNoticeId()
                ).orElse(null);

        String inquiryTel =
                notice == null
                        || !nonBlank(notice.getInquiryTel())
                        ? extractRecallContact(
                        product.getRecallReason()
                )
                        : notice.getInquiryTel();

        RegisteredProduct.RecallStatus recallStatus =
                effectiveRecallStatus(product, notice);

        String displayProductName =
                displayProductName(product, notice);

        String displayManufacturer =
                displayManufacturer(product, notice);

        return new ProductRecallResponse(
                product.getId(),
                product.getSeniorId(),
                senior == null ? null : senior.getName(),
                senior == null ? null : senior.getAge(),

                displayProductName,
                displayManufacturer,
                product.getBrandName(),
                product.getModelNumber(),
                product.getBarcode(),
                product.getCertificationNumber(),
                product.getRegistrationSource(),

                recallStatus,
                product.getCurrentUseStatus(),
                product.getModelMatchStatus(),

                product.getContactMethod(),

                product.getStopGuidanceCompleted(),
                product.getStopGuidanceCompletedAt(),
                product.getStopGuidanceMethod(),
                product.getStopGuidanceTarget(),
                product.getStopGuidanceWorkerId(),
                stopGuidanceWorkerName,
                product.getStopGuidanceMemo(),

                product.getGuardianContactStatus(),
                product.getGuardianContactMethod(),
                product.getGuardianContactedAt(),
                product.getGuardianContactMemo(),

                product.getFollowUpType(),
                product.getNextActionDate(),

                product.getFollowUpStatus(),
                product.getFollowUpOutcome(),

                product.getNote(),
                product.getFinalResult(),

                product.getRecallReason(),

                product.getKcStatus(),
                product.getKcCertNum(),
                product.getKcCertState(),
                product.getKcCertOrganName(),
                product.getKcCertProductName(),
                product.getKcCertModelName(),
                product.getKcCertManufacturer(),

                product.getLastCheckedAt(),
                product.getCreatedAt(),
                product.getUpdatedAt(),

                product.getRecallDecisionStatus(),
                product.getRecallCheckStatus(),

                RecallNoticeDto.from(notice),

                product.getRecallMatchedFields(),
                product.getRecallMissingFields(),
                product.getRecallDecisionReason(),

                notice == null
                        ? null
                        : notice.getDefectDescription(),

                notice == null
                        ? null
                        : notice.getHazardDescription(),

                notice == null
                        ? null
                        : notice.getConsumerAction(),

                inquiryTel,

                notice == null
                        ? null
                        : notice.getPublishDate(),

                notice == null
                        ? null
                        : notice.getSourceName(),

                notice == null
                        ? null
                        : notice.getSourceUrl(),

                product.getLastSuccessfulCheckedAt(),
                product.getLastCheckErrorMessage()
        );
    }

    private RegisteredProduct.RecallStatus effectiveRecallStatus(
            RegisteredProduct product,
            RecallNotice notice
    ) {
        if (
                product.getRecallStatus()
                        == RegisteredProduct.RecallStatus.SAFE
                        || product.getRecallDecisionStatus()
                        == RegisteredProduct.RecallDecisionStatus.NO_MATCH_FOUND
        ) {
            return RegisteredProduct.RecallStatus.SAFE;
        }

        if (
                product.getRecallStatus()
                        == RegisteredProduct.RecallStatus.RECALLED
                        || product.getRecallDecisionStatus()
                        == RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED
                        || product.getRecallDecisionStatus()
                        == RegisteredProduct.RecallDecisionStatus.REVIEW_REQUIRED
                        || notice != null
                        || product.getMatchedRecallNoticeId() != null
                        || nonBlank(product.getRecallReason())
        ) {
            return RegisteredProduct.RecallStatus.RECALLED;
        }

        return product.getRecallStatus();
    }

    private String displayProductName(
            RegisteredProduct product,
            RecallNotice notice
    ) {
        String officialProductName =
                notice == null
                        ? null
                        : cleanOfficialProductName(
                        notice.getProductName()
                );

        if (nonBlank(officialProductName)) {
            return officialProductName;
        }

        return nonBlank(product.getProductName())
                ? product.getProductName()
                : "제품명 확인 필요";
    }

    private String displayManufacturer(
            RegisteredProduct product,
            RecallNotice notice
    ) {
        if (nonBlank(product.getManufacturer())) {
            return product.getManufacturer();
        }

        if (notice == null) {
            return null;
        }

        return firstNonBlank(
                notice.getManufacturerName(),
                notice.getRecallCompanyName(),
                notice.getBrandName()
        );
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (nonBlank(value)) {
                return value.trim();
            }
        }

        return null;
    }

    private String cleanOfficialProductName(
            String productName
    ) {
        if (!nonBlank(productName)) {
            return null;
        }

        String trimmed = productName.trim();

        int open = trimmed.indexOf('(');

        int close = trimmed.endsWith(")")
                ? trimmed.length() - 1
                : -1;

        if (open > 0 && close > open) {
            String before =
                    trimmed.substring(0, open).trim();

            String inside =
                    trimmed.substring(
                            open + 1,
                            close
                    ).trim();

            if (before.equals(inside)) {
                return before;
            }
        }

        return trimmed;
    }

    @Transactional
    public RegisteredProduct register(
            RegisteredProduct product
    ) {
        normalizeRegistration(product);

        if (product.getReceivedAt() == null) {
            product.setReceivedAt(
                    LocalDateTime.now()
            );
        }

        if (product.getFollowUpStatus() == null) {
            product.setFollowUpStatus(
                    RegisteredProduct.FollowUpStatus.RECEIVED
            );
        }

        if (product.getFollowUpOutcome() == null) {
            product.setFollowUpOutcome(
                    RegisteredProduct.FollowUpOutcome.NONE
            );
        }

        RegisteredProduct saved =
                productRepository.save(product);

        if (recallSafetyService.enabled()) {
            try {
                return recallSafetyService.check(
                        saved.getId()
                );
            } catch (Exception ignored) {
                return productRepository.findById(
                        saved.getId()
                ).orElse(saved);
            }
        }

        applyRecallStatus(saved);

        return productRepository.save(saved);
    }

    private void normalizeRegistration(
            RegisteredProduct product
    ) {
        product.setProductName(
                blankToNull(product.getProductName())
        );

        product.setBrandName(
                blankToNull(product.getBrandName())
        );

        product.setManufacturer(
                blankToNull(product.getManufacturer())
        );

        product.setModelNumber(
                blankToNull(product.getModelNumber())
        );

        product.setBarcode(
                blankToNull(product.getBarcode())
        );

        product.setCertificationNumber(
                blankToNull(
                        product.getCertificationNumber()
                )
        );

        if (
                product.getProductName() == null
                        && product.getBrandName() == null
                        && product.getManufacturer() == null
                        && product.getModelNumber() == null
                        && product.getBarcode() == null
                        && product.getCertificationNumber() == null
        ) {
            throw new IllegalArgumentException(
                    "제품명 또는 제품 식별정보를 하나 이상 입력해 주세요."
            );
        }
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return value.trim();
    }

    @Transactional
    public void refreshAll() {
        productRepository.findAll().forEach(product -> {
            try {
                if (recallSafetyService.enabled()) {
                    recallSafetyService.check(
                            product.getId()
                    );
                } else {
                    applyRecallStatus(product);
                    productRepository.save(product);
                }
            } catch (Exception ignored) {
            }
        });
    }

    public ProductRecallResponse getResponse(
            Long productId
    ) {
        RegisteredProduct product =
                productRepository.findById(productId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "등록 제품을 찾을 수 없습니다: "
                                                + productId
                                )
                        );

        return toRecallResponse(product);
    }

    public RegisteredProduct getForGuardian(
            Long productId,
            Long guardianId
    ) {
        RegisteredProduct product =
                productRepository.findById(productId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "등록 제품을 찾을 수 없습니다: "
                                                + productId
                                )
                        );

        validateGuardianAccess(
                guardianId,
                product.getSeniorId()
        );

        return product;
    }

    @Transactional
    public RegisteredProduct checkRecall(
            Long productId
    ) {
        if (recallSafetyService.enabled()) {
            return recallSafetyService.check(
                    productId
            );
        }

        RegisteredProduct product =
                productRepository.findById(productId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "등록 제품을 찾을 수 없습니다: "
                                                + productId
                                )
                        );

        applyRecallStatus(product);

        return productRepository.save(product);
    }

    @Transactional
    public void delete(Long id) {
        RegisteredProduct product =
                productRepository.findById(id)
                        .orElse(null);

        if (
                product != null
                        && product.getSeniorId() != null
        ) {
            actionRecordRepository
                    .deleteBySeniorIdAndActionTypeAndNoteContaining(
                            product.getSeniorId(),
                            ActionRecord.ActionType.RECALL,
                            "제품ID: " + id
                    );
        }

        productRepository.deleteById(id);
    }

    @Transactional
    public RegisteredProduct updateCurrentUseStatus(
            Long id,
            RegisteredProduct.CurrentUseStatus status,
            Long guardianId
    ) {
        RegisteredProduct product =
                productRepository.findById(id)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "등록 제품을 찾을 수 없습니다: "
                                                + id
                                )
                        );

        validateGuardianAccess(
                guardianId,
                product.getSeniorId()
        );

        product.setCurrentUseStatus(status);

        if (
                status
                        == RegisteredProduct.CurrentUseStatus.STOPPED
        ) {
            String guardianName =
                    guardianRepository.findById(guardianId)
                            .map(guardian ->
                                    guardian.getName()
                            )
                            .orElse("보호자");

            product.setStopGuidanceCompleted(true);

            product.setStopGuidanceCompletedAt(
                    LocalDateTime.now()
            );

            product.setStopGuidanceMethod(
                    "GUARDIAN_WEB"
            );

            product.setStopGuidanceTarget(
                    guardianName
            );

            product.setStopGuidanceMemo(
                    "보호자가 제품 사용 중지를 확인했습니다."
            );
        }

        return productRepository.save(product);
    }

    @Transactional
    public ProductRecallResponse updateProductSenior(
            Long productId,
            Long targetSeniorId,
            Long guardianId
    ) {
        if (productId == null) {
            throw new IllegalArgumentException(
                    "등록 제품 ID가 필요합니다."
            );
        }

        if (targetSeniorId == null) {
            throw new IllegalArgumentException(
                    "변경할 어르신 ID가 필요합니다."
            );
        }

        if (guardianId == null) {
            throw new IllegalArgumentException(
                    "보호자 정보가 필요합니다."
            );
        }

        RegisteredProduct product =
                productRepository.findById(productId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "등록 제품을 찾을 수 없습니다: "
                                                + productId
                                )
                        );

        Long previousSeniorId =
                product.getSeniorId();

        /*
         * 현재 제품이 로그인한 보호자와 연결된
         * 어르신의 제품인지 먼저 확인합니다.
         */
        validateGuardianAccess(
                guardianId,
                previousSeniorId
        );

        Senior targetSenior =
                seniorRepository.findById(targetSeniorId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "변경할 어르신을 찾을 수 없습니다: "
                                                + targetSeniorId
                                )
                        );

        /*
         * 변경 대상도 반드시 로그인한 보호자와
         * 연결된 어르신이어야 합니다.
         */
        if (
                targetSenior.getGuardianId() == null
                        || !guardianId.equals(
                        targetSenior.getGuardianId()
                )
        ) {
            throw new org.springframework.security.access.AccessDeniedException(
                    "연결된 어르신으로만 제품 사용자를 변경할 수 있습니다."
            );
        }

        /*
         * 동일한 어르신을 다시 선택한 경우
         * 별도 변경 없이 현재 응답을 반환합니다.
         */
        if (
                previousSeniorId != null
                        && previousSeniorId.equals(
                        targetSeniorId
                )
        ) {
            return toRecallResponse(product);
        }

        /*
         * 기존 어르신에게 생성된 리콜 업무 기록을 제거합니다.
         *
         * 현재 ProductRecallService.delete()에서도
         * 동일하게 제품 ID가 포함된 리콜 ActionRecord를
         * 정리하고 있으므로 같은 기준을 사용합니다.
         */
        if (previousSeniorId != null) {
            actionRecordRepository
                    .deleteBySeniorIdAndActionTypeAndNoteContaining(
                            previousSeniorId,
                            ActionRecord.ActionType.RECALL,
                            "제품ID: " + productId
                    );
        }

        product.setSeniorId(
                targetSeniorId
        );

        /*
         * 제품 자체의 리콜 판정 결과는 유지합니다.
         *
         * 다만 담당 대상이 변경되었으므로
         * 기존 복지사 배정과 연락·일정·완료 기록은
         * 새 대상에게 그대로 넘기지 않습니다.
         */
        resetFollowUpForSeniorChange(
                product
        );

        RegisteredProduct saved =
                productRepository.save(
                        product
                );

        return toRecallResponse(saved);
    }

    private void resetFollowUpForSeniorChange(
            RegisteredProduct product
    ) {
        LocalDateTime now =
                LocalDateTime.now();

        product.setFollowUpStatus(
                RegisteredProduct.FollowUpStatus.RECEIVED
        );

        product.setFollowUpOutcome(
                RegisteredProduct.FollowUpOutcome.NONE
        );

        product.setReceivedAt(
                now
        );

        /*
         * 담당 복지사 배정
         */
        product.setAssignedWorkerId(null);
        product.setAssignedAt(null);

        /*
         * 연락 기록
         */
        product.setContactTarget(null);
        product.setContactMethod(null);
        product.setContactedAt(null);
        product.setContactResult(null);
        product.setContactMemo(null);

        /*
         * 제품 사용 상태 확인 기록
         */
        product.setCurrentUseStatus(
                RegisteredProduct.CurrentUseStatus.UNKNOWN
        );

        product.setConfirmedAt(null);
        product.setConfirmationMemo(null);

        /*
         * 일정 정보
         */
        product.setScheduledAt(null);
        product.setScheduleType(null);
        product.setSchedulePlace(null);
        product.setScheduleMemo(null);

        /*
         * 기관 연계 정보
         */
        product.setReferralAgency(null);
        product.setReferralContactName(null);
        product.setReferralContactPhone(null);
        product.setReferredAt(null);
        product.setReferralMemo(null);

        /*
         * 완료 정보
         */
        product.setCompletedAt(null);
        product.setCompletionMemo(null);
        product.setFinalResult(null);

        /*
         * 보호자 최종 통보 정보
         */
        product.setGuardianNotificationMethod(null);
        product.setGuardianNotifiedAt(null);
        product.setGuardianNotificationMemo(null);

        /*
         * 다음 업무 계획
         */
        product.setFollowUpType(null);
        product.setNextActionDate(null);

        /*
         * 기존 보호자 연락 상태
         */
        product.setGuardianContactStatus(
                RegisteredProduct.GuardianContactStatus.UNKNOWN
        );

        product.setGuardianContactMethod(null);
        product.setGuardianContactedAt(null);
        product.setGuardianContactMemo(null);

        /*
         * 사용 중지 안내는 새 실제 사용자 기준으로
         * 다시 확인해야 합니다.
         */
        product.setStopGuidanceCompleted(false);
        product.setStopGuidanceCompletedAt(null);
        product.setStopGuidanceMethod(null);
        product.setStopGuidanceTarget(null);
        product.setStopGuidanceWorkerId(null);
        product.setStopGuidanceMemo(null);

        product.setNote(
                "제품 실제 사용자가 변경되어 후속조치가 다시 접수되었습니다."
        );
    }

    @Transactional
    public RegisteredProduct updateWorkflow(
            Long id,
            RecallWorkflowUpdateRequest request
    ) {
        RegisteredProduct product =
                productRepository.findById(id)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "등록 제품을 찾을 수 없습니다: "
                                                + id
                                )
                        );

        applyWorkflowRequest(
                product,
                request
        );

        applyFollowUpStatusChange(
                product,
                request.getFollowUpStatus()
        );

        applyAutomaticWorkflowValues(
                product,
                request
        );

        applyOutcomeValues(product);

        validateFollowUpStatusRequiredFields(
                product
        );

        RegisteredProduct saved =
                productRepository.save(product);

        syncRecallActionStatus(
                saved,
                request
        );

        syncRecallVisitSchedule(
                saved,
                request
        );

        return saved;
    }

    private void applyWorkflowRequest(
            RegisteredProduct product,
            RecallWorkflowUpdateRequest request
    ) {
        if (request.getModelMatchStatus() != null) {
            product.setModelMatchStatus(
                    request.getModelMatchStatus()
            );
        }

        if (request.getCurrentUseStatus() != null) {
            product.setCurrentUseStatus(
                    request.getCurrentUseStatus()
            );
        }

        /*
         * 사용 중단 안내 정보
         */
        if (request.getStopGuidanceCompleted() != null) {
            product.setStopGuidanceCompleted(
                    request.getStopGuidanceCompleted()
            );
        }

        if (request.getStopGuidanceCompletedAt() != null) {
            product.setStopGuidanceCompletedAt(
                    request.getStopGuidanceCompletedAt()
            );
        }

        if (request.getStopGuidanceMethod() != null) {
            product.setStopGuidanceMethod(
                    blankToNull(
                            request.getStopGuidanceMethod()
                    )
            );
        }

        if (request.getStopGuidanceTarget() != null) {
            product.setStopGuidanceTarget(
                    blankToNull(
                            request.getStopGuidanceTarget()
                    )
            );
        }

        if (request.getStopGuidanceWorkerId() != null) {
            product.setStopGuidanceWorkerId(
                    request.getStopGuidanceWorkerId()
            );
        }

        if (request.getStopGuidanceMemo() != null) {
            product.setStopGuidanceMemo(
                    blankToNull(
                            request.getStopGuidanceMemo()
                    )
            );
        }

        /*
         * 기존 보호자 연락 정보
         */
        if (request.getGuardianContactStatus() != null) {
            product.setGuardianContactStatus(
                    request.getGuardianContactStatus()
            );
        }

        if (request.getGuardianContactMethod() != null) {
            product.setGuardianContactMethod(
                    blankToNull(
                            request.getGuardianContactMethod()
                    )
            );
        }

        if (request.getGuardianContactedAt() != null) {
            product.setGuardianContactedAt(
                    request.getGuardianContactedAt()
            );
        }

        if (request.getGuardianContactMemo() != null) {
            product.setGuardianContactMemo(
                    blankToNull(
                            request.getGuardianContactMemo()
                    )
            );
        }

        /*
         * 담당자 배정 정보
         */
        if (request.getAssignedWorkerId() != null) {
            product.setAssignedWorkerId(
                    request.getAssignedWorkerId()
            );
        }

        if (request.getAssignedAt() != null) {
            product.setAssignedAt(
                    request.getAssignedAt()
            );
        }

        /*
         * 연락 정보
         */
        if (request.getContactTarget() != null) {
            product.setContactTarget(
                    blankToNull(
                            request.getContactTarget()
                    )
            );
        }

        if (request.getContactMethod() != null) {
            product.setContactMethod(
                    blankToNull(
                            request.getContactMethod()
                    )
            );
        }

        if (request.getContactedAt() != null) {
            product.setContactedAt(
                    request.getContactedAt()
            );
        }

        if (request.getContactResult() != null) {
            product.setContactResult(
                    request.getContactResult()
            );
        }

        if (request.getContactMemo() != null) {
            product.setContactMemo(
                    blankToNull(
                            request.getContactMemo()
                    )
            );
        }

        /*
         * 확인 완료 정보
         */
        if (request.getConfirmedAt() != null) {
            product.setConfirmedAt(
                    request.getConfirmedAt()
            );
        }

        if (request.getConfirmationMemo() != null) {
            product.setConfirmationMemo(
                    blankToNull(
                            request.getConfirmationMemo()
                    )
            );
        }

        /*
         * 일정 정보
         */
        if (request.getScheduledAt() != null) {
            product.setScheduledAt(
                    request.getScheduledAt()
            );
        }

        if (request.getScheduleType() != null) {
            product.setScheduleType(
                    blankToNull(
                            request.getScheduleType()
                    )
            );
        }

        if (request.getSchedulePlace() != null) {
            product.setSchedulePlace(
                    blankToNull(
                            request.getSchedulePlace()
                    )
            );
        }

        if (request.getScheduleMemo() != null) {
            product.setScheduleMemo(
                    blankToNull(
                            request.getScheduleMemo()
                    )
            );
        }

        /*
         * 기관 연계 정보
         */
        if (request.getReferralAgency() != null) {
            product.setReferralAgency(
                    blankToNull(
                            request.getReferralAgency()
                    )
            );
        }

        if (request.getReferralContactName() != null) {
            product.setReferralContactName(
                    blankToNull(
                            request.getReferralContactName()
                    )
            );
        }

        if (request.getReferralContactPhone() != null) {
            product.setReferralContactPhone(
                    blankToNull(
                            request.getReferralContactPhone()
                    )
            );
        }

        if (request.getReferredAt() != null) {
            product.setReferredAt(
                    request.getReferredAt()
            );
        }

        if (request.getReferralMemo() != null) {
            product.setReferralMemo(
                    blankToNull(
                            request.getReferralMemo()
                    )
            );
        }

        /*
         * 완료 정보
         */
        if (request.getCompletedAt() != null) {
            product.setCompletedAt(
                    request.getCompletedAt()
            );
        }

        if (request.getCompletionMemo() != null) {
            product.setCompletionMemo(
                    blankToNull(
                            request.getCompletionMemo()
                    )
            );
        }

        /*
         * 보호자 최종 통보 정보
         */
        if (
                request.getGuardianNotificationMethod()
                        != null
        ) {
            product.setGuardianNotificationMethod(
                    blankToNull(
                            request.getGuardianNotificationMethod()
                    )
            );
        }

        if (
                request.getGuardianNotifiedAt()
                        != null
        ) {
            product.setGuardianNotifiedAt(
                    request.getGuardianNotifiedAt()
            );
        }

        if (
                request.getGuardianNotificationMemo()
                        != null
        ) {
            product.setGuardianNotificationMemo(
                    blankToNull(
                            request.getGuardianNotificationMemo()
                    )
            );
        }

        /*
         * 다음 업무 계획
         */
        if (request.getFollowUpType() != null) {
            product.setFollowUpType(
                    blankToNull(
                            request.getFollowUpType()
                    )
            );
        }

        if (request.getNextActionDate() != null) {
            product.setNextActionDate(
                    request.getNextActionDate()
            );
        }

        /*
         * 예외 처리 결과
         */
        if (request.getFollowUpOutcome() != null) {
            product.setFollowUpOutcome(
                    request.getFollowUpOutcome()
            );
        }

        /*
         * 공통 메모
         */
        if (request.getNote() != null) {
            product.setNote(
                    blankToNull(request.getNote())
            );
        }

        /*
         * 최종 처리 결과
         */
        if (request.getFinalResult() != null) {
            product.setFinalResult(
                    request.getFinalResult()
            );
        }
    }

    private void applyFollowUpStatusChange(
            RegisteredProduct product,
            RegisteredProduct.FollowUpStatus nextStatus
    ) {
        if (nextStatus == null) {
            return;
        }

        RegisteredProduct.FollowUpStatus currentStatus =
                product.getFollowUpStatus();

        if (currentStatus == null) {
            product.setFollowUpStatus(nextStatus);
            return;
        }

        if (!currentStatus.canTransitionTo(nextStatus)) {
            throw new IllegalArgumentException(
                    "허용되지 않은 후속조치 상태 변경입니다: "
                            + currentStatus
                            + " → "
                            + nextStatus
            );
        }

        product.setFollowUpStatus(nextStatus);
    }

    private void applyAutomaticWorkflowValues(
            RegisteredProduct product,
            RecallWorkflowUpdateRequest request
    ) {
        RegisteredProduct.FollowUpStatus status =
                product.getFollowUpStatus();

        if (status == null) {
            return;
        }

        LocalDateTime now = LocalDateTime.now();

        switch (status) {
            case RECEIVED -> {
                if (product.getReceivedAt() == null) {
                    product.setReceivedAt(now);
                }
            }

            case ASSIGNED -> {
                if (product.getAssignedWorkerId() == null) {
                    Long workerId =
                            request.getAssignedWorkerId() != null
                                    ? request.getAssignedWorkerId()
                                    : request.getWelfareWorkerId();

                    product.setAssignedWorkerId(workerId);
                }

                if (product.getAssignedAt() == null) {
                    product.setAssignedAt(now);
                }
            }

            case CONTACTING -> {
                if (product.getAssignedWorkerId() == null) {
                    product.setAssignedWorkerId(
                            request.getWelfareWorkerId()
                    );
                }

                if (product.getAssignedAt() == null) {
                    product.setAssignedAt(now);
                }

                if (product.getContactedAt() == null) {
                    product.setContactedAt(now);
                }

                if (
                        product.getGuardianContactStatus()
                                == null
                                || product.getGuardianContactStatus()
                                == RegisteredProduct.GuardianContactStatus.UNKNOWN
                ) {
                    product.setGuardianContactStatus(
                            RegisteredProduct.GuardianContactStatus.SCHEDULED
                    );
                }
            }

            case CONFIRMED -> {
                if (product.getConfirmedAt() == null) {
                    product.setConfirmedAt(now);
                }

                if (
                        product.getGuardianContactStatus()
                                == RegisteredProduct.GuardianContactStatus.SCHEDULED
                ) {
                    product.setGuardianContactStatus(
                            RegisteredProduct.GuardianContactStatus.COMPLETED
                    );
                }

                if (
                        product.getGuardianContactedAt()
                                == null
                ) {
                    product.setGuardianContactedAt(now);
                }
            }

            case SCHEDULED -> {
                /*
                 * scheduledAt은 실제 예약 일시이므로
                 * 프론트에서 반드시 전달받습니다.
                 */
            }

            case REFERRED -> {
                if (product.getReferredAt() == null) {
                    product.setReferredAt(now);
                }
            }

            case COMPLETED -> {
                if (product.getCompletedAt() == null) {
                    product.setCompletedAt(now);
                }

                /*
                 * 완료 후에는 다음 업무 예정일을 제거합니다.
                 */
                product.setNextActionDate(null);
            }

            case GUARDIAN_NOTIFIED -> {
                if (product.getGuardianNotifiedAt() == null) {
                    product.setGuardianNotifiedAt(now);
                }

                product.setGuardianContactStatus(
                        RegisteredProduct.GuardianContactStatus.COMPLETED
                );

                if (
                        product.getGuardianContactedAt()
                                == null
                ) {
                    product.setGuardianContactedAt(now);
                }

                product.setNextActionDate(null);
            }
        }
    }

    private void applyOutcomeValues(
            RegisteredProduct product
    ) {
        RegisteredProduct.FollowUpOutcome outcome =
                product.getFollowUpOutcome();

        if (outcome == null) {
            product.setFollowUpOutcome(
                    RegisteredProduct.FollowUpOutcome.NONE
            );
            return;
        }

        switch (outcome) {
            case NONE -> {
            }

            case UNREACHABLE -> {
                product.setContactResult(
                        RegisteredProduct.ContactResult.UNREACHABLE
                );

                product.setGuardianContactStatus(
                        RegisteredProduct.GuardianContactStatus.UNREACHABLE
                );
            }

            case DECLINED ->
                    product.setContactResult(
                            RegisteredProduct.ContactResult.DECLINED
                    );

            case NOT_OWNED -> {
                product.setContactResult(
                        RegisteredProduct.ContactResult.NOT_OWNED
                );

                product.setCurrentUseStatus(
                        RegisteredProduct.CurrentUseStatus.NOT_OWNED
                );

                if (product.getFinalResult() == null) {
                    product.setFinalResult(
                            RegisteredProduct.FinalResult.NOT_OWNED
                    );
                }
            }

            case NOT_RECALLED -> {
                product.setRecallStatus(
                        RegisteredProduct.RecallStatus.SAFE
                );

                product.setRecallDecisionStatus(
                        RegisteredProduct.RecallDecisionStatus.NO_MATCH_FOUND
                );

                if (product.getFinalResult() == null) {
                    product.setFinalResult(
                            RegisteredProduct.FinalResult.NOT_RECALLED
                    );
                }
            }
        }
    }

    private void validateFollowUpStatusRequiredFields(
            RegisteredProduct product
    ) {
        RegisteredProduct.FollowUpStatus status =
                product.getFollowUpStatus();

        if (status == null) {
            throw new IllegalArgumentException(
                    "후속조치 상태가 필요합니다."
            );
        }

        switch (status) {
            case RECEIVED -> {
                if (product.getReceivedAt() == null) {
                    throw new IllegalArgumentException(
                            "접수 상태에서는 접수 시각이 필요합니다."
                    );
                }
            }

            case ASSIGNED -> {
                if (
                        product.getAssignedWorkerId()
                                == null
                ) {
                    throw new IllegalArgumentException(
                            "담당자 배정 상태에서는 담당 복지사가 필요합니다."
                    );
                }

                if (product.getAssignedAt() == null) {
                    throw new IllegalArgumentException(
                            "담당자 배정 상태에서는 배정 시각이 필요합니다."
                    );
                }
            }

            case CONTACTING -> {
                if (!nonBlank(
                        product.getContactTarget()
                )) {
                    throw new IllegalArgumentException(
                            "연락 중 상태에서는 연락 대상이 필요합니다."
                    );
                }

                if (!nonBlank(
                        product.getContactMethod()
                )) {
                    throw new IllegalArgumentException(
                            "연락 중 상태에서는 연락 방법이 필요합니다."
                    );
                }

                if (
                        product.getContactResult()
                                == null
                                || product.getContactResult()
                                == RegisteredProduct.ContactResult.UNKNOWN
                ) {
                    throw new IllegalArgumentException(
                            "연락 중 상태에서는 연락 결과가 필요합니다."
                    );
                }

                if (product.getContactedAt() == null) {
                    throw new IllegalArgumentException(
                            "연락 중 상태에서는 연락 시각이 필요합니다."
                    );
                }
            }

            case CONFIRMED -> {
                if (
                        product.getCurrentUseStatus()
                                == null
                                || product.getCurrentUseStatus()
                                == RegisteredProduct.CurrentUseStatus.UNKNOWN
                ) {
                    throw new IllegalArgumentException(
                            "확인 완료 상태에서는 현재 사용 상태가 필요합니다."
                    );
                }

                if (product.getConfirmedAt() == null) {
                    throw new IllegalArgumentException(
                            "확인 완료 상태에서는 확인 시각이 필요합니다."
                    );
                }
            }

            case SCHEDULED -> {
                if (product.getScheduledAt() == null) {
                    throw new IllegalArgumentException(
                            "일정 확정 상태에서는 예약 일시가 필요합니다."
                    );
                }

                if (!nonBlank(
                        product.getScheduleType()
                )) {
                    throw new IllegalArgumentException(
                            "일정 확정 상태에서는 일정 유형이 필요합니다."
                    );
                }
            }

            case REFERRED -> {
                if (!nonBlank(
                        product.getReferralAgency()
                )) {
                    throw new IllegalArgumentException(
                            "기관 연계 상태에서는 연계 기관이 필요합니다."
                    );
                }

                if (product.getReferredAt() == null) {
                    throw new IllegalArgumentException(
                            "기관 연계 상태에서는 연계 시각이 필요합니다."
                    );
                }
            }

            case COMPLETED -> {
                if (product.getFinalResult() == null) {
                    throw new IllegalArgumentException(
                            "조치 완료 상태에서는 최종 처리 결과가 필요합니다."
                    );
                }

                if (!nonBlank(
                        product.getCompletionMemo()
                )) {
                    throw new IllegalArgumentException(
                            "조치 완료 상태에서는 완료 내용이 필요합니다."
                    );
                }

                if (product.getCompletedAt() == null) {
                    throw new IllegalArgumentException(
                            "조치 완료 상태에서는 완료 시각이 필요합니다."
                    );
                }
            }

            case GUARDIAN_NOTIFIED -> {
                if (product.getFinalResult() == null) {
                    throw new IllegalArgumentException(
                            "보호자 통보 전 최종 처리 결과가 필요합니다."
                    );
                }

                if (!nonBlank(
                        product.getGuardianNotificationMethod()
                )) {
                    throw new IllegalArgumentException(
                            "보호자 안내 완료 상태에서는 통보 방법이 필요합니다."
                    );
                }

                if (!nonBlank(
                        product.getGuardianNotificationMemo()
                )) {
                    throw new IllegalArgumentException(
                            "보호자 안내 완료 상태에서는 통보 내용이 필요합니다."
                    );
                }

                if (
                        product.getGuardianNotifiedAt()
                                == null
                ) {
                    throw new IllegalArgumentException(
                            "보호자 안내 완료 상태에서는 통보 시각이 필요합니다."
                    );
                }
            }
        }
    }

    private void syncRecallVisitSchedule(
            RegisteredProduct product,
            RecallWorkflowUpdateRequest request
    ) {
        if (
                product.getSeniorId() == null
                        || product.getNextActionDate() == null
        ) {
            return;
        }

        if (!"방문 확인".equals(
                product.getFollowUpType()
        )) {
            return;
        }

        Senior senior =
                seniorRepository.findById(
                        product.getSeniorId()
                ).orElse(null);

        String seniorName =
                senior == null
                        || !nonBlank(senior.getName())
                        ? "어르신"
                        : senior.getName();

        Long welfareWorkerId =
                request.getWelfareWorkerId();

        if (
                welfareWorkerId == null
                        && product.getAssignedWorkerId()
                        != null
        ) {
            welfareWorkerId =
                    product.getAssignedWorkerId();
        }

        if (
                welfareWorkerId == null
                        && senior != null
        ) {
            welfareWorkerId =
                    senior.getWelfareWorkerId();
        }

        String productName =
                nonBlank(product.getProductName())
                        ? product.getProductName()
                        : "리콜 제품";

        String purpose =
                seniorName
                        + "님 - "
                        + productName
                        + " 리콜 조치 방문일";

        boolean exists =
                visitScheduleRepository
                        .findBySeniorId(
                                product.getSeniorId()
                        )
                        .stream()
                        .anyMatch(schedule ->
                                product.getNextActionDate()
                                        .equals(
                                                schedule.getVisitDate()
                                        )
                                        && purpose.equals(
                                        schedule.getPurpose()
                                )
                                        && schedule.getStatus()
                                        != VisitSchedule.VisitStatus.CANCELLED
                        );

        if (exists) {
            return;
        }

        visitScheduleRepository.save(
                VisitSchedule.builder()
                        .seniorId(
                                product.getSeniorId()
                        )
                        .welfareWorkerId(
                                welfareWorkerId
                        )
                        .visitDate(
                                product.getNextActionDate()
                        )
                        .purpose(purpose)
                        .note(
                                productName
                                        + " 리콜 후속 조치"
                        )
                        .status(
                                VisitSchedule.VisitStatus.PLANNED
                        )
                        .build()
        );
    }

    private void syncRecallActionStatus(
            RegisteredProduct product,
            RecallWorkflowUpdateRequest request
    ) {
        if (
                product.getSeniorId() == null
                        || !nonBlank(
                        product.getProductName()
                )
        ) {
            return;
        }

        List<ActionRecord> records =
                actionRecordRepository
                        .findBySeniorIdAndActionTypeAndProductNameOrderByCreatedAtDesc(
                                product.getSeniorId(),
                                ActionRecord.ActionType.RECALL,
                                product.getProductName()
                        );

        ActionRecord.ActionStatus status =
                recallActionStatus(product);

        Long welfareWorkerId =
                request.getWelfareWorkerId() != null
                        ? request.getWelfareWorkerId()
                        : product.getAssignedWorkerId();

        if (records.isEmpty()) {
            if (
                    !Boolean.TRUE.equals(
                            request.getCreateAction()
                    )
                            || welfareWorkerId == null
            ) {
                return;
            }

            actionRecordRepository.save(
                    ActionRecord.builder()
                            .seniorId(
                                    product.getSeniorId()
                            )
                            .welfareWorkerId(
                                    welfareWorkerId
                            )
                            .actionType(
                                    ActionRecord.ActionType.RECALL
                            )
                            .actionSubject(
                                    ActionRecord.ActionSubject.WELFARE_WORKER
                            )
                            .status(status)
                            .productName(
                                    product.getProductName()
                            )
                            .dueDate(
                                    product.getNextActionDate()
                            )
                            .note(
                                    product.getNote()
                            )
                            .immediateRisk(
                                    product.getCurrentUseStatus()
                                            == RegisteredProduct.CurrentUseStatus.IN_USE
                            )
                            .build()
            );

            return;
        }

        for (ActionRecord record : records) {
            record.setStatus(status);

            if (
                    status
                            == ActionRecord.ActionStatus.COMPLETED
            ) {
                record.setDueDate(null);
            } else if (
                    Boolean.TRUE.equals(
                            request.getCreateAction()
                    )
            ) {
                record.setDueDate(
                        product.getNextActionDate()
                );
            }

            if (welfareWorkerId != null) {
                record.setWelfareWorkerId(
                        welfareWorkerId
                );
            }

            if (nonBlank(product.getNote())) {
                record.setNote(
                        product.getNote()
                );
            }

            actionRecordRepository.save(record);
        }
    }

    private ActionRecord.ActionStatus recallActionStatus(
            RegisteredProduct product
    ) {
        RegisteredProduct.FollowUpStatus status =
                product.getFollowUpStatus();

        if (
                status
                        == RegisteredProduct.FollowUpStatus.COMPLETED
                        || status
                        == RegisteredProduct.FollowUpStatus.GUARDIAN_NOTIFIED
        ) {
            return ActionRecord.ActionStatus.COMPLETED;
        }

        if (
                status
                        == RegisteredProduct.FollowUpStatus.ASSIGNED
                        || status
                        == RegisteredProduct.FollowUpStatus.CONTACTING
                        || status
                        == RegisteredProduct.FollowUpStatus.CONFIRMED
                        || status
                        == RegisteredProduct.FollowUpStatus.SCHEDULED
                        || status
                        == RegisteredProduct.FollowUpStatus.REFERRED
        ) {
            return ActionRecord.ActionStatus.IN_PROGRESS;
        }

        return ActionRecord.ActionStatus.PENDING;
    }

    private void applyRecallStatus(
            RegisteredProduct product
    ) {
        RecallLookup lookup =
                lookupRecall(product);

        product.setRecallStatus(
                lookup.recalled()
                        ? RegisteredProduct.RecallStatus.RECALLED
                        : RegisteredProduct.RecallStatus.SAFE
        );

        product.setRecallReason(
                lookup.recalled()
                        ? lookup.detail()
                        : null
        );

        applyKcStatus(product);

        product.setLastCheckedAt(
                LocalDateTime.now()
        );
    }

    private void applyKcStatus(
            RegisteredProduct product
    ) {
        KcApiClient.KcLookup lookup =
                kcApiClient.lookup(
                        product.getCertificationNumber(),
                        product.getModelNumber(),
                        product.getProductName(),
                        product.getManufacturer()
                );

        product.setKcStatus(
                lookup.status()
        );

        product.setKcCertNum(
                lookup.certNum()
        );

        product.setKcCertState(
                lookup.certState()
        );

        product.setKcCertOrganName(
                lookup.certOrganName()
        );

        product.setKcCertProductName(
                lookup.productName()
        );

        product.setKcCertModelName(
                lookup.modelName()
        );

        product.setKcCertManufacturer(
                lookup.makerName()
        );
    }

    private RecallLookup lookupRecall(
            RegisteredProduct product
    ) {
        for (
                String term
                : buildRecallSearchTerms(product)
        ) {
            if (recallApiClient.isRecalled(term)) {
                String detail =
                        recallApiClient
                                .getRecallDetail(term);

                String reason =
                        detail != null
                                && !detail.isBlank()
                                ? detail
                                : "제품안전정보센터 리콜 목록에서 조회되었습니다. 검색어: "
                                + term;

                return new RecallLookup(
                        true,
                        reason
                );
            }
        }

        return new RecallLookup(false, null);
    }

    private List<String> buildRecallSearchTerms(
            RegisteredProduct product
    ) {
        Set<String> terms =
                new LinkedHashSet<>();

        addIfNotBlank(
                terms,
                product.getBarcode()
        );

        addIfNotBlank(
                terms,
                product.getCertificationNumber()
        );

        addIfNotBlank(
                terms,
                product.getModelNumber()
        );

        addIfNotBlank(
                terms,
                product.getProductName()
        );

        List<String> filtered =
                new ArrayList<>();

        for (String term : terms) {
            String normalized = term.trim();

            if (normalized.length() >= 2) {
                filtered.add(normalized);
            }
        }

        return filtered;
    }

    private void addIfNotBlank(
            Set<String> terms,
            String value
    ) {
        if (value == null) {
            return;
        }

        String normalized = value.trim();

        if (!normalized.isBlank()) {
            terms.add(normalized);
        }
    }

    private String extractRecallContact(
            String text
    ) {
        if (!nonBlank(text)) {
            return null;
        }

        for (String line : text.split("\\R")) {
            String lower =
                    line.toLowerCase();

            if (
                    line.contains("문의처")
                            || line.contains("연락처")
                            || line.contains("전화")
                            || lower.contains("tel")
            ) {
                return line
                        .replaceFirst(
                                "(?i)^.*?(문의처|연락처|전화|tel)\\s*[:：]?\\s*",
                                ""
                        )
                        .trim();
            }
        }

        return null;
    }

    private boolean nonBlank(String value) {
        return value != null
                && !value.isBlank();
    }

    private record RecallLookup(
            boolean recalled,
            String detail
    ) {
    }
}