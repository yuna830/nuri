package com.nuri.woorilink.service;

import com.nuri.woorilink.common.client.KcApiClient;
import com.nuri.woorilink.common.client.SafetyKoreaRecallClient;
import com.nuri.woorilink.common.config.RecallSafetyProperties;
import com.nuri.woorilink.entity.ProductRecallAlert;
import com.nuri.woorilink.entity.ProductRecallCheckHistory;
import com.nuri.woorilink.entity.RecallNotice;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.repository.ProductRecallAlertRepository;
import com.nuri.woorilink.repository.ProductRecallCheckHistoryRepository;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class RecallSafetyService {

    private final RegisteredProductRepository products;
    private final SafetyKoreaRecallClient client;
    private final KcApiClient kcApiClient;
    private final RecallNoticeStore store;
    private final RecallDecisionEngine engine;
    private final ProductRecallCheckHistoryRepository histories;
    private final ProductRecallAlertRepository alerts;
    private final RecallSafetyProperties properties;

    public boolean enabled() {
        return properties.isNewDecisionEngineEnabled();
    }

    @Transactional
    public RegisteredProduct check(Long id) {
        RegisteredProduct product = products.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("등록 제품을 찾을 수 없습니다: " + id));

        LocalDateTime now = LocalDateTime.now();

        applyKcStatus(product);

        var lookup = client.lookup(
                new SafetyKoreaRecallClient.ProductQuery(
                        product.getProductName(),
                        product.getBrandName(),
                        product.getManufacturer(),
                        product.getModelNumber(),
                        effectiveBarcode(product),
                        product.getCertificationNumber()
                )
        );

        if (!lookup.success()) {
            product.setRecallCheckStatus(
                    RegisteredProduct.RecallCheckStatus.FAILED
            );
            product.setLastCheckedAt(now);
            product.setLastCheckFailedAt(now);
            product.setLastCheckErrorCode(lookup.errorCode());
            product.setLastCheckErrorMessage(lookup.errorMessage());

            products.save(product);

            history(
                    product,
                    null,
                    product.getRecallDecisionStatus(),
                    RegisteredProduct.RecallCheckStatus.FAILED,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    product.getRecallDecisionReason(),
                    null,
                    null,
                    lookup
            );

            return product;
        }

        List<RecallNotice> candidates = store.save(lookup.notices());
        var decision = engine.decide(product, candidates);

        RegisteredProduct.RecallDecisionStatus previousStatus =
                product.getRecallDecisionStatus();

        if (previousStatus
                == RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED
                && decision.status()
                != RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED) {

            product.setRecallCheckStatus(
                    RegisteredProduct.RecallCheckStatus.SUCCESS
            );
            product.setLastCheckedAt(now);
            product.setLastSuccessfulCheckedAt(now);
            product.setRecallMissingFields(
                    List.of("ADMINISTRATOR_REVIEW")
            );
            product.setRecallDecisionReason(
                    "기존 확정 공고가 재조회에서 확인되지 않아 "
                            + "기존 확정 판정을 유지합니다."
            );

            products.save(product);

            history(
                    product,
                    product.getMatchedRecallNoticeId(),
                    previousStatus,
                    RegisteredProduct.RecallCheckStatus.SUCCESS,
                    product.getRecallMatchedFields(),
                    List.of(),
                    product.getRecallMissingFields(),
                    decision.candidateUids(),
                    product.getRecallDecisionReason(),
                    decision.queryType(),
                    decision.queryValue(),
                    lookup
            );

            return product;
        }

        product.setRecallDecisionStatus(decision.status());
        product.setRecallCheckStatus(
                RegisteredProduct.RecallCheckStatus.SUCCESS
        );
        product.setMatchedRecallNoticeId(
                decision.notice() == null
                        ? null
                        : decision.notice().getId()
        );
        product.setRecallDecisionReason(decision.reason());
        product.setRecallMatchedFields(decision.matched());
        product.setRecallMissingFields(decision.missing());
        product.setLastCheckedAt(now);
        product.setLastSuccessfulCheckedAt(now);
        product.setLastCheckErrorCode(null);
        product.setLastCheckErrorMessage(null);

        fillMissingOfficialFields(product, decision.notice());

        product.setRecallStatus(
                switch (decision.status()) {
                    case RECALL_CONFIRMED ->
                            RegisteredProduct.RecallStatus.RECALLED;
                    case NO_MATCH_FOUND ->
                            RegisteredProduct.RecallStatus.SAFE;
                    case REVIEW_REQUIRED ->
                            RegisteredProduct.RecallStatus.UNKNOWN;
                }
        );

        product.setModelMatchStatus(
                switch (decision.status()) {
                    case RECALL_CONFIRMED ->
                            RegisteredProduct.ModelMatchStatus.MATCHED;
                    case NO_MATCH_FOUND ->
                            RegisteredProduct.ModelMatchStatus.NOT_MATCHED;
                    case REVIEW_REQUIRED ->
                            RegisteredProduct.ModelMatchStatus.NEEDS_REVIEW;
                }
        );

        product.setRecallReason(
                legacyReason(decision.notice(), decision.reason())
        );

        products.save(product);

        history(
                product,
                product.getMatchedRecallNoticeId(),
                decision.status(),
                RegisteredProduct.RecallCheckStatus.SUCCESS,
                decision.matched(),
                decision.mismatched(),
                decision.missing(),
                decision.candidateUids(),
                decision.reason(),
                decision.queryType(),
                decision.queryValue(),
                lookup
        );

        if (decision.status()
                == RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED
                && previousStatus != decision.status()
                && decision.notice() != null
                && !alerts.existsByRegisteredProductIdAndRecallNoticeIdAndAlertType(
                product.getId(),
                decision.notice().getId(),
                "RECALL_CONFIRMED"
        )) {

            alerts.save(
                    ProductRecallAlert.builder()
                            .registeredProductId(product.getId())
                            .recallNoticeId(decision.notice().getId())
                            .alertType("RECALL_CONFIRMED")
                            .dryRun(
                                    properties.isDryRun()
                                            || !properties.isNotificationEnabled()
                            )
                            .build()
            );
        }

        return product;
    }

    private String effectiveBarcode(RegisteredProduct product) {
        if (product.getBarcode() != null
                && !product.getBarcode().isBlank()) {
            return product.getBarcode();
        }

        String modelNumber = product.getModelNumber();

        if (modelNumber == null) {
            return null;
        }

        String normalized = modelNumber.replaceAll("[\\s-]", "");

        return normalized.matches("\\d{8,14}")
                ? normalized
                : null;
    }

    private void fillMissingOfficialFields(
            RegisteredProduct product,
            RecallNotice notice
    ) {
        if (notice == null) {
            return;
        }

        if (isBlank(product.getProductName())
                && !isBlank(notice.getProductName())) {
            product.setProductName(notice.getProductName());
        }

        if (isBlank(product.getBrandName())
                && !isBlank(notice.getBrandName())) {
            product.setBrandName(notice.getBrandName());
        }

        if (isBlank(product.getModelNumber())
                && notice.getModelNames() != null
                && !notice.getModelNames().isEmpty()) {
            product.setModelNumber(notice.getModelNames().get(0));
        }
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

    private String legacyReason(
            RecallNotice notice,
            String fallback
    ) {
        if (notice == null) {
            return fallback;
        }

        StringBuilder builder = new StringBuilder();

        append(
                builder,
                "제품 결함",
                notice.getDefectDescription()
        );
        append(
                builder,
                "위해 정보",
                notice.getHazardDescription()
        );
        append(
                builder,
                "소비자 행동요령",
                notice.getConsumerAction()
        );
        append(
                builder,
                "문의처",
                notice.getInquiryTel()
        );

        return builder.isEmpty()
                ? fallback
                : builder.toString();
    }

    private void append(
            StringBuilder builder,
            String key,
            String value
    ) {
        if (value == null || value.isBlank()) {
            return;
        }

        if (!builder.isEmpty()) {
            builder.append('\n');
        }

        builder.append(key)
                .append(": ")
                .append(value);
    }

    private void history(
            RegisteredProduct product,
            Long noticeId,
            RegisteredProduct.RecallDecisionStatus decisionStatus,
            RegisteredProduct.RecallCheckStatus checkStatus,
            List<String> matchedFields,
            List<String> mismatchedFields,
            List<String> missingFields,
            List<String> candidateUids,
            String reason,
            String queryType,
            String queryValue,
            SafetyKoreaRecallClient.Lookup lookup
    ) {
        histories.save(
                ProductRecallCheckHistory.builder()
                        .registeredProductId(product.getId())
                        .recallNoticeId(noticeId)
                        .decisionStatus(decisionStatus)
                        .checkStatus(checkStatus)
                        .queryType(queryType)
                        .queryValue(queryValue)
                        .matchedFields(matchedFields)
                        .mismatchedFields(mismatchedFields)
                        .missingFields(missingFields)
                        .candidateRecallUids(candidateUids)
                        .decisionReason(reason)
                        .externalResultCode(lookup.resultCode())
                        .externalResultMessage(lookup.resultMessage())
                        .errorCode(lookup.errorCode())
                        .errorMessage(lookup.errorMessage())
                        .productSnapshot(
                                Map.of(
                                        "productName",
                                        safe(product.getProductName()),
                                        "manufacturer",
                                        safe(product.getManufacturer()),
                                        "modelNumber",
                                        safe(product.getModelNumber()),
                                        "barcode",
                                        safe(product.getBarcode()),
                                        "certificationNumber",
                                        safe(product.getCertificationNumber())
                                )
                        )
                        .checkedAt(LocalDateTime.now())
                        .build()
        );
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}