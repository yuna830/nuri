package com.nuri.woorilink.dto;

/**
 * 최근 안부 응답 패턴의 상태 등급.
 *
 * 상태 등급은 생성형 AI가 아니라 명확한 서버 규칙으로 결정한다.
 */
public enum CheckInAnalysisLevel {

    /**
     * 분석에 필요한 종료 기록이 부족한 상태.
     */
    INSUFFICIENT("분석 준비 중"),

    /**
     * 응답 패턴에서 특별한 주의 조건이 확인되지 않은 상태.
     */
    NORMAL("정상"),

    /**
     * 보호자가 최근 응답 기록을 확인할 필요가 있는 상태.
     */
    CAUTION("확인 필요"),

    /**
     * 보호자가 빠르게 직접 상태를 확인할 필요가 있는 상태.
     */
    URGENT("빠른 확인 필요");

    private final String label;

    CheckInAnalysisLevel(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}