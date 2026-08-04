package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.RecallFollowUpCreateRequest;
import com.nuri.woorilink.dto.RecallFollowUpRecordUpdateRequest;
import com.nuri.woorilink.dto.RecallFollowUpResponse;
import com.nuri.woorilink.dto.RecallFollowUpStatusUpdateRequest;
import com.nuri.woorilink.entity.RecallFollowUpHistory;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.RecallFollowUpHistoryRepository;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.repository.WelfareWorkerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecallFollowUpService {

    private static final String WELFARE_WORKER_ROLE =
            "WELFARE_WORKER";

    private final RegisteredProductRepository
            productRepository;

    private final RecallFollowUpHistoryRepository
            historyRepository;

    private final SeniorRepository
            seniorRepository;

    private final WelfareWorkerRepository
            welfareWorkerRepository;

    private final RecallDueDatePolicy
            recallDueDatePolicy;

    /**
     * 현재 로그인한 복지사를 담당자로 배정하고
     * 후속조치를 생성합니다.
     */
    @Transactional
    public RecallFollowUpResponse create(
            AuthenticatedUser authenticatedUser,
            RecallFollowUpCreateRequest request
    ) {
        Long workerId =
                requireWelfareWorker(
                        authenticatedUser
                );

        if (request == null) {
            throw new IllegalArgumentException(
                    "후속조치 생성 요청이 필요합니다."
            );
        }

        if (request.getRegisteredProductId() == null) {
            throw new IllegalArgumentException(
                    "등록 제품 ID가 필요합니다."
            );
        }

        RegisteredProduct product =
                getProduct(
                        request.getRegisteredProductId()
                );

        validateAssignedProduct(
                workerId,
                product
        );

        validateRecallTarget(
                product
        );

        RegisteredProduct.FollowUpStatus
                previousStatus =
                defaultStatus(
                        product
                );

        if (
                previousStatus
                        != RegisteredProduct
                        .FollowUpStatus
                        .RECEIVED
                        &&
                        previousStatus
                                != RegisteredProduct
                                .FollowUpStatus
                                .ASSIGNED
        ) {
            throw new IllegalArgumentException(
                    "이미 진행 중인 후속조치입니다. 현재 상태: "
                            + previousStatus
            );
        }

        validateExistingWorkerAssignment(
                workerId,
                product
        );

        LocalDateTime now =
                LocalDateTime.now();

        if (product.getReceivedAt() == null) {
            product.setReceivedAt(
                    now
            );
        }

        product.setAssignedWorkerId(
                workerId
        );

        product.setAssignedAt(
                now
        );

        product.setFollowUpType(
                blankToNull(
                        request.getFollowUpType()
                )
        );

        /*
         * 복지사가 날짜를 직접 선택했다면 해당 날짜를 사용하고,
         * 선택하지 않았다면 위험도별 자동 기한을 적용합니다.
         */
        RecallDueDatePolicy.DueDateDecision
                dueDateDecision =
                recallDueDatePolicy.decide(
                        product,
                        request.getNextActionDate()
                );

        product.setNextActionDate(
                dueDateDecision.dueDate()
        );

        product.setNote(
                blankToNull(
                        request.getNote()
                )
        );

        product.setFollowUpStatus(
                RegisteredProduct
                        .FollowUpStatus
                        .ASSIGNED
        );

        if (product.getFollowUpOutcome() == null) {
            product.setFollowUpOutcome(
                    RegisteredProduct
                            .FollowUpOutcome
                            .NONE
            );
        }

        RegisteredProduct saved =
                productRepository.save(
                        product
                );

        saveHistory(
                saved.getId(),
                previousStatus,
                saved.getFollowUpStatus(),
                RecallFollowUpHistory
                        .ChangeType
                        .CREATED,
                workerId,
                buildCreateHistoryMemo(
                        request.getNote(),
                        dueDateDecision
                )
        );

        return toResponse(
                saved,
                true
        );
    }

    /**
     * 후속조치 생성 이력에
     * 자동 처리 기한 근거를 함께 저장합니다.
     */
    private String buildCreateHistoryMemo(
            String requestNote,
            RecallDueDatePolicy.DueDateDecision
                    dueDateDecision
    ) {
        String baseMessage =
                firstNonBlank(
                        requestNote,
                        "후속조치가 생성되고 담당 복지사가 배정되었습니다."
                );

        if (
                dueDateDecision == null
                        || dueDateDecision.dueDate() == null
        ) {
            return baseMessage;
        }

        return baseMessage
                + " 처리 예정일: "
                + dueDateDecision.dueDate()
                + ". "
                + dueDateDecision.reason();
    }

    /**
     * 로그인한 복지사가 담당하는 어르신의
     * 후속조치만 조회합니다.
     */
    public List<RecallFollowUpResponse> getList(
            AuthenticatedUser authenticatedUser,
            Long seniorId,
            RegisteredProduct.FollowUpStatus status
    ) {
        Long workerId =
                requireWelfareWorker(
                        authenticatedUser
                );

        if (seniorId != null) {
            validateAssignedSenior(
                    workerId,
                    seniorId
            );
        }

        Stream<RegisteredProduct> stream =
                productRepository
                        .findAll()
                        .stream()
                        .filter(
                                this::isRecallTarget
                        )
                        .filter(product ->
                                isProductAssignedToWorker(
                                        product,
                                        workerId
                                )
                        );

        if (seniorId != null) {
            stream = stream.filter(product ->
                    seniorId.equals(
                            product.getSeniorId()
                    )
            );
        }

        if (status != null) {
            stream = stream.filter(product ->
                    status
                            == product.getFollowUpStatus()
            );
        }

        return stream
                .sorted(
                        Comparator.comparing(
                                this::effectiveUpdatedAt,
                                Comparator.nullsLast(
                                        Comparator.reverseOrder()
                                )
                        )
                )
                .map(product ->
                        toResponse(
                                product,
                                false
                        )
                )
                .toList();
    }

    /**
     * 담당 대상의 후속조치 상세만 조회합니다.
     */
    public RecallFollowUpResponse getDetail(
            AuthenticatedUser authenticatedUser,
            Long registeredProductId
    ) {
        Long workerId =
                requireWelfareWorker(
                        authenticatedUser
                );

        RegisteredProduct product =
                getProduct(
                        registeredProductId
                );

        validateAssignedProduct(
                workerId,
                product
        );

        validateExistingWorkerAssignment(
                workerId,
                product
        );

        validateRecallTarget(
                product
        );

        return toResponse(
                product,
                true
        );
    }

    /**
     * 담당 대상의 후속조치 상태를 변경합니다.
     */
    @Transactional
    public RecallFollowUpResponse updateStatus(
            AuthenticatedUser authenticatedUser,
            Long registeredProductId,
            RecallFollowUpStatusUpdateRequest request
    ) {
        Long workerId =
                requireWelfareWorker(
                        authenticatedUser
                );

        if (request == null) {
            throw new IllegalArgumentException(
                    "상태 변경 요청이 필요합니다."
            );
        }

        if (request.getFollowUpStatus() == null) {
            throw new IllegalArgumentException(
                    "변경할 후속조치 상태가 필요합니다."
            );
        }

        RegisteredProduct product =
                getProduct(
                        registeredProductId
                );

        validateAssignedProduct(
                workerId,
                product
        );

        validateExistingWorkerAssignment(
                workerId,
                product
        );

        validateRecallTarget(
                product
        );

        RegisteredProduct.FollowUpStatus
                previousStatus =
                defaultStatus(
                        product
                );

        RegisteredProduct.FollowUpStatus
                nextStatus =
                request.getFollowUpStatus();

        if (
                !previousStatus.canTransitionTo(
                        nextStatus
                )
        ) {
            throw new IllegalArgumentException(
                    "허용되지 않은 후속조치 상태 변경입니다: "
                            + previousStatus
                            + " → "
                            + nextStatus
            );
        }

        applyCommonStatusRequest(
                product,
                request
        );

        /*
         * 요청 날짜가 있으면 수동 날짜를 반영하고,
         * 예정일이 비어 있으면 위험도별 자동 날짜를 적용합니다.
         */
        applyAutomaticDueDateIfNeeded(
                product,
                nextStatus,
                request.getNextActionDate()
        );

        applyStatusInformation(
                workerId,
                product,
                request
        );

        product.setFollowUpStatus(
                nextStatus
        );

        applyOutcome(
                product
        );

        validateStatusInformation(
                product
        );

        RegisteredProduct saved =
                productRepository.save(
                        product
                );

        saveHistory(
                saved.getId(),
                previousStatus,
                nextStatus,
                RecallFollowUpHistory
                        .ChangeType
                        .STATUS_CHANGED,
                workerId,
                firstNonBlank(
                        request.getChangeMemo(),
                        previousStatus
                                + " 상태에서 "
                                + nextStatus
                                + " 상태로 변경되었습니다."
                )
        );

        return toResponse(
                saved,
                true
        );
    }

    /**
     * 상태를 유지하면서 담당 대상의
     * 상세 기록을 수정합니다.
     */
    @Transactional
    public RecallFollowUpResponse updateRecord(
            AuthenticatedUser authenticatedUser,
            Long registeredProductId,
            RecallFollowUpRecordUpdateRequest request
    ) {
        Long workerId =
                requireWelfareWorker(
                        authenticatedUser
                );

        if (request == null) {
            throw new IllegalArgumentException(
                    "기록 수정 요청이 필요합니다."
            );
        }

        RegisteredProduct product =
                getProduct(
                        registeredProductId
                );

        validateAssignedProduct(
                workerId,
                product
        );

        validateExistingWorkerAssignment(
                workerId,
                product
        );

        validateRecallTarget(
                product
        );

        applyRecordUpdate(
                product,
                request
        );

        /*
         * 기록 수정 요청에 날짜가 포함됐다면 해당 날짜를 사용합니다.
         * 기존 날짜가 없고 미완료 상태라면 자동 기한을 보완합니다.
         */
        applyAutomaticDueDateIfNeeded(
                product,
                product.getFollowUpStatus(),
                request.getNextActionDate()
        );

        applyOutcome(
                product
        );

        validateStatusInformation(
                product
        );

        RegisteredProduct saved =
                productRepository.save(
                        product
                );

        saveHistory(
                saved.getId(),
                saved.getFollowUpStatus(),
                saved.getFollowUpStatus(),
                RecallFollowUpHistory
                        .ChangeType
                        .RECORD_UPDATED,
                workerId,
                firstNonBlank(
                        request.getChangeMemo(),
                        "후속조치 상세 기록이 수정되었습니다."
                )
        );

        return toResponse(
                saved,
                true
        );
    }

    /**
     * 담당 대상의 후속조치 이력을 조회합니다.
     */
    public List<
            RecallFollowUpResponse.HistoryResponse
            > getHistories(
            AuthenticatedUser authenticatedUser,
            Long registeredProductId
    ) {
        Long workerId =
                requireWelfareWorker(
                        authenticatedUser
                );

        RegisteredProduct product =
                getProduct(
                        registeredProductId
                );

        validateAssignedProduct(
                workerId,
                product
        );

        validateExistingWorkerAssignment(
                workerId,
                product
        );

        return historyRepository
                .findByRegisteredProductIdOrderByCreatedAtDesc(
                        registeredProductId
                )
                .stream()
                .map(
                        this::toHistoryResponse
                )
                .toList();
    }

    /**
     * 자동 처리 기한을 적용합니다.
     *
     * 완료 상태:
     * nextActionDate 제거
     *
     * 수동 날짜 존재:
     * 수동 날짜 우선
     *
     * 기존 예정일 존재:
     * 기존 예정일 유지
     *
     * 기존 예정일 없음:
     * 위험도별 자동 예정일 설정
     */
    private void applyAutomaticDueDateIfNeeded(
            RegisteredProduct product,
            RegisteredProduct.FollowUpStatus targetStatus,
            LocalDate requestedDate
    ) {
        if (
                targetStatus
                        == RegisteredProduct
                        .FollowUpStatus
                        .COMPLETED
                        || targetStatus
                        == RegisteredProduct
                        .FollowUpStatus
                        .GUARDIAN_NOTIFIED
        ) {
            product.setNextActionDate(
                    null
            );

            return;
        }

        if (requestedDate != null) {
            product.setNextActionDate(
                    requestedDate
            );

            return;
        }

        /*
         * 이미 예정일이 있다면 상태를 저장할 때마다
         * 날짜가 뒤로 밀리지 않도록 기존 날짜를 유지합니다.
         */
        if (product.getNextActionDate() != null) {
            return;
        }

        RecallDueDatePolicy.DueDateDecision decision =
                recallDueDatePolicy.decide(
                        product,
                        null
                );

        product.setNextActionDate(
                decision.dueDate()
        );
    }

    /**
     * JWT 인증 사용자가 복지사인지 확인하고
     * 실제 사용자 ID를 반환합니다.
     */
    private Long requireWelfareWorker(
            AuthenticatedUser authenticatedUser
    ) {
        if (authenticatedUser == null) {
            throw new AccessDeniedException(
                    "로그인 정보가 확인되지 않습니다."
            );
        }

        String role =
                authenticatedUser.getRole();

        if (
                role == null
                        || !WELFARE_WORKER_ROLE.equals(
                        normalizeRole(role)
                )
        ) {
            throw new AccessDeniedException(
                    "복지사만 리콜 후속조치를 처리할 수 있습니다."
            );
        }

        Long workerId =
                authenticatedUser.getUserId();

        if (workerId == null) {
            throw new AccessDeniedException(
                    "복지사 사용자 ID가 확인되지 않습니다."
            );
        }

        if (
                !welfareWorkerRepository.existsById(
                        workerId
                )
        ) {
            throw new AccessDeniedException(
                    "복지사 계정을 찾을 수 없습니다."
            );
        }

        return workerId;
    }

    /**
     * 특정 어르신이 현재 로그인한 복지사의
     * 담당 대상인지 확인합니다.
     */
    private Senior validateAssignedSenior(
            Long workerId,
            Long seniorId
    ) {
        if (seniorId == null) {
            throw new IllegalArgumentException(
                    "어르신 ID가 필요합니다."
            );
        }

        Senior senior =
                seniorRepository
                        .findById(
                                seniorId
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "어르신을 찾을 수 없습니다: "
                                                + seniorId
                                )
                        );

        if (
                senior.getWelfareWorkerId() == null
                        || !workerId.equals(
                        senior.getWelfareWorkerId()
                )
        ) {
            throw new AccessDeniedException(
                    "현재 복지사의 담당 대상이 아닙니다."
            );
        }

        return senior;
    }

    /**
     * 등록 제품의 소유 어르신이
     * 현재 로그인한 복지사의 담당 대상인지 확인합니다.
     */
    private void validateAssignedProduct(
            Long workerId,
            RegisteredProduct product
    ) {
        if (product == null) {
            throw new IllegalArgumentException(
                    "등록 제품 정보가 필요합니다."
            );
        }

        validateAssignedSenior(
                workerId,
                product.getSeniorId()
        );
    }

    /**
     * 제품이 다른 복지사에게 이미 배정된 경우
     * 조회와 수정을 차단합니다.
     */
    private void validateExistingWorkerAssignment(
            Long workerId,
            RegisteredProduct product
    ) {
        Long assignedWorkerId =
                product.getAssignedWorkerId();

        if (
                assignedWorkerId != null
                        && !workerId.equals(
                        assignedWorkerId
                )
        ) {
            throw new AccessDeniedException(
                    "다른 복지사에게 배정된 후속조치입니다."
            );
        }
    }

    /**
     * 목록 조회 시 담당 관계를 확인합니다.
     */
    private boolean isProductAssignedToWorker(
            RegisteredProduct product,
            Long workerId
    ) {
        if (
                product == null
                        || product.getSeniorId() == null
        ) {
            return false;
        }

        Senior senior =
                seniorRepository
                        .findById(
                                product.getSeniorId()
                        )
                        .orElse(null);

        if (
                senior == null
                        || senior.getWelfareWorkerId() == null
                        || !workerId.equals(
                        senior.getWelfareWorkerId()
                )
        ) {
            return false;
        }

        Long assignedWorkerId =
                product.getAssignedWorkerId();

        return assignedWorkerId == null
                || workerId.equals(
                assignedWorkerId
        );
    }

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

    private RegisteredProduct.FollowUpStatus
    defaultStatus(
            RegisteredProduct product
    ) {
        if (product.getFollowUpStatus() == null) {
            product.setFollowUpStatus(
                    RegisteredProduct
                            .FollowUpStatus
                            .RECEIVED
            );
        }

        if (product.getReceivedAt() == null) {
            product.setReceivedAt(
                    LocalDateTime.now()
            );
        }

        return product.getFollowUpStatus();
    }

    private void applyCommonStatusRequest(
            RegisteredProduct product,
            RecallFollowUpStatusUpdateRequest request
    ) {
        if (request.getFollowUpType() != null) {
            product.setFollowUpType(
                    blankToNull(
                            request.getFollowUpType()
                    )
            );
        }

        /*
         * nextActionDate는
         * applyAutomaticDueDateIfNeeded()에서 처리합니다.
         */

        if (request.getFollowUpOutcome() != null) {
            product.setFollowUpOutcome(
                    request.getFollowUpOutcome()
            );
        }
    }

    private void applyStatusInformation(
            Long workerId,
            RegisteredProduct product,
            RecallFollowUpStatusUpdateRequest request
    ) {
        LocalDateTime now =
                LocalDateTime.now();

        switch (request.getFollowUpStatus()) {
            case RECEIVED -> {
                if (product.getReceivedAt() == null) {
                    product.setReceivedAt(
                            now
                    );
                }
            }

            case ASSIGNED -> {
                product.setAssignedWorkerId(
                        workerId
                );

                product.setAssignedAt(
                        now
                );
            }

            case CONTACTING -> {
                product.setContactTarget(
                        blankToNull(
                                request.getContactTarget()
                        )
                );

                product.setContactMethod(
                        blankToNull(
                                request.getContactMethod()
                        )
                );

                product.setContactResult(
                        request.getContactResult()
                );

                product.setContactMemo(
                        blankToNull(
                                request.getContactMemo()
                        )
                );

                product.setContactedAt(
                        now
                );
            }

            case CONFIRMED -> {
                product.setCurrentUseStatus(
                        request.getCurrentUseStatus()
                );

                product.setConfirmationMemo(
                        blankToNull(
                                request.getConfirmationMemo()
                        )
                );

                product.setConfirmedAt(
                        now
                );
            }

            case SCHEDULED -> {
                product.setScheduledAt(
                        request.getScheduledAt()
                );

                product.setScheduleType(
                        blankToNull(
                                request.getScheduleType()
                        )
                );

                product.setSchedulePlace(
                        blankToNull(
                                request.getSchedulePlace()
                        )
                );

                product.setScheduleMemo(
                        blankToNull(
                                request.getScheduleMemo()
                        )
                );
            }

            case REFERRED -> {
                product.setReferralAgency(
                        blankToNull(
                                request.getReferralAgency()
                        )
                );

                product.setReferralContactName(
                        blankToNull(
                                request.getReferralContactName()
                        )
                );

                product.setReferralContactPhone(
                        blankToNull(
                                request.getReferralContactPhone()
                        )
                );

                product.setReferralMemo(
                        blankToNull(
                                request.getReferralMemo()
                        )
                );

                product.setReferredAt(
                        now
                );
            }

            case COMPLETED -> {
                product.setFinalResult(
                        request.getFinalResult()
                );

                product.setCompletionMemo(
                        blankToNull(
                                request.getCompletionMemo()
                        )
                );

                product.setCompletedAt(
                        now
                );

                product.setNextActionDate(
                        null
                );
            }

            case GUARDIAN_NOTIFIED -> {
                product.setGuardianNotificationMethod(
                        blankToNull(
                                request.getGuardianNotificationMethod()
                        )
                );

                product.setGuardianNotificationMemo(
                        blankToNull(
                                request.getGuardianNotificationMemo()
                        )
                );

                product.setGuardianNotifiedAt(
                        now
                );

                product.setNextActionDate(
                        null
                );

                product.setGuardianContactStatus(
                        RegisteredProduct
                                .GuardianContactStatus
                                .COMPLETED
                );

                if (
                        product.getGuardianContactedAt()
                                == null
                ) {
                    product.setGuardianContactedAt(
                            now
                    );
                }
            }
        }
    }

    private void applyRecordUpdate(
            RegisteredProduct product,
            RecallFollowUpRecordUpdateRequest request
    ) {
        /*
         * request.assignedWorkerId는 사용하지 않습니다.
         * 담당자 임의 변경은 허용하지 않습니다.
         */

        if (request.getFollowUpType() != null) {
            product.setFollowUpType(
                    blankToNull(
                            request.getFollowUpType()
                    )
            );
        }

        /*
         * nextActionDate는
         * applyAutomaticDueDateIfNeeded()에서 처리합니다.
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

        if (request.getCurrentUseStatus() != null) {
            product.setCurrentUseStatus(
                    request.getCurrentUseStatus()
            );
        }

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

        if (request.getFinalResult() != null) {
            product.setFinalResult(
                    request.getFinalResult()
            );
        }

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

        if (request.getFollowUpOutcome() != null) {
            product.setFollowUpOutcome(
                    request.getFollowUpOutcome()
            );
        }

        if (request.getNote() != null) {
            product.setNote(
                    blankToNull(
                            request.getNote()
                    )
            );
        }
    }

    private void validateStatusInformation(
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
                            "접수 시각이 필요합니다."
                    );
                }
            }

            case ASSIGNED -> {
                if (
                        product.getAssignedWorkerId()
                                == null
                ) {
                    throw new IllegalArgumentException(
                            "담당 복지사 정보가 필요합니다."
                    );
                }

                if (product.getAssignedAt() == null) {
                    throw new IllegalArgumentException(
                            "담당자 배정 시각이 필요합니다."
                    );
                }
            }

            case CONTACTING -> {
                if (
                        !nonBlank(
                                product.getContactTarget()
                        )
                ) {
                    throw new IllegalArgumentException(
                            "연락 대상이 필요합니다."
                    );
                }

                if (
                        !nonBlank(
                                product.getContactMethod()
                        )
                ) {
                    throw new IllegalArgumentException(
                            "연락 방법이 필요합니다."
                    );
                }

                if (
                        product.getContactResult()
                                == null
                                || product.getContactResult()
                                == RegisteredProduct
                                .ContactResult
                                .UNKNOWN
                ) {
                    throw new IllegalArgumentException(
                            "연락 결과가 필요합니다."
                    );
                }

                if (product.getContactedAt() == null) {
                    throw new IllegalArgumentException(
                            "연락 시각이 필요합니다."
                    );
                }
            }

            case CONFIRMED -> {
                if (
                        product.getCurrentUseStatus()
                                == null
                                || product.getCurrentUseStatus()
                                == RegisteredProduct
                                .CurrentUseStatus
                                .UNKNOWN
                ) {
                    throw new IllegalArgumentException(
                            "제품 사용 상태가 필요합니다."
                    );
                }

                if (product.getConfirmedAt() == null) {
                    throw new IllegalArgumentException(
                            "확인 시각이 필요합니다."
                    );
                }
            }

            case SCHEDULED -> {
                if (product.getScheduledAt() == null) {
                    throw new IllegalArgumentException(
                            "예약 일시가 필요합니다."
                    );
                }

                if (
                        !nonBlank(
                                product.getScheduleType()
                        )
                ) {
                    throw new IllegalArgumentException(
                            "일정 유형이 필요합니다."
                    );
                }
            }

            case REFERRED -> {
                if (
                        !nonBlank(
                                product.getReferralAgency()
                        )
                ) {
                    throw new IllegalArgumentException(
                            "연계 기관이 필요합니다."
                    );
                }

                if (product.getReferredAt() == null) {
                    throw new IllegalArgumentException(
                            "기관 연계 시각이 필요합니다."
                    );
                }
            }

            case COMPLETED -> {
                if (product.getFinalResult() == null) {
                    throw new IllegalArgumentException(
                            "최종 처리 결과가 필요합니다."
                    );
                }

                if (
                        !nonBlank(
                                product.getCompletionMemo()
                        )
                ) {
                    throw new IllegalArgumentException(
                            "완료 내용이 필요합니다."
                    );
                }

                if (product.getCompletedAt() == null) {
                    throw new IllegalArgumentException(
                            "조치 완료 시각이 필요합니다."
                    );
                }
            }

            case GUARDIAN_NOTIFIED -> {
                if (product.getFinalResult() == null) {
                    throw new IllegalArgumentException(
                            "최종 처리 결과가 필요합니다."
                    );
                }

                if (
                        !nonBlank(
                                product.getGuardianNotificationMethod()
                        )
                ) {
                    throw new IllegalArgumentException(
                            "보호자 통보 방법이 필요합니다."
                    );
                }

                if (
                        !nonBlank(
                                product.getGuardianNotificationMemo()
                        )
                ) {
                    throw new IllegalArgumentException(
                            "보호자 통보 내용이 필요합니다."
                    );
                }

                if (
                        product.getGuardianNotifiedAt()
                                == null
                ) {
                    throw new IllegalArgumentException(
                            "보호자 통보 시각이 필요합니다."
                    );
                }
            }
        }
    }

    private void applyOutcome(
            RegisteredProduct product
    ) {
        RegisteredProduct.FollowUpOutcome outcome =
                product.getFollowUpOutcome();

        if (outcome == null) {
            product.setFollowUpOutcome(
                    RegisteredProduct
                            .FollowUpOutcome
                            .NONE
            );

            return;
        }

        switch (outcome) {
            case NONE -> {
            }

            case UNREACHABLE -> {
                product.setContactResult(
                        RegisteredProduct
                                .ContactResult
                                .UNREACHABLE
                );

                product.setGuardianContactStatus(
                        RegisteredProduct
                                .GuardianContactStatus
                                .UNREACHABLE
                );
            }

            case DECLINED ->
                    product.setContactResult(
                            RegisteredProduct
                                    .ContactResult
                                    .DECLINED
                    );

            case NOT_OWNED -> {
                product.setContactResult(
                        RegisteredProduct
                                .ContactResult
                                .NOT_OWNED
                );

                product.setCurrentUseStatus(
                        RegisteredProduct
                                .CurrentUseStatus
                                .NOT_OWNED
                );

                product.setFinalResult(
                        RegisteredProduct
                                .FinalResult
                                .NOT_OWNED
                );
            }

            case NOT_RECALLED -> {
                product.setRecallStatus(
                        RegisteredProduct
                                .RecallStatus
                                .SAFE
                );

                product.setRecallDecisionStatus(
                        RegisteredProduct
                                .RecallDecisionStatus
                                .NO_MATCH_FOUND
                );

                product.setFinalResult(
                        RegisteredProduct
                                .FinalResult
                                .NOT_RECALLED
                );
            }
        }
    }

    private void validateRecallTarget(
            RegisteredProduct product
    ) {
        if (!isRecallTarget(product)) {
            throw new IllegalArgumentException(
                    "리콜 대상 또는 추가 검토 대상 제품만 후속조치를 등록할 수 있습니다."
            );
        }
    }

    private boolean isRecallTarget(
            RegisteredProduct product
    ) {
        return product.getRecallStatus()
                == RegisteredProduct
                .RecallStatus
                .RECALLED
                || product.getRecallDecisionStatus()
                == RegisteredProduct
                .RecallDecisionStatus
                .RECALL_CONFIRMED
                || product.getRecallDecisionStatus()
                == RegisteredProduct
                .RecallDecisionStatus
                .REVIEW_REQUIRED;
    }

    private void saveHistory(
            Long registeredProductId,
            RegisteredProduct.FollowUpStatus
                    previousStatus,
            RegisteredProduct.FollowUpStatus
                    newStatus,
            RecallFollowUpHistory.ChangeType
                    changeType,
            Long changedBy,
            String changeMemo
    ) {
        historyRepository.save(
                RecallFollowUpHistory
                        .builder()
                        .registeredProductId(
                                registeredProductId
                        )
                        .previousStatus(
                                previousStatus
                        )
                        .newStatus(
                                newStatus
                        )
                        .changeType(
                                changeType
                        )
                        .changedBy(
                                changedBy
                        )
                        .changeMemo(
                                blankToNull(
                                        changeMemo
                                )
                        )
                        .build()
        );
    }

    private RecallFollowUpResponse toResponse(
            RegisteredProduct product,
            boolean includeHistories
    ) {
        Senior senior =
                product.getSeniorId() == null
                        ? null
                        : seniorRepository
                        .findById(
                                product.getSeniorId()
                        )
                        .orElse(null);

        String assignedWorkerName =
                product.getAssignedWorkerId() == null
                        ? null
                        : welfareWorkerRepository
                        .findById(
                                product.getAssignedWorkerId()
                        )
                        .map(worker ->
                                worker.getName()
                        )
                        .orElse(null);

        List<
                RecallFollowUpResponse.HistoryResponse
                > histories =
                includeHistories
                        ? historyRepository
                        .findByRegisteredProductIdOrderByCreatedAtDesc(
                                product.getId()
                        )
                        .stream()
                        .map(
                                this::toHistoryResponse
                        )
                        .toList()
                        : List.of();

        return new RecallFollowUpResponse(
                product.getId(),
                product.getSeniorId(),
                senior == null
                        ? null
                        : senior.getName(),

                product.getProductName(),
                product.getManufacturer(),
                product.getModelNumber(),

                product.getRecallStatus(),
                product.getRecallDecisionStatus(),

                product.getFollowUpStatus(),
                product.getFollowUpOutcome(),

                product.getAssignedWorkerId(),
                assignedWorkerName,
                product.getAssignedAt(),

                product.getFollowUpType(),
                product.getNextActionDate(),

                product.getContactTarget(),
                product.getContactMethod(),
                product.getContactedAt(),
                product.getContactResult(),
                product.getContactMemo(),

                product.getCurrentUseStatus(),
                product.getConfirmedAt(),
                product.getConfirmationMemo(),

                product.getScheduledAt(),
                product.getScheduleType(),
                product.getSchedulePlace(),
                product.getScheduleMemo(),

                product.getReferralAgency(),
                product.getReferralContactName(),
                product.getReferralContactPhone(),
                product.getReferredAt(),
                product.getReferralMemo(),

                product.getFinalResult(),
                product.getCompletedAt(),
                product.getCompletionMemo(),

                product.getGuardianNotificationMethod(),
                product.getGuardianNotifiedAt(),
                product.getGuardianNotificationMemo(),

                product.getNote(),
                product.getReceivedAt(),
                product.getCreatedAt(),
                product.getUpdatedAt(),

                histories
        );
    }

    private RecallFollowUpResponse.HistoryResponse
    toHistoryResponse(
            RecallFollowUpHistory history
    ) {
        String changedByName =
                history.getChangedBy() == null
                        ? null
                        : welfareWorkerRepository
                        .findById(
                                history.getChangedBy()
                        )
                        .map(worker ->
                                worker.getName()
                        )
                        .orElse(null);

        return new RecallFollowUpResponse.HistoryResponse(
                history.getId(),
                history.getPreviousStatus(),
                history.getNewStatus(),
                history.getChangeType(),
                history.getChangedBy(),
                changedByName,
                history.getChangeMemo(),
                history.getCreatedAt()
        );
    }

    private LocalDateTime effectiveUpdatedAt(
            RegisteredProduct product
    ) {
        if (product.getUpdatedAt() != null) {
            return product.getUpdatedAt();
        }

        return product.getCreatedAt();
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

    private String firstNonBlank(
            String first,
            String fallback
    ) {
        return nonBlank(first)
                ? first.trim()
                : fallback;
    }

    private String blankToNull(
            String value
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return null;
        }

        return value.trim();
    }

    private boolean nonBlank(
            String value
    ) {
        return value != null
                && !value.isBlank();
    }
}