package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.RecallNotice;
import com.nuri.woorilink.entity.RegisteredProduct;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

@Component
public class RecallDecisionEngine {
    private static final Pattern NON_IDENTIFIER = Pattern.compile("[^\\p{L}\\p{N}]");

    public Decision decide(RegisteredProduct product, List<RecallNotice> notices) {
        Decision review = null;
        List<String> candidateUids = notices.stream().map(RecallNotice::getRecallUid).toList();
        for (RecallNotice notice : notices) {
            Decision decision = compare(product, notice, candidateUids);
            if (decision.status() == RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED) return decision;
            if (decision.status() == RegisteredProduct.RecallDecisionStatus.REVIEW_REQUIRED && review == null) review = decision;
        }
        return review != null ? review : noMatch(candidateUids, "현재 등록된 리콜 공고에서 입력한 제품 식별정보와 일치하는 항목을 찾지 못했습니다. 이 결과는 제품의 전반적인 안전성을 보증하지 않습니다.");
    }

    private Decision compare(RegisteredProduct product, RecallNotice notice, List<String> candidateUids) {
        List<String> matched = new ArrayList<>();
        List<String> mismatched = new ArrayList<>();
        List<String> missing = new ArrayList<>();

        if (exact(product.getBarcode(), notice.getBarcodeNumbers())) {
            matched.add("BARCODE");
            return exactDecision(product, notice, matched, mismatched, missing, candidateUids, "BARCODE", product.getBarcode());
        }
        if (exact(product.getCertificationNumber(), notice.getCertNumbers())) {
            matched.add("CERTIFICATION_NUMBER");
            if (!notice.getModelNames().isEmpty()) {
                if (blank(product.getModelNumber())) {
                    missing.add("MODEL_NUMBER");
                    return review(notice, matched, mismatched, missing, candidateUids, "인증번호는 일치하지만 대상 모델 확인이 필요합니다.", "CERTIFICATION_NUMBER", product.getCertificationNumber());
                }
                if (!exact(product.getModelNumber(), notice.getModelNames())) {
                    mismatched.add("MODEL_NUMBER");
                    return noMatch(matched, mismatched, missing, candidateUids, "인증번호는 일치하지만 대상 모델 범위가 다릅니다.", "CERTIFICATION_NUMBER", product.getCertificationNumber());
                }
                matched.add("MODEL_NUMBER");
            }
            return exactDecision(product, notice, matched, mismatched, missing, candidateUids, "CERTIFICATION_NUMBER", product.getCertificationNumber());
        }
        if (exact(product.getModelNumber(), notice.getModelNames())) {
            matched.add("MODEL_NUMBER");
            if (companyMatch(product.getManufacturer(), notice)) {
                matched.add("MANUFACTURER_OR_BRAND");
                return exactDecision(product, notice, matched, mismatched, missing, candidateUids, "MODEL_NUMBER", product.getModelNumber());
            }
            missing.add("MANUFACTURER_OR_BRAND_CONFIRMATION");
            return review(notice, matched, mismatched, missing, candidateUids, "모델번호는 일치하지만 제조사 또는 브랜드 확인이 필요합니다.", "MODEL_NUMBER", product.getModelNumber());
        }
        if (blank(product.getModelNumber()) && blank(product.getBarcode()) && blank(product.getCertificationNumber())
                && similar(product.getProductName(), notice.getProductName())) {
            matched.add("PRODUCT_NAME");
            missing.addAll(List.of("MODEL_NUMBER", "BARCODE", "CERTIFICATION_NUMBER"));
            return review(notice, matched, mismatched, missing, candidateUids, "제품명만 일치하여 추가 식별정보가 필요합니다.", "PRODUCT_NAME", product.getProductName());
        }
        return noMatch(matched, mismatched, missing, candidateUids, "제품 식별정보가 일치하지 않습니다.", "NONE", null);
    }

    private Decision exactDecision(RegisteredProduct product, RecallNotice notice, List<String> matched, List<String> mismatched,
                                   List<String> missing, List<String> candidateUids, String queryType, String queryValue) {
        if (notice.isHasUnstructuredScopeCondition()) {
            missing.add("ADDITIONAL_SCOPE_CONDITION");
            if (product.getManufacturingDate() == null) missing.add("MANUFACTURING_DATE");
            if (blank(product.getSerialNumber())) missing.add("SERIAL_NUMBER");
            if (blank(product.getLotNumber())) missing.add("LOT_NUMBER");
            return review(notice, matched, mismatched, missing, candidateUids, "식별정보는 일치하지만 공고의 추가 조건을 자동 확인할 수 없습니다.", queryType, queryValue);
        }
        return new Decision(RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED, notice, matched, mismatched, missing,
                candidateUids, "공식 리콜 공고와 제품 식별정보가 일치합니다.", queryType, queryValue);
    }

    private Decision review(RecallNotice notice, List<String> matched, List<String> mismatched, List<String> missing,
                            List<String> candidateUids, String reason, String queryType, String queryValue) {
        return new Decision(RegisteredProduct.RecallDecisionStatus.REVIEW_REQUIRED, notice, matched, mismatched, missing,
                candidateUids, reason, queryType, queryValue);
    }

    private Decision noMatch(List<String> candidateUids, String reason) {
        return noMatch(List.of(), List.of(), List.of(), candidateUids, reason, "NONE", null);
    }

    private Decision noMatch(List<String> matched, List<String> mismatched, List<String> missing, List<String> candidateUids,
                             String reason, String queryType, String queryValue) {
        return new Decision(RegisteredProduct.RecallDecisionStatus.NO_MATCH_FOUND, null, matched, mismatched, missing,
                candidateUids, reason, queryType, queryValue);
    }

    private boolean exact(String value, List<String> candidates) {
        String normalized = normalize(value);
        return !normalized.isBlank() && candidates != null && candidates.stream().map(this::normalize).anyMatch(normalized::equals);
    }

    private boolean similar(String left, String right) {
        String a = normalize(left), b = normalize(right);
        return !a.isBlank() && !b.isBlank() && (a.equals(b) || (Math.min(a.length(), b.length()) >= 3 && (a.contains(b) || b.contains(a))));
    }

    private boolean companyMatch(String value, RecallNotice notice) {
        if (blank(value)) return false;
        return List.of(safe(notice.getManufacturerName()), safe(notice.getRecallCompanyName()), safe(notice.getBrandName()))
                .stream().anyMatch(candidate -> similar(value, candidate));
    }

    private String normalize(String value) {
        return value == null ? "" : NON_IDENTIFIER.matcher(value.toUpperCase(Locale.ROOT)).replaceAll("");
    }

    private String safe(String value) { return value == null ? "" : value; }
    private boolean blank(String value) { return value == null || value.isBlank(); }

    public record Decision(RegisteredProduct.RecallDecisionStatus status, RecallNotice notice, List<String> matched,
                           List<String> mismatched, List<String> missing, List<String> candidateUids, String reason,
                           String queryType, String queryValue) {}
}
