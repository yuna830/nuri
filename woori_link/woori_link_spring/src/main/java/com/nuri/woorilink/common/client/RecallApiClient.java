package com.nuri.woorilink.common.client;

import com.nuri.woorilink.common.config.PublicDataConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class RecallApiClient {

    private final PublicDataConfig config;

    private static final String BASE_URL =
            "http://apis.data.go.kr/1140000/RecallIssueService/getRecallList";

    public boolean isRecalled(String productName) {
        if (productName == null || productName.isBlank()) return false;
        String key = config.getRecallApiKey();
        if (key == null || key.isBlank()) return false;

        try {
            String url = UriComponentsBuilder.fromHttpUrl(BASE_URL)
                    .queryParam("serviceKey", key)
                    .queryParam("prdNm", productName)
                    .queryParam("numOfRows", "5")
                    .queryParam("pageNo", "1")
                    .build(false).toUriString();

            String response = get(url);
            return response != null && response.contains("<rclsDscdNm>");
        } catch (Exception e) {
            log.warn("리콜 API 조회 실패: {}", e.getMessage());
            return false;
        }
    }

    public String getRecallDetail(String productName) {
        if (productName == null || productName.isBlank()) return null;
        String key = config.getRecallApiKey();
        if (key == null || key.isBlank()) return null;

        try {
            String url = UriComponentsBuilder.fromHttpUrl(BASE_URL)
                    .queryParam("serviceKey", key)
                    .queryParam("prdNm", productName)
                    .queryParam("numOfRows", "1")
                    .queryParam("pageNo", "1")
                    .build(false).toUriString();

            String response = get(url);
            if (response == null) return null;
            int start = response.indexOf("<rclsRsn>");
            int end = response.indexOf("</rclsRsn>");
            if (start >= 0 && end > start) {
                return response.substring(start + 9, end).trim();
            }
            return null;
        } catch (Exception e) {
            log.warn("리콜 상세 조회 실패: {}", e.getMessage());
            return null;
        }
    }

    private String get(String urlStr) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("GET");
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        try (InputStream is = conn.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
