package com.nuri.woorilink.service;

import com.nuri.woorilink.config.AiBackendProperties;
import com.nuri.woorilink.dto.CheckInAnalysisRequest;
import com.nuri.woorilink.dto.CheckInAnalysisResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;

/**
 * Spring에서 FastAPI 안부 분석 서버를 호출하는 클라이언트.
 */
@Slf4j
@Service
public class CheckInAnalysisAiClient {

    private static final int MAX_ERROR_BODY_LOG_LENGTH = 4_000;

    private final AiBackendProperties properties;

    private final RestClient restClient;

    public CheckInAnalysisAiClient(
            AiBackendProperties properties
    ) {
        this.properties = properties;

        SimpleClientHttpRequestFactory requestFactory =
                new SimpleClientHttpRequestFactory();

        requestFactory.setConnectTimeout(
                properties.getConnectTimeoutMs()
        );

        requestFactory.setReadTimeout(
                properties.getReadTimeoutMs()
        );

        this.restClient = RestClient.builder()
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * 최근 안부 기록을 FastAPI에 전달하고
     * 통계, 위험 단계, Gemini 요약 결과를 받는다.
     */
    public CheckInAnalysisResponse analyze(
            CheckInAnalysisRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Check-in analysis request is required"
            );
        }

        if (!properties.isConfigured()) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI 안부 분석 기능이 비활성화되어 있습니다."
            );
        }

        String requestUrl =
                properties.getCheckInAnalysisUrl();

        log.info(
                "Calling FastAPI check-in analysis. "
                        + "url={}, seniorId={}, recordCount={}",
                requestUrl,
                request.seniorId(),
                request.checkIns() == null
                        ? 0
                        : request.checkIns().size()
        );

        try {
            CheckInAnalysisResponse response =
                    restClient.post()
                            .uri(requestUrl)
                            .contentType(
                                    MediaType.APPLICATION_JSON
                            )
                            .accept(
                                    MediaType.APPLICATION_JSON
                            )
                            .body(request)
                            .retrieve()
                            .body(
                                    CheckInAnalysisResponse.class
                            );

            if (response == null) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_GATEWAY,
                        "AI 안부 분석 서버에서 빈 응답을 반환했습니다."
                );
            }

            validateResponse(
                    request,
                    response
            );

            return response;

        } catch (RestClientResponseException exception) {
            String responseBody =
                    exception.getResponseBodyAsString(
                            StandardCharsets.UTF_8
                    );

            log.warn(
                    "FastAPI check-in analysis failed. "
                            + "statusCode={}, responseBody={}",
                    exception.getStatusCode().value(),
                    shortenForLog(responseBody)
            );

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI 안부 분석 서버가 요청을 처리하지 못했습니다. "
                            + "FastAPI status="
                            + exception.getStatusCode().value(),
                    exception
            );

        } catch (RestClientException exception) {
            log.warn(
                    "FastAPI check-in analysis connection failed. "
                            + "errorType={}, message={}",
                    exception.getClass().getSimpleName(),
                    exception.getMessage()
            );

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "AI 안부 분석 서버에 연결할 수 없습니다.",
                    exception
            );
        }
    }

    /**
     * 다른 님의 분석 결과가 잘못 반환되는 것을 방지한다.
     */
    private void validateResponse(
            CheckInAnalysisRequest request,
            CheckInAnalysisResponse response
    ) {
        if (response.seniorId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI 안부 분석 응답에 님 ID가 없습니다."
            );
        }

        if (!response.seniorId().equals(
                request.seniorId()
        )) {
            log.warn(
                    "FastAPI check-in analysis senior ID mismatch. "
                            + "requestedSeniorId={}, responseSeniorId={}",
                    request.seniorId(),
                    response.seniorId()
            );

            throw new ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI 안부 분석 응답의 님 정보가 일치하지 않습니다."
            );
        }
    }

    /**
     * 오류 응답이 지나치게 길거나 여러 줄로 출력되는 것을 방지한다.
     */
    private String shortenForLog(
            String value
    ) {
        if (value == null || value.isBlank()) {
            return "(empty)";
        }

        String normalized = value
                .replace("\r", " ")
                .replace("\n", " ")
                .trim();

        if (normalized.length()
                <= MAX_ERROR_BODY_LOG_LENGTH) {

            return normalized;
        }

        return normalized.substring(
                0,
                MAX_ERROR_BODY_LOG_LENGTH
        ) + "...";
    }
}