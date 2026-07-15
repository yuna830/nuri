package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.RegisteredProduct;

import java.time.LocalDateTime;

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
        String recallReason,
        LocalDateTime lastCheckedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
