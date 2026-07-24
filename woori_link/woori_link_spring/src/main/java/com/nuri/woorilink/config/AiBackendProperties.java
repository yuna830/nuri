package com.nuri.woorilink.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "woori.ai.backend")
public class AiBackendProperties {

    /**
     * FastAPI 안부 분석 기능 사용 여부.
     */
    private boolean enabled = true;

    /**
     * FastAPI 기본 주소.
     *
     * 기본값:
     */
    private String baseUrl;

    /**
     * 안부 분석 API 경로.
     */
    private String checkInAnalysisPath =
            "/ai/check-in-analysis";

    /**
     * FastAPI 연결 제한 시간.
     */
    private int connectTimeoutMs = 5000;

    /**
     * FastAPI 응답 제한 시간.
     */
    private int readTimeoutMs = 15000;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = normalizeText(baseUrl, null);
    }

    public String getCheckInAnalysisPath() {
        return checkInAnalysisPath;
    }

    public void setCheckInAnalysisPath(
            String checkInAnalysisPath
    ) {
        this.checkInAnalysisPath = normalizeText(
                checkInAnalysisPath,
                "/ai/check-in-analysis"
        );
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(
            int connectTimeoutMs
    ) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public int getReadTimeoutMs() {
        return readTimeoutMs;
    }

    public void setReadTimeoutMs(
            int readTimeoutMs
    ) {
        this.readTimeoutMs = readTimeoutMs;
    }

    /**
     * FastAPI 호출이 가능한 설정인지 확인한다.
     */
    public boolean isConfigured() {
        return enabled
                && baseUrl != null
                && !baseUrl.isBlank()
                && checkInAnalysisPath != null
                && !checkInAnalysisPath.isBlank();
    }

    /**
     * baseUrl과 API 경로를 안전하게 합친다.
     */
    public String getCheckInAnalysisUrl() {
        String normalizedBaseUrl =
                removeTrailingSlash(baseUrl);

        String normalizedPath =
                addLeadingSlash(checkInAnalysisPath);

        return normalizedBaseUrl + normalizedPath;
    }

    private String normalizeText(
            String value,
            String defaultValue
    ) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }

        return value.trim();
    }

    private String removeTrailingSlash(
            String value
    ) {
        String result = value == null
                ? ""
                : value.trim();

        while (result.endsWith("/")) {
            result = result.substring(
                    0,
                    result.length() - 1
            );
        }

        return result;
    }

    private String addLeadingSlash(
            String value
    ) {
        String result = value == null
                ? ""
                : value.trim();

        if (result.startsWith("/")) {
            return result;
        }

        return "/" + result;
    }
}
