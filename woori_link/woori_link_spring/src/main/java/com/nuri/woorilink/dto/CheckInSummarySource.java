package com.nuri.woorilink.dto;

/**
 * 보호자용 안내 문구를 생성한 방식.
 */
public enum CheckInSummarySource {

    /**
     * Gemini가 생성한 안내 문구.
     */
    GEMINI,

    /**
     * FastAPI 내부 규칙으로 생성한 기본 안내 문구.
     */
    RULE_BASED
}