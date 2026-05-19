package com.nuri.woori.controller;

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
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/welfare-centers")
@CrossOrigin(origins = "*")
public class WelfareCenterController {

    @Value("${public-data.service-key}")
    private String serviceKey;

    private final HttpClient httpClient = HttpClient.newHttpClient();

    private List<WelfareCenterResponse> cachedCenters = List.of();
    private long cachedAt = 0L;

    private static final int NUM_OF_ROWS = 1000;
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

        try {
            List<WelfareCenterResponse> centers = loadCenters().stream()
                    .filter(center ->
                            center.name().contains(trimmedKeyword) ||
                                    center.type().contains(trimmedKeyword)
                    )
                    .limit(MAX_RESULT_COUNT)
                    .toList();

            return ResponseEntity.ok(centers);
        } catch (Exception error) {
            return ResponseEntity.ok(List.of());
        }
    }

    private synchronized List<WelfareCenterResponse> loadCenters() throws Exception {
        long now = System.currentTimeMillis();

        if (!cachedCenters.isEmpty() && now - cachedAt < CACHE_TTL_MS) {
            return cachedCenters;
        }

        Map<String, WelfareCenterResponse> results = new LinkedHashMap<>();

        int totalCount = fetchTotalCount();
        int totalPages = (int) Math.ceil(totalCount / (double) NUM_OF_ROWS);

        for (int page = 1; page <= totalPages; page++) {
            String url = "http://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getNFcltBizInqire"
                    + "?serviceKey=" + serviceKey
                    + "&pageNo=" + page
                    + "&numOfRows=" + NUM_OF_ROWS;

            HttpResponse<String> response = sendGet(url);

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                continue;
            }

            List<WelfareCenterResponse> pageCenters = parseCenters(response.body());

            for (WelfareCenterResponse center : pageCenters) {
                results.putIfAbsent(center.name(), center);
            }
        }

        cachedCenters = new ArrayList<>(results.values());
        cachedAt = now;

        return cachedCenters;
    }

    private int fetchTotalCount() throws Exception {
        String url = "http://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getNFcltBizInqire"
                + "?serviceKey=" + serviceKey
                + "&pageNo=1"
                + "&numOfRows=1";

        HttpResponse<String> response = sendGet(url);

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            return NUM_OF_ROWS;
        }

        Document document = parseDocument(response.body());
        String totalCountText = getDocumentText(document, "totalCount");

        try {
            return Integer.parseInt(totalCountText);
        } catch (NumberFormatException error) {
            return NUM_OF_ROWS;
        }
    }

    private HttpResponse<String> sendGet(String url) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private List<WelfareCenterResponse> parseCenters(String xml) throws Exception {
        List<WelfareCenterResponse> centers = new ArrayList<>();
        Document document = parseDocument(xml);
        NodeList items = document.getElementsByTagName("item");

        for (int index = 0; index < items.getLength(); index++) {
            Element item = (Element) items.item(index);

            String code = getText(item, "fcltCd");
            String name = getText(item, "fcltNm");
            String type = getText(item, "fcltKindNm");

            if (name.isBlank()) {
                continue;
            }

            centers.add(new WelfareCenterResponse(
                    code,
                    name,
                    "",
                    type,
                    ""
            ));
        }

        return centers;
    }

    private Document parseDocument(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();

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

    public record WelfareCenterResponse(
            String code,
            String name,
            String address,
            String type,
            String phone
    ) {
    }
}
