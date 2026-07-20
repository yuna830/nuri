package com.nuri.woorilink.common.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woorilink.common.config.PublicDataConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class KcApiClient {

    private final PublicDataConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String LIST_URL =
            "http://www.safetykorea.kr/openapi/api/cert/certificationList.json";
    private static final String DETAIL_URL =
            "http://www.safetykorea.kr/openapi/api/cert/certificationDetail.json";

    public KcLookup lookup(String certificationNumber, String modelName, String productName, String makerName) {
        String key = config.getRecallApiKey();
        if (!nonBlank(key)) return KcLookup.notChecked();

        String normalizedCertNumber = normalizeCertificationNumber(certificationNumber);
        if (nonBlank(normalizedCertNumber)) {
            JsonNode detail = findCertificationDetail(normalizedCertNumber, key);
            if (detail != null) {
                return new KcLookup(
                        "KC 인증 확인",
                        text(detail, "certNum"),
                        text(detail, "certState"),
                        text(detail, "certOrganName"),
                        text(detail, "productName"),
                        text(detail, "modelName"),
                        text(detail, "makerName")
                );
            }
        }

        for (SearchTerm term : searchTerms(modelName, productName, makerName)) {
            JsonNode item = findFirstCertification(term.conditionKey(), term.conditionValue(), key);
            if (item == null) continue;

            JsonNode detail = findCertificationDetail(text(item, "certNum"), key);
            JsonNode source = detail == null ? item : detail;

            return new KcLookup(
                    "KC 인증 확인",
                    firstNonBlank(text(source, "certNum"), text(item, "certNum")),
                    firstNonBlank(text(source, "certState"), text(item, "certState")),
                    firstNonBlank(text(source, "certOrganName"), text(item, "certOrganName")),
                    firstNonBlank(text(source, "productName"), text(item, "productName")),
                    firstNonBlank(text(source, "modelName"), text(item, "modelName")),
                    firstNonBlank(text(source, "makerName"), text(item, "makerName"))
            );
        }

        if (nonBlank(normalizedCertNumber)) {
            return KcLookup.certNumberDetected(normalizedCertNumber);
        }

        return KcLookup.notFound();
    }

    private List<SearchTerm> searchTerms(String modelName, String productName, String makerName) {
        return List.of(
                new SearchTerm("modelName", modelName),
                new SearchTerm("productName", productName),
                new SearchTerm("makerName", makerName)
        ).stream().filter(term -> nonBlank(term.conditionValue())).toList();
    }

    private JsonNode findFirstCertification(String conditionKey, String conditionValue, String authKey) {
        try {
            String url = UriComponentsBuilder.fromHttpUrl(LIST_URL)
                    .queryParam("conditionKey", conditionKey)
                    .queryParam("conditionValue", conditionValue)
                    .build()
                    .encode(StandardCharsets.UTF_8)
                    .toUriString();

            String response = get(url, authKey);
            JsonNode root = objectMapper.readTree(response);

            if (!"2000".equals(text(root, "resultCode"))) {
                log.warn("KC 인증 API 응답 실패: {}", response);
                return null;
            }

            JsonNode resultData = root.get("resultData");
            if (resultData != null && resultData.isArray() && resultData.size() > 0) {
                return resultData.get(0);
            }
        } catch (Exception e) {
            log.warn("KC 인증 API 조회 실패 conditionKey={}, conditionValue={}, error={}",
                    conditionKey, conditionValue, e.getMessage());
        }

        return null;
    }

    private JsonNode findCertificationDetail(String certNum, String authKey) {
        if (!nonBlank(certNum)) return null;

        try {
            String url = UriComponentsBuilder.fromHttpUrl(DETAIL_URL)
                    .queryParam("certNum", certNum)
                    .build()
                    .encode(StandardCharsets.UTF_8)
                    .toUriString();

            String response = get(url, authKey);
            JsonNode root = objectMapper.readTree(response);

            if (!"2000".equals(text(root, "resultCode"))) {
                log.warn("KC 인증 상세 API 응답 실패: {}", response);
                return null;
            }

            JsonNode resultData = root.get("resultData");
            if (resultData != null && resultData.isArray() && resultData.size() > 0) {
                return resultData.get(0);
            }
            if (resultData != null && resultData.isObject()) {
                return resultData;
            }
        } catch (Exception e) {
            log.warn("KC 인증 상세 API 조회 실패 certNum={}, error={}", certNum, e.getMessage());
        }

        return null;
    }

    private String get(String urlStr, String authKey) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("AuthKey", authKey);
        conn.setRequestProperty("Accept", "application/json");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        try (InputStream is = conn.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private String text(JsonNode node, String fieldName) {
        if (node == null) return "";
        JsonNode value = node.get(fieldName);
        if (value == null || value.isNull()) return "";
        return value.asText("");
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (nonBlank(value)) return value;
        }
        return null;
    }

    private boolean nonBlank(String value) {
        return value != null && !value.isBlank();
    }

    private String normalizeCertificationNumber(String value) {
        if (!nonBlank(value)) return "";
        String normalized = value
                .replace('Ç', 'C')
                .replace('ç', 'C')
                .replaceAll("\\s+", "")
                .toUpperCase();
        normalized = normalized.replaceFirst("^KC(?=R-R-)", "");
        normalized = normalized.replaceFirst("^KCR(?=-R-)", "R");
        return normalized;
    }

    private record SearchTerm(String conditionKey, String conditionValue) {}

    public record KcLookup(
            String status,
            String certNum,
            String certState,
            String certOrganName,
            String productName,
            String modelName,
            String makerName
    ) {
        static KcLookup notFound() {
            return new KcLookup("KC 인증 미확인", null, null, null, null, null, null);
        }

        static KcLookup certNumberDetected(String certNum) {
            return new KcLookup("KC_CERT_NUMBER_DETECTED", certNum, null, null, null, null, null);
        }

        static KcLookup notChecked() {
            return new KcLookup("KC 조회 불가", null, null, null, null, null, null);
        }
    }
}
