package com.nuri.woorilink.dto;

public record EnergyVoucherEvaluationResult(
        boolean eligible,
        String reason
) {
}