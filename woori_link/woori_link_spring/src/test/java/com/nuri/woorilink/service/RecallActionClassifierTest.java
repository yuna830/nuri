package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.RecallNotice;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RecallActionClassifierTest {
    private final RecallActionClassifier classifier = new RecallActionClassifier();

    @Test
    void collectionAndRepairIsClassifiedAsRepair() {
        assertThat(classifier.classify("구입처 또는 고객센터를 통한 수거 접수 후 수선"))
                .isEqualTo(RecallNotice.ActionType.REPAIR_OR_COLLECTION);
    }

    @Test
    void explicitImmediateStopHasHighestPriority() {
        assertThat(classifier.classify("즉시 사용을 중지하고 판매처에서 교환해 주세요"))
                .isEqualTo(RecallNotice.ActionType.IMMEDIATE_STOP);
    }

    @Test
    void exchangeAndRefundIsClassified() {
        assertThat(classifier.classify("판매처에 교환 또는 환불을 문의하세요"))
                .isEqualTo(RecallNotice.ActionType.EXCHANGE_OR_REFUND);
    }
}
