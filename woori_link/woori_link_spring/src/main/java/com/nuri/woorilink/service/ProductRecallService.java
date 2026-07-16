package com.nuri.woorilink.service;

import com.nuri.woorilink.common.client.RecallApiClient;
import com.nuri.woorilink.dto.ProductRecallResponse;
import com.nuri.woorilink.dto.RecallWorkflowUpdateRequest;
import com.nuri.woorilink.entity.ActionRecord;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.repository.ActionRecordRepository;
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
    private final WelfareWorkerRepository welfareWorkerRepository;

    public List<RegisteredProduct> getBySenior(Long seniorId) {
        return productRepository.findBySeniorId(seniorId);
    }

    public List<ProductRecallResponse> getRecalled() {
        return productRepository.findByRecallStatus(RegisteredProduct.RecallStatus.RECALLED)
                .stream()
                .map(this::toRecallResponse)
                .toList();
    }

    public List<ProductRecallResponse> getRecalledByWelfareWorker(Long welfareWorkerId) {
        List<Long> seniorIds = seniorRepository.findByWelfareWorkerId(welfareWorkerId)
                .stream()
                .map(Senior::getId)
                .toList();
        if (seniorIds.isEmpty()) return List.of();

        return productRepository.findBySeniorIdInAndRecallStatus(
                        seniorIds,
                        RegisteredProduct.RecallStatus.RECALLED
                )
                .stream()
                .map(this::toRecallResponse)
                .toList();
    }

    private ProductRecallResponse toRecallResponse(RegisteredProduct product) {
        Senior senior = product.getSeniorId() == null
                ? null
                : seniorRepository.findById(product.getSeniorId()).orElse(null);
        String stopGuidanceWorkerName = product.getStopGuidanceWorkerId() == null
                ? null
                : welfareWorkerRepository.findById(product.getStopGuidanceWorkerId())
                .map(worker -> worker.getName())
                .orElse(null);

        return new ProductRecallResponse(
                product.getId(),
                product.getSeniorId(),
                senior == null ? null : senior.getName(),
                senior == null ? null : senior.getAge(),
                product.getProductName(),
                product.getManufacturer(),
                product.getModelNumber(),
                product.getRecallStatus(),
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
                product.getFollowUpType(),
                product.getNextActionDate(),
                product.getFollowUpProgressStatus(),
                product.getNote(),
                product.getFinalResult(),
                product.getRecallReason(),
                product.getLastCheckedAt(),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }

    @Transactional
    public RegisteredProduct register(RegisteredProduct product) {
        applyRecallStatus(product);
        return productRepository.save(product);
    }

    @Transactional
    public void refreshAll() {
        productRepository.findAll().forEach(p -> {
            applyRecallStatus(p);
            productRepository.save(p);
        });
    }

    @Transactional
    public void delete(Long id) { productRepository.deleteById(id); }

    @Transactional
    public RegisteredProduct updateCurrentUseStatus(
            Long id,
            RegisteredProduct.CurrentUseStatus status
    ) {
        RegisteredProduct product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("등록 제품을 찾을 수 없습니다: " + id));
        product.setCurrentUseStatus(status);
        return productRepository.save(product);
    }

    @Transactional
    public RegisteredProduct updateWorkflow(Long id, RecallWorkflowUpdateRequest request) {
        RegisteredProduct product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("등록 제품을 찾을 수 없습니다: " + id));
        if (request.getModelMatchStatus() != null) product.setModelMatchStatus(request.getModelMatchStatus());
        if (request.getCurrentUseStatus() != null) product.setCurrentUseStatus(request.getCurrentUseStatus());
        product.setContactMethod(request.getContactMethod());
        if (request.getStopGuidanceCompleted() != null) product.setStopGuidanceCompleted(request.getStopGuidanceCompleted());
        if (request.getStopGuidanceCompletedAt() != null) product.setStopGuidanceCompletedAt(request.getStopGuidanceCompletedAt());
        if (request.getStopGuidanceMethod() != null) product.setStopGuidanceMethod(request.getStopGuidanceMethod());
        if (request.getStopGuidanceTarget() != null) product.setStopGuidanceTarget(request.getStopGuidanceTarget());
        if (request.getStopGuidanceWorkerId() != null) product.setStopGuidanceWorkerId(request.getStopGuidanceWorkerId());
        if (request.getStopGuidanceMemo() != null) product.setStopGuidanceMemo(request.getStopGuidanceMemo());
        if (request.getGuardianContactStatus() != null) product.setGuardianContactStatus(request.getGuardianContactStatus());
        product.setFollowUpType(request.getFollowUpType());
        product.setNextActionDate(request.getNextActionDate());
        if (request.getFollowUpProgressStatus() != null) product.setFollowUpProgressStatus(request.getFollowUpProgressStatus());
        product.setNote(request.getNote());
        product.setFinalResult(request.getFinalResult());

        RegisteredProduct saved = productRepository.save(product);
        syncRecallActionStatus(saved, request);
        if (Boolean.TRUE.equals(request.getCreateAction()) && request.getWelfareWorkerId() != null) {
            actionRecordRepository.save(ActionRecord.builder()
                    .seniorId(product.getSeniorId())
                    .welfareWorkerId(request.getWelfareWorkerId())
                    .actionType(ActionRecord.ActionType.RECALL)
                    .actionSubject(ActionRecord.ActionSubject.WELFARE_WORKER)
                    .status(ActionRecord.ActionStatus.PENDING)
                    .productName(product.getProductName())
                    .dueDate(request.getNextActionDate())
                    .note(request.getNote())
                    .immediateRisk(product.getCurrentUseStatus() == RegisteredProduct.CurrentUseStatus.IN_USE)
                    .build());
        }
        return saved;
    }

    private void syncRecallActionStatus(RegisteredProduct product, RecallWorkflowUpdateRequest request) {
        if (product.getSeniorId() == null || !nonBlank(product.getProductName())) return;

        List<ActionRecord> records = actionRecordRepository
                .findBySeniorIdAndActionTypeAndProductNameOrderByCreatedAtDesc(
                        product.getSeniorId(),
                        ActionRecord.ActionType.RECALL,
                        product.getProductName()
                );
        if (records.isEmpty()) return;

        ActionRecord.ActionStatus status = recallActionStatus(product);
        for (ActionRecord record : records) {
            record.setStatus(status);
            if (request.getNextActionDate() != null) record.setDueDate(request.getNextActionDate());
            if (request.getWelfareWorkerId() != null) record.setWelfareWorkerId(request.getWelfareWorkerId());
            if (nonBlank(request.getNote())) record.setNote(request.getNote());
            actionRecordRepository.save(record);
        }
    }

    private ActionRecord.ActionStatus recallActionStatus(RegisteredProduct product) {
        if (product.getFinalResult() != null ||
                product.getFollowUpProgressStatus() == RegisteredProduct.FollowUpProgressStatus.COMPLETED) {
            return ActionRecord.ActionStatus.COMPLETED;
        }

        if (Boolean.TRUE.equals(product.getStopGuidanceCompleted()) ||
                nonBlank(product.getFollowUpType()) ||
                product.getCurrentUseStatus() != RegisteredProduct.CurrentUseStatus.UNKNOWN) {
            return ActionRecord.ActionStatus.IN_PROGRESS;
        }

        return ActionRecord.ActionStatus.PENDING;
    }

    private void applyRecallStatus(RegisteredProduct product) {
        RecallLookup lookup = lookupRecall(product);
        product.setRecallStatus(lookup.recalled()
                ? RegisteredProduct.RecallStatus.RECALLED
                : RegisteredProduct.RecallStatus.SAFE);
        product.setRecallReason(lookup.recalled() ? lookup.detail() : null);
        product.setLastCheckedAt(LocalDateTime.now());
    }

    private RecallLookup lookupRecall(RegisteredProduct product) {
        for (String term : buildRecallSearchTerms(product)) {
            if (recallApiClient.isRecalled(term)) {
                String detail = recallApiClient.getRecallDetail(term);
                String reason = detail != null && !detail.isBlank()
                        ? detail
                        : "제품안전정보센터 리콜 목록에서 조회되었습니다. 검색어: " + term;
                return new RecallLookup(true, reason);
            }
        }
        return new RecallLookup(false, null);
    }

    private List<String> buildRecallSearchTerms(RegisteredProduct product) {
        Set<String> terms = new LinkedHashSet<>();
        addIfNotBlank(terms, product.getModelNumber());
        addIfNotBlank(terms, product.getProductName());

        List<String> filtered = new ArrayList<>();
        for (String term : terms) {
            String normalized = term.trim();
            if (normalized.length() >= 2) filtered.add(normalized);
        }
        return filtered;
    }

    private void addIfNotBlank(Set<String> terms, String value) {
        if (value == null) return;
        String normalized = value.trim();
        if (!normalized.isBlank()) terms.add(normalized);
    }

    private boolean nonBlank(String value) {
        return value != null && !value.isBlank();
    }

    private record RecallLookup(boolean recalled, String detail) {}
}
