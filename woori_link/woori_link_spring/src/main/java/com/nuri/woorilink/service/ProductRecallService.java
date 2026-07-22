package com.nuri.woorilink.service;

import com.nuri.woorilink.common.client.KcApiClient;
import com.nuri.woorilink.common.client.RecallApiClient;
import com.nuri.woorilink.dto.ProductRecallResponse;
import com.nuri.woorilink.dto.RecallWorkflowUpdateRequest;
import com.nuri.woorilink.entity.ActionRecord;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.entity.VisitSchedule;
import com.nuri.woorilink.entity.RecallNotice;
import com.nuri.woorilink.dto.RecallNoticeDto;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.repository.ActionRecordRepository;
import com.nuri.woorilink.repository.VisitScheduleRepository;
import com.nuri.woorilink.repository.WelfareWorkerRepository;
import com.nuri.woorilink.repository.RecallNoticeRepository;
import com.nuri.woorilink.repository.GuardianRepository;
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
        return productRepository.findBySeniorId(seniorId).stream().map(this::toRecallResponse).toList();
    }

    public void validateGuardianAccess(Long guardianId, Long seniorId) {
        if (guardianId == null || seniorId == null) {
            throw new IllegalArgumentException("보호자와 대상 님 정보가 필요합니다.");
        }
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("대상 님을 찾을 수 없습니다."));
        if (!guardianId.equals(senior.getGuardianId())) {
            throw new IllegalArgumentException("연결된 님의 제품만 등록할 수 있습니다.");
        }
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
        RecallNotice notice = product.getMatchedRecallNoticeId() == null ? null
                : recallNoticeRepository.findById(product.getMatchedRecallNoticeId()).orElse(null);

        String inquiryTel = notice == null || !nonBlank(notice.getInquiryTel())
                ? extractRecallContact(product.getRecallReason())
                : notice.getInquiryTel();

        return new ProductRecallResponse(
                product.getId(),
                product.getSeniorId(),
                senior == null ? null : senior.getName(),
                senior == null ? null : senior.getAge(),
                nonBlank(product.getProductName()) ? product.getProductName() : "제품명 확인 필요",
                product.getManufacturer(),
                product.getBrandName(),
                product.getModelNumber(),
                product.getBarcode(),
                product.getCertificationNumber(),
                product.getRegistrationSource(),
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
                notice == null ? null : notice.getDefectDescription(),
                notice == null ? null : notice.getHazardDescription(),
                notice == null ? null : notice.getConsumerAction(),
                inquiryTel,
                notice == null ? null : notice.getPublishDate(),
                notice == null ? null : notice.getSourceName(),
                notice == null ? null : notice.getSourceUrl(),
                product.getLastSuccessfulCheckedAt(),
                product.getLastCheckErrorMessage()
        );
    }

    @Transactional
    public RegisteredProduct register(RegisteredProduct product) {
        normalizeRegistration(product);
        RegisteredProduct saved = productRepository.save(product);
        if (recallSafetyService.enabled()) {
            try { return recallSafetyService.check(saved.getId()); }
            catch (Exception ignored) { return productRepository.findById(saved.getId()).orElse(saved); }
        }
        applyRecallStatus(saved);
        return productRepository.save(saved);
    }

    private void normalizeRegistration(RegisteredProduct product) {
        product.setProductName(blankToNull(product.getProductName()));
        product.setBrandName(blankToNull(product.getBrandName()));
        product.setManufacturer(blankToNull(product.getManufacturer()));
        product.setModelNumber(blankToNull(product.getModelNumber()));
        product.setBarcode(blankToNull(product.getBarcode()));
        product.setCertificationNumber(blankToNull(product.getCertificationNumber()));
        if (product.getProductName() == null
                && product.getBrandName() == null
                && product.getManufacturer() == null
                && product.getModelNumber() == null
                && product.getBarcode() == null
                && product.getCertificationNumber() == null) {
            throw new IllegalArgumentException("제품명 또는 제품 식별정보를 하나 이상 입력해 주세요.");
        }
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    @Transactional
    public void refreshAll() {
        productRepository.findAll().forEach(p -> {
            try {
                if (recallSafetyService.enabled()) recallSafetyService.check(p.getId());
                else { applyRecallStatus(p); productRepository.save(p); }
            } catch (Exception ignored) { }
        });
    }

    public ProductRecallResponse getResponse(Long productId) {
        return toRecallResponse(productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("등록 제품을 찾을 수 없습니다: " + productId)));
    }

    public RegisteredProduct getForGuardian(Long productId, Long guardianId) {
        RegisteredProduct product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("Registered product not found: " + productId));
        validateGuardianAccess(guardianId, product.getSeniorId());
        return product;
    }

    @Transactional
    public RegisteredProduct checkRecall(Long productId) {
        if (recallSafetyService.enabled()) return recallSafetyService.check(productId);
        RegisteredProduct product = productRepository.findById(productId)
                .orElseThrow(() -> new IllegalArgumentException("등록 제품을 찾을 수 없습니다: " + productId));
        applyRecallStatus(product);
        return productRepository.save(product);
    }

    @Transactional
    public void delete(Long id) { productRepository.deleteById(id); }

    @Transactional
    public RegisteredProduct updateCurrentUseStatus(
            Long id,
            RegisteredProduct.CurrentUseStatus status,
            Long guardianId
    ) {
        RegisteredProduct product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("등록 제품을 찾을 수 없습니다: " + id));
        validateGuardianAccess(guardianId, product.getSeniorId());
        product.setCurrentUseStatus(status);
        if (status == RegisteredProduct.CurrentUseStatus.STOPPED) {
            String guardianName = guardianRepository.findById(guardianId)
                    .map(guardian -> guardian.getName())
                    .orElse("보호자");
            product.setStopGuidanceCompleted(true);
            product.setStopGuidanceCompletedAt(LocalDateTime.now());
            product.setStopGuidanceMethod("GUARDIAN_WEB");
            product.setStopGuidanceTarget(guardianName);
            product.setStopGuidanceMemo("보호자가 제품 사용 중지를 확인했습니다.");
        }
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
        syncRecallVisitSchedule(saved, request);
        return saved;
    }

    private void syncRecallVisitSchedule(RegisteredProduct product, RecallWorkflowUpdateRequest request) {
        if (product.getSeniorId() == null || product.getNextActionDate() == null) return;

        Senior senior = seniorRepository.findById(product.getSeniorId()).orElse(null);
        String seniorName = senior == null || !nonBlank(senior.getName()) ? "님" : senior.getName();
        Long welfareWorkerId = request.getWelfareWorkerId();
        if (welfareWorkerId == null && senior != null) welfareWorkerId = senior.getWelfareWorkerId();

        String purpose = seniorName + "님 리콜 조치 방문일";
        boolean exists = visitScheduleRepository.findBySeniorId(product.getSeniorId()).stream()
                .anyMatch(schedule ->
                        product.getNextActionDate().equals(schedule.getVisitDate()) &&
                        purpose.equals(schedule.getPurpose()) &&
                        schedule.getStatus() != VisitSchedule.VisitStatus.CANCELLED);
        if (exists) return;

        visitScheduleRepository.save(VisitSchedule.builder()
                .seniorId(product.getSeniorId())
                .welfareWorkerId(welfareWorkerId)
                .visitDate(product.getNextActionDate())
                .purpose(purpose)
                .note(product.getProductName() + " 리콜 후속 조치")
                .status(VisitSchedule.VisitStatus.PLANNED)
                .build());
    }

    private void syncRecallActionStatus(RegisteredProduct product, RecallWorkflowUpdateRequest request) {
        if (product.getSeniorId() == null || !nonBlank(product.getProductName())) return;

        List<ActionRecord> records = actionRecordRepository
                .findBySeniorIdAndActionTypeAndProductNameOrderByCreatedAtDesc(
                        product.getSeniorId(),
                        ActionRecord.ActionType.RECALL,
                        product.getProductName()
                );

        ActionRecord.ActionStatus status = recallActionStatus(product);
        if (records.isEmpty()) {
            if (!Boolean.TRUE.equals(request.getCreateAction()) || request.getWelfareWorkerId() == null) return;
            actionRecordRepository.save(ActionRecord.builder()
                    .seniorId(product.getSeniorId())
                    .welfareWorkerId(request.getWelfareWorkerId())
                    .actionType(ActionRecord.ActionType.RECALL)
                    .actionSubject(ActionRecord.ActionSubject.WELFARE_WORKER)
                    .status(status)
                    .productName(product.getProductName())
                    .dueDate(request.getNextActionDate())
                    .note(request.getNote())
                    .immediateRisk(product.getCurrentUseStatus() == RegisteredProduct.CurrentUseStatus.IN_USE)
                    .build());
            return;
        }

        for (ActionRecord record : records) {
            record.setStatus(status);
            if (Boolean.TRUE.equals(request.getCreateAction())) {
                record.setDueDate(request.getNextActionDate());
            } else {
                record.setDueDate(null);
            }
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
        applyKcStatus(product);
        product.setLastCheckedAt(LocalDateTime.now());
    }

    private void applyKcStatus(RegisteredProduct product) {
        KcApiClient.KcLookup lookup = kcApiClient.lookup(
                product.getCertificationNumber(),
                product.getModelNumber(),
                product.getProductName(),
                product.getManufacturer()
        );
        product.setKcStatus(lookup.status());
        product.setKcCertNum(lookup.certNum());
        product.setKcCertState(lookup.certState());
        product.setKcCertOrganName(lookup.certOrganName());
        product.setKcCertProductName(lookup.productName());
        product.setKcCertModelName(lookup.modelName());
        product.setKcCertManufacturer(lookup.makerName());
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

    private String extractRecallContact(String text) {
        if (!nonBlank(text)) return null;
        for (String line : text.split("\\R")) {
            String lower = line.toLowerCase();
            if (line.contains("문의처") || line.contains("연락처") || line.contains("전화") || lower.contains("tel")) {
                return line
                        .replaceFirst("(?i)^.*?(문의처|연락처|전화|tel)\\s*[:：]?\\s*", "")
                        .trim();
            }
        }
        return null;
    }

    private boolean nonBlank(String value) {
        return value != null && !value.isBlank();
    }

    private record RecallLookup(boolean recalled, String detail) {}
}
