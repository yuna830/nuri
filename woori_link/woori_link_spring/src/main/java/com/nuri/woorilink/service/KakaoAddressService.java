package com.nuri.woorilink.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woorilink.common.config.PublicDataConfig;
import com.nuri.woorilink.dto.AddressSearchResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class KakaoAddressService {

    private static final String BASE_URL = "https://dapi.kakao.com/v2/local/search/address.json";
    private static final String KEYWORD_URL = "https://dapi.kakao.com/v2/local/search/keyword.json";

    private final PublicDataConfig config;
    private final ObjectMapper objectMapper;

    public List<AddressSearchResult> search(String query) {
        if (!StringUtils.hasText(query)) {
            throw new IllegalArgumentException("주소 검색어를 입력해주세요.");
        }
        if (!StringUtils.hasText(config.getKakaoRestApiKey())) {
            throw new IllegalArgumentException("카카오 REST API 키가 설정되지 않았습니다.");
        }

        try {
            String url = UriComponentsBuilder.fromHttpUrl(BASE_URL)
                    .queryParam("query", query)
                    .queryParam("size", 10)
                    .encode(StandardCharsets.UTF_8)
                    .build()
                    .toUriString();

            JsonNode documents = objectMapper.readTree(get(url)).path("documents");
            List<AddressSearchResult> results = new ArrayList<>();

            for (JsonNode item : documents) {
                String addressName = item.path("address_name").asText("");
                String roadAddress = item.path("road_address").path("address_name").asText("");
                String jibunAddress = item.path("address").path("address_name").asText("");
                String displayAddress = StringUtils.hasText(roadAddress) ? roadAddress : addressName;

                results.add(new AddressSearchResult(
                        "",
                        displayAddress,
                        roadAddress,
                        jibunAddress,
                        parseDouble(item.path("y").asText(null)),
                        parseDouble(item.path("x").asText(null))
                ));
            }

            if (results.isEmpty()) {
                String keywordUrl = UriComponentsBuilder.fromHttpUrl(KEYWORD_URL)
                        .queryParam("query", query)
                        .queryParam("size", 10)
                        .encode(StandardCharsets.UTF_8)
                        .build()
                        .toUriString();

                JsonNode keywordDocuments = objectMapper.readTree(get(keywordUrl)).path("documents");
                for (JsonNode item : keywordDocuments) {
                    String roadAddress = item.path("road_address_name").asText("");
                    String jibunAddress = item.path("address_name").asText("");
                    String placeName = item.path("place_name").asText("");
                    String displayAddress = StringUtils.hasText(roadAddress) ? roadAddress : jibunAddress;
                    results.add(new AddressSearchResult(
                            placeName,
                            StringUtils.hasText(displayAddress) ? displayAddress : placeName,
                            roadAddress,
                            jibunAddress,
                            parseDouble(item.path("y").asText(null)),
                            parseDouble(item.path("x").asText(null))
                    ));
                }
            }

            return results;
        } catch (Exception e) {
            throw new IllegalArgumentException("주소 검색에 실패했습니다.");
        }
    }

    private String get(String urlStr) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlStr).openConnection();
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Authorization", "KakaoAK " + config.getKakaoRestApiKey());
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);

        try (InputStream is = conn.getInputStream()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private Double parseDouble(String value) {
        if (!StringUtils.hasText(value)) return null;
        return Double.parseDouble(value);
    }
}
