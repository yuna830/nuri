package com.nuri.woorilink.dto;

public record EnergyVoucherResult(
        boolean eligible,
        String reason
) {
}