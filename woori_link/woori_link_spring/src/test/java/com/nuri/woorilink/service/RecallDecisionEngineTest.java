package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.RecallNotice;
import com.nuri.woorilink.entity.RegisteredProduct;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class RecallDecisionEngineTest {
    private final RecallDecisionEngine engine = new RecallDecisionEngine();

    @Test void barcodeExactMatchIsConfirmed() {
        var result = engine.decide(product(null, "8801234567890", null), List.of(notice(List.of("ABC-1"), List.of("8801234567890"), List.of(), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED);
        assertThat(result.matched()).contains("BARCODE");
    }

    @Test void barcodeMismatchIsNoMatch() {
        var result = engine.decide(product(null, "8800000000000", null), List.of(notice(List.of("ABC-1"), List.of("8801234567890"), List.of(), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.NO_MATCH_FOUND);
    }

    @Test void certificationExactMatchIsConfirmed() {
        var product = product("OTHER-1", null, "JU12345-1");
        var result = engine.decide(product, List.of(notice(List.of("ABC-1"), List.of(), List.of("JU12345-1"), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED);
    }

    @Test void normalizedModelNumberMatches() {
        var result = engine.decide(product("crp abc-123", null, null), List.of(notice(List.of("CRP-ABC123"), List.of(), List.of(), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED);
    }

    @Test void oneNoticeCanContainMultipleModels() {
        var result = engine.decide(product("DEF-2", null, null),
                List.of(notice(List.of("ABC-1", "DEF-2", "GHI-3"), List.of(), List.of(), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED);
    }

    @Test void certificationExactMatchWithModelIsConfirmed() {
        var result = engine.decide(product("ABC-1", null, "JU12345-1"),
                List.of(notice(List.of("ABC-1"), List.of(), List.of("JU12345-1"), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED);
        assertThat(result.matched()).contains("CERTIFICATION_NUMBER");
    }

    @Test void similarButDifferentModelDoesNotMatch() {
        var result = engine.decide(product("ABC-124", null, null), List.of(notice(List.of("ABC-123"), List.of(), List.of(), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.NO_MATCH_FOUND);
    }

    @Test void productNameOnlyRequiresReview() {
        RegisteredProduct product = product(null, null, null); product.setProductName("전기밥솥");
        var result = engine.decide(product, List.of(notice(List.of("ABC-1"), List.of(), List.of(), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.REVIEW_REQUIRED);
        assertThat(result.missing()).contains("MODEL_NUMBER", "BARCODE", "CERTIFICATION_NUMBER");
    }

    @Test void missingManufacturerRequiresReview() {
        RegisteredProduct product = product("ABC-1", null, null); product.setManufacturer(null);
        var result = engine.decide(product, List.of(notice(List.of("ABC-1"), List.of(), List.of(), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.REVIEW_REQUIRED);
    }

    @Test void manufacturerNotationDifferenceRequiresReviewInsteadOfNoMatch() {
        RegisteredProduct product = product("ABC-1", null, null);
        product.setManufacturer("CUCKOO ELECTRONICS");
        var result = engine.decide(product, List.of(notice(List.of("ABC-1"), List.of(), List.of(), false)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.REVIEW_REQUIRED);
    }

    @Test void confirmedCandidateWinsWhenSeveralCandidatesExist() {
        RecallNotice reviewCandidate = notice(List.of("ABC-1"), List.of(), List.of(), false);
        reviewCandidate.setManufacturerName(null);
        RecallNotice confirmedCandidate = notice(List.of("ABC-1"), List.of(), List.of(), false);
        confirmedCandidate.setRecallUid("R-2");
        var result = engine.decide(product("ABC-1", null, null), List.of(reviewCandidate, confirmedCandidate));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.RECALL_CONFIRMED);
        assertThat(result.notice().getRecallUid()).isEqualTo("R-2");
    }

    @Test void unstructuredManufacturingConditionRequiresReview() {
        var result = engine.decide(product("ABC-1", null, null), List.of(notice(List.of("ABC-1"), List.of(), List.of(), true)));
        assertThat(result.status()).isEqualTo(RegisteredProduct.RecallDecisionStatus.REVIEW_REQUIRED);
        assertThat(result.missing()).contains("ADDITIONAL_SCOPE_CONDITION", "MANUFACTURING_DATE");
    }

    private RegisteredProduct product(String model, String barcode, String cert) {
        return RegisteredProduct.builder().productName("전기밥솥").manufacturer("쿠쿠전자")
                .modelNumber(model).barcode(barcode).certificationNumber(cert).build();
    }
    private RecallNotice notice(List<String> models, List<String> barcodes, List<String> certs, boolean condition) {
        return RecallNotice.builder().recallUid("R-1").productName("전기밥솥").manufacturerName("쿠쿠전자")
                .modelNames(models).barcodeNumbers(barcodes).certNumbers(certs)
                .hasUnstructuredScopeCondition(condition).build();
    }
}
