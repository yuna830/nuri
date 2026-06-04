package com.nuri.woori.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/welfare-centers")
@CrossOrigin(origins = "*")
public class WelfareCenterController {

    private static final Logger log = LoggerFactory.getLogger(WelfareCenterController.class);

    @Value("${public-data.service-key}")
    private String serviceKey;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private List<WelfareCenterResponse> cachedCenters = List.of();
    private long cachedAt = 0L;

    private static final int NUM_OF_ROWS = 100;
    private static final int MAX_RESULT_COUNT = 30;
    private static final long CACHE_TTL_MS = 1000L * 60 * 60 * 24;

    @GetMapping
    public ResponseEntity<List<WelfareCenterResponse>> searchCenters(
            @RequestParam String keyword
    ) {
        String trimmedKeyword = keyword == null ? "" : keyword.trim();

        if (trimmedKeyword.length() < 2) {
            return ResponseEntity.ok(List.of());
        }

        String normalizedKeyword = normalize(trimmedKeyword);

        try {
            List<WelfareCenterResponse> centers = loadCenters().stream()
                    .filter(center -> matches(center, normalizedKeyword))
                    .sorted((a, b) -> {
                        boolean aRegionStarts = normalize(a.region()).contains(normalizedKeyword);
                        boolean bRegionStarts = normalize(b.region()).contains(normalizedKeyword);

                        if (aRegionStarts == bRegionStarts) {
                            return a.name().compareTo(b.name());
                        }

                        return aRegionStarts ? -1 : 1;
                    })
                    .limit(MAX_RESULT_COUNT)
                    .toList();

            return ResponseEntity.ok(centers);
        } catch (Exception error) {
            log.error("[WelfareCenter] search failed. keyword={}, serviceKeyEmpty={}",
                    trimmedKeyword,
                    serviceKey == null || serviceKey.isBlank(),
                    error
            );

            return ResponseEntity.status(500).body(List.of());
        }
    }

    private boolean matches(WelfareCenterResponse center, String keyword) {
        String normalizedKeyword = normalize(keyword);
        String normalizedRegion = normalize(center.region());
        String normalizedAddress = normalize(center.address());

        return normalizedRegion.contains(normalizedKeyword)
                || normalizedAddress.contains(normalizedKeyword);
    }

    private synchronized List<WelfareCenterResponse> loadCenters() throws Exception {
        long now = System.currentTimeMillis();

        if (!cachedCenters.isEmpty() && now - cachedAt < CACHE_TTL_MS) {
            return cachedCenters;
        }

        Map<String, WelfareCenterResponse> results = new LinkedHashMap<>();

        int maxPages = 50;

        for (int page = 1; page <= maxPages; page++) {
            String url = buildListUrl(page, NUM_OF_ROWS);
            HttpResponse<String> response = sendGet(url);

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("[WelfareCenter] public API status={} page={}", response.statusCode(), page);
                break;
            }

            List<WelfareCenterResponse> pageCenters = parseCenters(response.body());

            log.info("[WelfareCenter] page={}, parsed={}", page, pageCenters.size());

            if (pageCenters.isEmpty()) {
                break;
            }

            for (WelfareCenterResponse center : pageCenters) {
                String key = center.code().isBlank()
                        ? center.name() + "|" + center.region()
                        : center.code();

                results.putIfAbsent(key, center);
            }
        }

        cachedCenters = new ArrayList<>(results.values());
        cachedAt = now;

        log.info("[WelfareCenter] loaded centers={}", cachedCenters.size());
        return cachedCenters;
    }

    private void validatePublicApiResponse(Document document, String rawXml) {
        String resultCode = getDocumentText(document, "resultCode");
        String resultMsg = getDocumentText(document, "resultMsg");
        String returnAuthMsg = getDocumentText(document, "returnAuthMsg");
        String errMsg = getDocumentText(document, "errMsg");

        if (!returnAuthMsg.isBlank() || !errMsg.isBlank()) {
            throw new IllegalStateException(
                    "공공데이터 API 인증 오류: returnAuthMsg=" + returnAuthMsg
                            + ", errMsg=" + errMsg
                            + ", body=" + rawXml.substring(0, Math.min(rawXml.length(), 500))
            );
        }

        if (!resultCode.isBlank() && !"00".equals(resultCode)) {
            throw new IllegalStateException(
                    "공공데이터 API 오류: resultCode=" + resultCode
                            + ", resultMsg=" + resultMsg
                            + ", body=" + rawXml.substring(0, Math.min(rawXml.length(), 500))
            );
        }
    }

    private int fetchTotalCount() throws Exception {
        String url = buildListUrl(1, 1);
        HttpResponse<String> response = sendGet(url);

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            log.warn("[WelfareCenter] totalCount API status={}", response.statusCode());
            return NUM_OF_ROWS;
        }

        String body = response.body();
        Document document = parseDocument(body);
        validatePublicApiResponse(document, body);

        String totalCountText = getDocumentText(document, "totalCount");
        log.info("[WelfareCenter] totalCount={}", totalCountText);

        try {
            return Integer.parseInt(totalCountText);
        } catch (NumberFormatException error) {
            log.warn("[WelfareCenter] invalid totalCount={}", totalCountText);
            return NUM_OF_ROWS;
        }
    }

    private String buildListUrl(int pageNo, int numOfRows) {
        String key = serviceKey == null ? "" : serviceKey.trim();

        if (key.isBlank()) {
            log.warn("[WelfareCenter] PUBLIC_DATA_SERVICE_KEY is empty");
        }

        String queryKey = key.contains("%")
                ? key
                : URLEncoder.encode(key, StandardCharsets.UTF_8);

        return "https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltListInfoInqire"
                + "?serviceKey=" + queryKey
                + "&pageNo=" + pageNo
                + "&numOfRows=" + numOfRows;
    }

    private HttpResponse<String> sendGet(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private List<WelfareCenterResponse> parseCenters(String xml) throws Exception {
        List<WelfareCenterResponse> centers = new ArrayList<>();
        Document document = parseDocument(xml);
        validatePublicApiResponse(document, xml);

        NodeList items = document.getElementsByTagName("item");

        log.info("[WelfareCenter] item count={}", items.getLength());

        for (int index = 0; index < items.getLength(); index++) {
            Element item = (Element) items.item(index);

            String code = getText(item, "fcltCd");
            String name = getText(item, "fcltNm");
            String type = getText(item, "fcltKindNm");
            String region = getText(item, "jrsdSggNm");
            String address = getText(item, "roadNmAddr");
            String phone = firstText(item, "telNo", "fcltTelNo", "phoneNumber", "cntctTelNo");

            if (address.isBlank()) {
                address = getText(item, "lotnoAddr");
            }

            if (address.isBlank()) {
                address = region;
            }

            log.info("[WelfareCenter] parsed name={}, type={}, region={}, address={}, phone={}",
                    name, type, region, address, phone);

            if (name.isBlank()) {
                continue;
            }

            centers.add(new WelfareCenterResponse(
                    code,
                    name,
                    address,
                    type,
                    phone,
                    region
            ));
        }

        return centers;
    }

    private String firstText(Element element, String... tagNames) {
        for (String tagName : tagNames) {
            String value = getText(element, tagName);

            if (!value.isBlank()) {
                return value;
            }
        }

        return "";
    }

    private Document parseDocument(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

        return factory
                .newDocumentBuilder()
                .parse(new InputSource(new StringReader(xml)));
    }

    private String getDocumentText(Document document, String tagName) {
        NodeList nodes = document.getElementsByTagName(tagName);

        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return "";
        }

        return nodes.item(0).getTextContent().trim();
    }

    private String getText(Element element, String tagName) {
        NodeList nodes = element.getElementsByTagName(tagName);

        if (nodes.getLength() == 0 || nodes.item(0) == null) {
            return "";
        }

        return nodes.item(0).getTextContent().trim();
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }

        return value
                .trim()
                .replaceAll("\\s+", "")
                .toLowerCase();
    }

    public record WelfareCenterResponse(
            String code,
            String name,
            String address,
            String type,
            String phone,
            String region
    ) {
    }
}