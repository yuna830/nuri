package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.RecallNotice;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class RecallActionClassifier {
    private static final Pattern IMMEDIATE_STOP = Pattern.compile("즉시.{0,12}(사용.{0,4}(중지|중단)|회수)|사용.{0,4}(중지|중단|금지)", Pattern.CASE_INSENSITIVE);
    private static final Pattern REPAIR_OR_COLLECTION = Pattern.compile("수거|수선|수리", Pattern.CASE_INSENSITIVE);
    private static final Pattern EXCHANGE_OR_REFUND = Pattern.compile("교환|환불", Pattern.CASE_INSENSITIVE);
    private static final Pattern PRODUCT_CHECK = Pattern.compile("모델|제조.{0,6}(기간|일자|번호)|대상.{0,4}확인|제품.{0,4}확인", Pattern.CASE_INSENSITIVE);

    public RecallNotice.ActionType classify(String officialConsumerAction) {
        String action = officialConsumerAction == null ? "" : officialConsumerAction.trim();
        if (IMMEDIATE_STOP.matcher(action).find()) return RecallNotice.ActionType.IMMEDIATE_STOP;
        if (REPAIR_OR_COLLECTION.matcher(action).find()) return RecallNotice.ActionType.REPAIR_OR_COLLECTION;
        if (EXCHANGE_OR_REFUND.matcher(action).find()) return RecallNotice.ActionType.EXCHANGE_OR_REFUND;
        if (PRODUCT_CHECK.matcher(action).find()) return RecallNotice.ActionType.PRODUCT_CHECK_REQUIRED;
        return RecallNotice.ActionType.GENERAL_GUIDANCE;
    }
}
