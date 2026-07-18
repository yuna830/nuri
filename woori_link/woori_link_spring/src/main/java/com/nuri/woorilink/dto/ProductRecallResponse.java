package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.RegisteredProduct;

import java.time.LocalDateTime;
import java.time.LocalDate;

public record ProductRecallResponse(
        Long id,
        Long seniorId,
        String seniorName,
        Integer seniorAge,
        String productName,
        String manufacturer,
        String modelNumber,
        RegisteredProduct.RecallStatus recallStatus,
        RegisteredProduct.CurrentUseStatus currentUseStatus,
        RegisteredProduct.ModelMatchStatus modelMatchStatus,
        String contactMethod,
        Boolean stopGuidanceCompleted,
        LocalDateTime stopGuidanceCompletedAt,
        String stopGuidanceMethod,
        String stopGuidanceTarget,
        Long stopGuidanceWorkerId,
        String stopGuidanceWorkerName,
        String stopGuidanceMemo,
        RegisteredProduct.GuardianContactStatus guardianContactStatus,
        String followUpType,
        LocalDate nextActionDate,
        RegisteredProduct.FollowUpProgressStatus followUpProgressStatus,
        String note,
        RegisteredProduct.FinalResult finalResult,
        String recallReason,
        String kcStatus,
        String kcCertNum,
        String kcCertState,
        String kcCertOrganName,
        String kcCertProductName,
        String kcCertModelName,
        String kcCertManufacturer,
        LocalDateTime lastCheckedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
