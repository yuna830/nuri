package com.nuri.woori.controller;

public record WelfareBenefitAskRequest(
        Long seniorId,
        String question
) {
}
