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
public class RecallApiClient {

    private final PublicDataConfig config;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String BASE_URL =
            "http://www.safetykorea.kr/openapi/api/recall/recallList.json";
    private static final String DETAIL_URL =
            "http://www.safetykorea.kr/openapi/api/recall/recallDetail.json";

    public boolean isRecalled(String keyword) {
        return findFirstRecall(keyword) != null;
    }

    public String getRecallDetail(String keyword) {
        JsonNode item = findFirstRecall(keyword);
        if (item == null) return null;
        JsonNode detail = findRecallDetail(text(item, "recallUid"));
        if (detail != null) item = detail;

        String harm = text(item, "harmDscr");
        String accident = text(item, "accidentCaseDscr");
        String action = text(item, "publishActionDscr");
        String tel = text(item, "recallInqryTel");

        StringBuilder sb = new StringBuilder();

        if (nonBlank(harm)) {
            sb.append("제품 결함: ").append(harm).append("\n");
        }
        if (nonBlank(accident)) {
            sb.append("위해 정보: ").append(accident).append("\n");
        }
        if (nonBlank(action)) {
            sb.append("소비자 행동요령: ").append(action).append("\n");
        }
        if (nonBlank(tel)) {
            sb.append("문의처: ").append(tel).append("\n");
        }

        return sb.toString().trim();
    }

    private JsonNode findRecallDetail(String recallUid) {
        if (!nonBlank(recallUid)) return null;

        String key = config.getRecallApiKey();
        if (!nonBlank(key)) return null;

        try {
            String url = UriComponentsBuilder.fromHttpUrl(DETAIL_URL)
                    .queryParam("recallUid", recallUid)
                    .build()
                    .encode(StandardCharsets.UTF_8)
                    .toUriString();

            String response = get(url, key);
            JsonNode root = objectMapper.readTree(response);

            if (!"2000".equals(text(root, "resultCode"))) {
                log.warn("리콜 상세 API 응답 실패: {}", response);
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
            log.warn("리콜 상세 API 조회 실패 recallUid={}, error={}", recallUid, e.getMessage());
        }

        return null;
    }

    private JsonNode findFirstRecall(String keyword) {
        if (!nonBlank(keyword)) return null;

        String key = config.getRecallApiKey();
        if (!nonBlank(key)) return null;

        for (String conditionKey : List.of("recallModelName", "recallProductName", "all")) {
            try {
                String url = UriComponentsBuilder.fromHttpUrl(BASE_URL)
                        .queryParam("conditionKey", conditionKey)
                        .queryParam("conditionValue", keyword)
                        .build()
                        .encode(StandardCharsets.UTF_8)
                        .toUriString();

                String response = get(url, key);
                JsonNode root = objectMapper.readTree(response);

                if (!"2000".equals(text(root, "resultCode"))) {
                    log.warn("리콜 API 응답 실패: {}", response);
                    continue;
                }

                JsonNode resultData = root.get("resultData");
                if (resultData != null && resultData.isArray() && resultData.size() > 0) {
                    return resultData.get(0);
                }
            } catch (Exception e) {
                log.warn("리콜 API 조회 실패 keyword={}, conditionKey={}, error={}",
                        keyword, conditionKey, e.getMessage());
            }
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
        JsonNode value = node.get(fieldName);
        if (value == null || value.isNull()) return "";
        return value.asText("");
    }

    private boolean nonBlank(String value) {
        return value != null && !value.isBlank();
    }
}
