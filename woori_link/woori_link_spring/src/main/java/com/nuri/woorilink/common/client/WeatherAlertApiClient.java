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
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherAlertApiClient {

    private final PublicDataConfig config;

    private static final String BASE_URL =
            "http://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList";

    private static final Map<String, String> REGION_STATION = Map.of(
            "서울", "108", "부산", "159", "대구", "143",
            "인천", "112", "광주", "156", "대전", "133",
            "울산", "152", "세종", "239", "경기", "119"
    );

    public boolean hasWeatherAlert(String address) {
        if (address == null || address.isBlank()) return false;
        String key = config.getWeatherApiKey();
        if (key == null || key.isBlank()) return false;

        String stationId = REGION_STATION.entrySet().stream()
                .filter(e -> address.contains(e.getKey()))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse("108");

        try {
            String url = UriComponentsBuilder.fromHttpUrl(BASE_URL)
                    .queryParam("serviceKey", key)
                    .queryParam("stnId", stationId)
                    .queryParam("numOfRows", "10")
                    .queryParam("pageNo", "1")
                    .build(false).toUriString();

            String response = get(url);
            return response != null && response.contains("<item>");
        } catch (Exception e) {
            log.warn("기상특보 API 조회 실패: {}", e.getMessage());
            return false;
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
