package com.nuri.woori.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.ClimateAlert;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.ClimateAlertRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ClimateAlertSchedulerService {
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final DateTimeFormatter KMA_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter LIVING_TIME = DateTimeFormatter.ofPattern("yyyyMMddHH");
    private static final String DEFAULT_AREA_NO = "1100000000";
    private static final String DEFAULT_REGION = "대한민국";
    private static final String DEFAULT_AIR_STATION = "중구";

    private final ClimateAlertRepository climateAlertRepository;
    private final SeniorRepository seniorRepository;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${climate.service-key}")
    private String serviceKey;

    public ClimateAlertSchedulerService(ClimateAlertRepository climateAlertRepository, SeniorRepository seniorRepository) {
        this.climateAlertRepository = climateAlertRepository;
        this.seniorRepository = seniorRepository;
    }

    @Scheduled(cron = "0 0 * * * *", zone = "Asia/Seoul")
    public void recordHourlySafeWeather() {
        LocalDateTime hour = LocalDateTime.now(SEOUL).withMinute(0).withSecond(0).withNano(0);
        List<ClimateCandidate> warnings = fetchWeatherWarnings(hour);
        if (!warnings.isEmpty()) {
            saveForAllSeniors(warnings);
            return;
        }

        saveForAllSeniors(List.of(new ClimateCandidate(
                hour.format(DateTimeFormatter.ofPattern("yyyy-MM-dd-HH00")) + "-safe",
                "오늘 날씨",
                "safe",
                "현재 발령된 기상특보가 없습니다. 오늘 하루 기후 상태는 비교적 안전합니다.",
                DEFAULT_REGION,
                "KMA",
                hour
        )));
    }

    @Scheduled(fixedDelay = 60_000)
    public void recordImmediateRiskWeather() {
        LocalDateTime now = LocalDateTime.now(SEOUL).withSecond(0).withNano(0);
        List<ClimateCandidate> candidates = new ArrayList<>();
        candidates.addAll(fetchWeatherWarnings(now));
        candidates.addAll(fetchEnvironmentAlerts(now));
        if (!candidates.isEmpty()) {
            saveForAllSeniors(candidates);
        }
    }

    private List<ClimateCandidate> fetchWeatherWarnings(LocalDateTime now) {
        try {
            String date = now.format(KMA_DATE);
            String url = "https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList"
                    + "?ServiceKey=" + serviceKey
                    + "&pageNo=1&numOfRows=20&dataType=JSON"
                    + "&stnId=108&fromTmFc=" + date + "0000&toTmFc=" + date + "2359";
            List<JsonNode> itemList = normalizeItems(fetchItems(url));
            List<ClimateCandidate> result = new ArrayList<>();
            for (int i = 0; i < itemList.size(); i++) {
                JsonNode item = itemList.get(i);
                String title = text(item, "title", text(item, "t1", "기상특보가 발령되었습니다."));
                String tmFc = text(item, "tmFc", now.format(DateTimeFormatter.ofPattern("yyyyMMddHHmm")) + i);
                result.add(new ClimateCandidate(
                        "warning-" + tmFc + "-" + parseWarningType(title),
                        parseWarningType(title),
                        parseWarningLevel(title),
                        title,
                        text(item, "region", DEFAULT_REGION),
                        "KMA",
                        parseKmaDateTime(tmFc, now)
                ));
            }
            return result;
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private List<ClimateCandidate> fetchEnvironmentAlerts(LocalDateTime now) {
        List<ClimateCandidate> alerts = new ArrayList<>();
        fetchUv(now).ifPresent(alerts::add);
        fetchAirQuality(now).ifPresent(alerts::add);
        alerts.addAll(fetchPollen(now));
        return alerts;
    }

    private Optional<ClimateCandidate> fetchUv(LocalDateTime now) {
        try {
            String url = "https://apis.data.go.kr/1360000/LivingWthrIdxServiceV4/getUVIdxV4"
                    + "?ServiceKey=" + serviceKey
                    + "&pageNo=1&numOfRows=10&dataType=JSON"
                    + "&areaNo=" + DEFAULT_AREA_NO
                    + "&time=" + now.format(LIVING_TIME);
            JsonNode item = firstItem(url);
            if (item == null) return Optional.empty();
            int value = intValue(item, "h0", intValue(item, "h3", 0));
            if (value < 3) return Optional.empty();
            String levelText = value >= 8 ? "매우 높음" : value >= 6 ? "높음" : "보통";
            String level = value >= 8 ? "warning" : value >= 6 ? "caution" : "normal";
            return Optional.of(new ClimateCandidate(
                    hourlyEventId(now, "uv"),
                    "자외선",
                    level,
                    "자외선 지수가 " + value + "로 " + levelText + "입니다. 외출 시 모자나 선크림을 챙겨주세요.",
                    "현재 위치",
                    "KMA_LIVING",
                    now
            ));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private Optional<ClimateCandidate> fetchAirQuality(LocalDateTime now) {
        try {
            String station = URLEncoder.encode(DEFAULT_AIR_STATION, StandardCharsets.UTF_8);
            String url = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty"
                    + "?serviceKey=" + serviceKey
                    + "&returnType=json&numOfRows=1&pageNo=1"
                    + "&stationName=" + station + "&dataTerm=DAILY&ver=1.3";
            JsonNode item = firstItem(url);
            if (item == null) return Optional.empty();
            int pm10 = intValue(item, "pm10Value", 0);
            int pm25 = intValue(item, "pm25Value", 0);
            if (pm10 <= 30 && pm25 <= 15) return Optional.empty();
            String level = (pm10 > 150 || pm25 > 75) ? "warning" : (pm10 > 80 || pm25 > 35) ? "caution" : "normal";
            return Optional.of(new ClimateCandidate(
                    hourlyEventId(now, "air"),
                    "미세먼지",
                    level,
                    "미세먼지 상태를 확인해주세요. PM10 " + pm10 + ", PM2.5 " + pm25 + " 기준입니다.",
                    DEFAULT_AIR_STATION,
                    "AIRKOREA",
                    now
            ));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private List<ClimateCandidate> fetchPollen(LocalDateTime now) {
        List<ClimateCandidate> alerts = new ArrayList<>();
        fetchPollenOne(now, "pine", "소나무 꽃가루", "getPinePollenRiskIdxV3").ifPresent(alerts::add);
        fetchPollenOne(now, "oak", "참나무 꽃가루", "getOakPollenRiskIdxV3").ifPresent(alerts::add);
        fetchPollenOne(now, "weeds", "잡초류 꽃가루", "getWeedsPollenRiskndxV3").ifPresent(alerts::add);
        return alerts;
    }

    private Optional<ClimateCandidate> fetchPollenOne(LocalDateTime now, String key, String label, String operation) {
        try {
            String url = "https://apis.data.go.kr/1360000/HealthWthrIdxServiceV3/" + operation
                    + "?ServiceKey=" + serviceKey
                    + "&pageNo=1&numOfRows=10&dataType=JSON"
                    + "&areaNo=" + DEFAULT_AREA_NO
                    + "&time=" + now.format(LIVING_TIME);
            JsonNode item = firstItem(url);
            if (item == null) return Optional.empty();
            int value = intValue(item, "today", intValue(item, "h0", 1));
            if (value < 2) return Optional.empty();
            String level = value >= 4 ? "warning" : value >= 3 ? "caution" : "normal";
            String text = value >= 4 ? "매우 높음" : value >= 3 ? "높음" : "보통";
            return Optional.of(new ClimateCandidate(
                    hourlyEventId(now, "pollen-" + key),
                    "꽃가루",
                    level,
                    label + " 농도가 " + text + "입니다. 알레르기나 호흡기 질환이 있다면 마스크를 착용해주세요.",
                    "현재 위치",
                    "KMA_HEALTH",
                    now
            ));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private void saveForAllSeniors(List<ClimateCandidate> candidates) {
        List<Senior> seniors = seniorRepository.findAll();
        for (Senior senior : seniors) {
            for (ClimateCandidate candidate : candidates) {
                saveIfAbsent(senior.getId(), candidate);
            }
        }
    }

    private void saveIfAbsent(Long seniorId, ClimateCandidate candidate) {
        if (seniorId == null) return;

        if (climateAlertRepository.findBySeniorIdAndEventId(seniorId, candidate.eventId()).isPresent()) {
            return;
        }

        ClimateAlert alert = new ClimateAlert();
        alert.setSeniorId(seniorId);
        alert.setEventId(candidate.eventId());
        alert.setType(candidate.type());
        alert.setLevel(candidate.level());
        alert.setMessage(candidate.message());
        alert.setRegion(candidate.region());
        alert.setSource(candidate.source());
        alert.setAlertDate(candidate.issuedAt().toLocalDate());
        alert.setIssuedAt(candidate.issuedAt());

        try {
            climateAlertRepository.save(alert);
        } catch (DataIntegrityViolationException error) {
            // 이미 같은 seniorId + eventId 알림이 저장된 경우 무시
        }
    }

    private JsonNode fetchItems(String url) throws Exception {
        String body = restTemplate.getForObject(URI.create(url), String.class);
        return objectMapper.readTree(body).path("response").path("body").path("items").path("item");
    }

    private JsonNode firstItem(String url) throws Exception {
        List<JsonNode> items = normalizeItems(fetchItems(url));
        return items.isEmpty() ? null : items.get(0);
    }

    private List<JsonNode> normalizeItems(JsonNode items) {
        List<JsonNode> result = new ArrayList<>();
        if (items == null || items.isMissingNode() || items.isNull()) return result;
        if (items.isArray()) items.forEach(result::add);
        else result.add(items);
        return result;
    }

    private String text(JsonNode node, String field, String fallback) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? fallback : value.asText(fallback);
    }

    private int intValue(JsonNode node, String field, int fallback) {
        String value = text(node, field, String.valueOf(fallback));
        try {
            return Integer.parseInt(value.replaceAll("[^0-9-]", ""));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private String parseWarningType(String title) {
        if (title.contains("폭염")) return "폭염";
        if (title.contains("한파")) return "한파";
        if (title.contains("호우")) return "폭우";
        if (title.contains("대설")) return "폭설";
        if (title.contains("강풍")) return "강풍";
        if (title.contains("황사")) return "황사";
        if (title.contains("건조")) return "건조";
        return "기상특보";
    }

    private String parseWarningLevel(String title) {
        if (title.contains("경보") || title.contains("폭염") || title.contains("한파")) return "warning";
        if (title.contains("주의보")) return "caution";
        return "caution";
    }

    private LocalDateTime parseKmaDateTime(String value, LocalDateTime fallback) {
        try {
            return LocalDateTime.parse(value.substring(0, 12), DateTimeFormatter.ofPattern("yyyyMMddHHmm"));
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private String hourlyEventId(LocalDateTime now, String type) {
        return now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd-HH")) + "-" + type;
    }

    private record ClimateCandidate(
            String eventId,
            String type,
            String level,
            String message,
            String region,
            String source,
            LocalDateTime issuedAt
    ) {}
}
