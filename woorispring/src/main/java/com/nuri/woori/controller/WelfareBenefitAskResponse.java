package com.nuri.woori.controller;

import java.util.List;

public record WelfareBenefitAskResponse(
        String answer,
        List<Source> sources
) {
    public record Source(
            String title,
            String organization,
            String sourceType,
            String sourceName,
            String sourceUrl,
            Integer pageNo
    ) {
    }
}
