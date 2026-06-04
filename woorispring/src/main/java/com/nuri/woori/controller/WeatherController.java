package com.nuri.woori.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 기상청 단기예보 API 프록시
 * Flutter 앱의 GET /api/weather?nx=&ny= 요청을 처리.
 * 기상청 격자 좌표(nx, ny)를 받아 오늘 날씨 핵심 값을 JSON으로 반환.
 */
@RestController
@RequestMapping("/api/weather")
@CrossOrigin(origins = "*")
public class WeatherController {

    private static final String SERVICE_KEY =
            "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";

    private static final long CACHE_TTL_MS = Duration.ofMinutes(30).toMillis();

    // KMA 단기예보 base_time 목록 (시간 오름차순)
    private static final int[] BASE_HOURS = {2, 5, 8, 11, 14, 17, 20, 23};

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final ObjectMapper mapper = new ObjectMapper();

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getWeather(
            @RequestParam int nx,
            @RequestParam int ny
    ) {
        String cacheKey = "weather:" + nx + ":" + ny;
        CacheEntry cached = cache.get(cacheKey);
        if (cached != null && !cached.isExpired()) {
            return ResponseEntity.ok(cached.data());
        }

        try {
            String[] dateTime = resolveBaseDateTime();
            String baseDate = dateTime[0];
            String baseTime = dateTime[1];

            String url = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
                    + "?serviceKey=" + SERVICE_KEY
                    + "&pageNo=1"
                    + "&numOfRows=100"
                    + "&dataType=JSON"
                    + "&base_date=" + baseDate
                    + "&base_time=" + baseTime
                    + "&nx=" + nx
                    + "&ny=" + ny;

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() == 200) {
                Map<String, Object> data = parseKmaResponse(response.body(), nx, ny);
                cache.put(cacheKey, new CacheEntry(data, System.currentTimeMillis()));
                return ResponseEntity.ok(data);
            }

            // API 실패 시 캐시 stale 반환
            if (cached != null) {
                return ResponseEntity.ok(cached.data());
            }

            return ResponseEntity.status(502).body(Map.of("error", "KMA_REQUEST_FAILED", "statusCode", response.statusCode()));

        } catch (Exception e) {
            if (cached != null) {
                return ResponseEntity.ok(cached.data());
            }
            return ResponseEntity.status(502).body(Map.of("error", "KMA_REQUEST_FAILED", "message", e.getMessage()));
        }
    }

    /**
     * KMA 응답 JSON 파싱 → 핵심 날씨 값 추출
     * 반환 필드: TMP(기온), POP(강수확률), WSD(풍속), REH(습도), PTY(강수형태), SKY(하늘상태)
     */
    private Map<String, Object> parseKmaResponse(String body, int nx, int ny) {
        Map<String, Object> result = new HashMap<>();
        result.put("nx", nx);
        result.put("ny", ny);

        try {
            JsonNode root = mapper.readTree(body);
            JsonNode items = root.path("response").path("body").path("items").path("item");

            if (items.isArray()) {
                String today = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));

                for (JsonNode item : items) {
                    String fcstDate = item.path("fcstDate").asText("");
                    String category = item.path("category").asText("");
                    String value = item.path("fcstValue").asText("");

                    // 오늘 날짜 데이터만 사용 (현재 시각에 가장 가까운 예보)
                    if (!today.equals(fcstDate)) continue;

                    switch (category) {
                        case "TMP"  -> result.putIfAbsent("TMP", value);
                        case "POP"  -> result.putIfAbsent("POP", value);
                        case "WSD"  -> result.putIfAbsent("WSD", value);
                        case "REH"  -> result.putIfAbsent("REH", value);
                        case "PTY"  -> result.putIfAbsent("PTY", value);
                        case "SKY"  -> result.putIfAbsent("SKY", value);
                        case "TMX"  -> result.putIfAbsent("TMX", value);
                        case "TMN"  -> result.putIfAbsent("TMN", value);
                        default -> {}
                    }
                }
            }
        } catch (Exception ignored) {}

        // Flutter WeatherScreen이 읽는 alias 필드도 같이 포함
        result.put("temp",      result.getOrDefault("TMP", "20"));
        result.put("rainProb",  result.getOrDefault("POP", "0"));
        result.put("wind",      result.getOrDefault("WSD", "0"));
        result.put("humid",     result.getOrDefault("REH", "50"));

        return result;
    }

    /**
     * 현재 시각 기준 가장 최근 기상청 base_time 계산
     * 기상청은 예보 발표 후 약 10분 뒤 제공 → 여유 시간 15분 적용
     */
    private String[] resolveBaseDateTime() {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now().minusMinutes(15);
        int nowHour = now.getHour();

        int selectedHour = BASE_HOURS[0];
        String baseDate = today.format(DateTimeFormatter.ofPattern("yyyyMMdd"));

        for (int h : BASE_HOURS) {
            if (nowHour >= h) {
                selectedHour = h;
            }
        }

        // 새벽 0~2시 사이면 전날 23시 예보 사용
        if (nowHour < BASE_HOURS[0]) {
            selectedHour = BASE_HOURS[BASE_HOURS.length - 1]; // 23
            baseDate = today.minusDays(1).format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        }

        String baseTime = String.format("%02d00", selectedHour);
        return new String[]{baseDate, baseTime};
    }

    private record CacheEntry(Map<String, Object> data, long savedAt) {
        boolean isExpired() {
            return System.currentTimeMillis() - savedAt > CACHE_TTL_MS;
        }
    }
}
