package com.nuri.woorilink.common.client;

import com.nuri.woorilink.common.config.PublicDataConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import org.w3c.dom.*;
import javax.xml.parsers.*;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Component
@RequiredArgsConstructor
public class WelfareFacilityApiClient {

    private static final String BASE_URL =
            "https://apis.data.go.kr/B554287/sclWlfrFcltInfoInqirService1/getFcltListInfoInqire";

    private final PublicDataConfig config;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    public List<Map<String, String>> searchFacilities(String name) {
        try {
            URI uri = UriComponentsBuilder.fromHttpUrl(BASE_URL)
                    .queryParam("serviceKey", config.getWelfareFacilityApiKey())
                    .queryParam("pageNo", 1)
                    .queryParam("numOfRows", 20)
                    .queryParam("facltNm", name)
                    .encode(StandardCharsets.UTF_8)
                    .build()
                    .toUri();

            HttpRequest request = HttpRequest.newBuilder(uri).GET().build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            return parseXml(response.body());
        } catch (Exception e) {
            e.printStackTrace();
            return List.of();
        }
    }

    private List<Map<String, String>> parseXml(String xml) throws Exception {
        DocumentBuilder builder = DocumentBuilderFactory.newInstance().newDocumentBuilder();
        Document doc = builder.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));

        List<Map<String, String>> result = new ArrayList<>();
        NodeList items = doc.getElementsByTagName("item");

        for (int i = 0; i < items.getLength(); i++) {
            Element item = (Element) items.item(i);
            Map<String, String> map = new LinkedHashMap<>();
            map.put("name", getText(item, "facltNm"));
            map.put("type", getText(item, "fcltKindNm"));
            map.put("address", getText(item, "addr"));
            map.put("sigungu", getText(item, "sggNm"));
            result.add(map);
        }
        return result;
    }

    private String getText(Element el, String tag) {
        NodeList nl = el.getElementsByTagName(tag);
        return nl.getLength() > 0 ? nl.item(0).getTextContent().trim() : "";
    }
}
