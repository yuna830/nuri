package com.nuri.woori.controller;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/environment")
@CrossOrigin(origins = "*")
public class EnvironmentController {
    private static final String AIRKOREA_SERVICE_KEY = "M1FEdIziwexRX6M%2BKOI2PolaM4N3Hr6gNs3Dd26lwB202guC%2B2hsoMRPlmN0g%2FFPF3YvFT0WEf99ZYNyb22rKQ%3D%3D";
    private static final long CACHE_TTL_MS = Duration.ofMinutes(10).toMillis();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();
    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();

    @GetMapping(value = "/air-quality", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<String> getAirQuality(@RequestParam(defaultValue = "서울") String sidoName) {
        String normalizedSido = normalizeSidoName(sidoName);
        String cacheKey = "air-quality:" + normalizedSido;
        CacheEntry cached = cache.get(cacheKey);

        if (cached != null && !cached.isExpired()) {
            return ResponseEntity.ok()
                    .header("X-Cache", "HIT")
                    .body(cached.body());
        }

        try {
            String url = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty"
                    + "?serviceKey=" + AIRKOREA_SERVICE_KEY
                    + "&returnType=json"
                    + "&numOfRows=100"
                    + "&pageNo=1"
                    + "&sidoName=" + URLEncoder.encode(normalizedSido, StandardCharsets.UTF_8)
                    + "&ver=1.3";

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(8))
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() == 200) {
                cache.put(cacheKey, new CacheEntry(response.body(), System.currentTimeMillis()));
                return ResponseEntity.ok()
                        .header("X-Cache", "MISS")
                        .body(response.body());
            }

            if (cached != null) {
                return ResponseEntity.ok()
                        .header("X-Cache", "STALE")
                        .body(cached.body());
            }

            return ResponseEntity.status(response.statusCode()).body(response.body());
        } catch (Exception error) {
            if (cached != null) {
                return ResponseEntity.ok()
                        .header("X-Cache", "STALE")
                        .body(cached.body());
            }

            return ResponseEntity.status(502)
                    .body("{\"error\":\"AIRKOREA_REQUEST_FAILED\"}");
        }
    }

    private String normalizeSidoName(String sidoName) {
        if (sidoName == null || sidoName.isBlank()) {
            return "서울";
        }
        return sidoName.trim();
    }

    private record CacheEntry(String body, long savedAt) {
        boolean isExpired() {
            return System.currentTimeMillis() - savedAt > CACHE_TTL_MS;
        }
    }
}
