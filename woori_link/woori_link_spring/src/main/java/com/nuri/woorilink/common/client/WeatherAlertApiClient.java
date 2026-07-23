package com.nuri.woorilink.common.client;

import com.nuri.woorilink.common.config.PublicDataConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.io.StringReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Component
@RequiredArgsConstructor
public class WeatherAlertApiClient {

    private final PublicDataConfig config;

    private static final String BASE_URL =
            "http://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList";

    /*
     * 주소에 포함된 광역 지역명을 기준으로
     * 기상청 지점 번호를 선택합니다.
     */
    private static final Map<String, String> REGION_STATION = Map.ofEntries(
            Map.entry("서울", "108"),
            Map.entry("부산", "159"),
            Map.entry("대구", "143"),
            Map.entry("인천", "112"),
            Map.entry("광주", "156"),
            Map.entry("대전", "133"),
            Map.entry("울산", "152"),
            Map.entry("세종", "239"),
            Map.entry("경기", "119")
    );

    /*
     * 보호자에게 즉시 알려야 할 심각 기상특보 유형.
     */
    private static final List<String> SEVERE_WEATHER_KEYWORDS =
            List.of(
                    "폭염",
                    "한파",
                    "호우",
                    "대설",
                    "태풍",
                    "강풍",
                    "풍랑"
            );

    /*
     * 기상청 발표 시각 예:
     * 202607231000
     */
    private static final DateTimeFormatter WEATHER_TIME_FORMATTER =
            DateTimeFormatter.ofPattern("yyyyMMddHHmm");

    /**
     * 현재 유효한 심각 기상특보 상세 결과.
     *
     * active:
     * 현재 유효한 심각 특보 존재 여부
     *
     * alertName:
     * 화면에 표시할 특보명
     *
     * description:
     * 기상청에서 내려준 특보 제목 전체
     *
     * issuedAt:
     * 특보 발표 시각
     *
     * stationId:
     * 조회에 사용한 기상청 지점 번호
     */
    public record WeatherAlertResult(
            boolean active,
            String alertName,
            String description,
            LocalDateTime issuedAt,
            String stationId
    ) {

        public static WeatherAlertResult none(
                String stationId
        ) {
            return new WeatherAlertResult(
                    false,
                    null,
                    null,
                    null,
                    stationId
            );
        }
    }

    /**
     * 기존 코드와의 호환성을 위한 메서드.
     *
     * 상세 결과에서 active 값만 반환합니다.
     */
    public boolean hasWeatherAlert(
            String address
    ) {
        return getCurrentSevereAlert(address).active();
    }

    /**
     * 어르신 주소를 기준으로 현재 유효한
     * 심각 기상특보 상세 정보를 조회합니다.
     */
    public WeatherAlertResult getCurrentSevereAlert(
            String address
    ) {
        if (address == null || address.isBlank()) {
            return WeatherAlertResult.none(null);
        }

        String apiKey = config.getWeatherApiKey();

        if (apiKey == null || apiKey.isBlank()) {
            log.warn("기상특보 API 키가 설정되지 않았습니다.");
            return WeatherAlertResult.none(null);
        }

        String stationId = resolveStationId(address);

        try {
            String requestUrl = buildRequestUrl(
                    apiKey,
                    stationId
            );

            String response = get(requestUrl);

            return parseCurrentSevereAlert(
                    response,
                    stationId
            );
        } catch (Exception exception) {
            log.warn(
                    "기상특보 API 조회 실패. address={}, stationId={}, message={}",
                    address,
                    stationId,
                    exception.getMessage()
            );

            return WeatherAlertResult.none(stationId);
        }
    }

    /**
     * 주소 문자열에서 광역 지역명을 찾아
     * 기상청 지점 번호를 결정합니다.
     */
    private String resolveStationId(
            String address
    ) {
        return REGION_STATION.entrySet()
                .stream()
                .filter(entry ->
                        address.contains(entry.getKey())
                )
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse("108");
    }

    /**
     * 기상특보 조회 URL을 생성합니다.
     */
    private String buildRequestUrl(
            String apiKey,
            String stationId
    ) {
        String today = LocalDate.now()
                .format(DateTimeFormatter.BASIC_ISO_DATE);

        return UriComponentsBuilder
                .fromHttpUrl(BASE_URL)
                .queryParam("serviceKey", apiKey)
                .queryParam("stnId", stationId)
                .queryParam("numOfRows", "30")
                .queryParam("pageNo", "1")
                .queryParam("fromTmFc", today)
                .queryParam("toTmFc", today)
                .build(false)
                .toUriString();
    }

    /**
     * XML 응답에서 가장 최근의 심각 기상특보를 찾습니다.
     *
     * 가장 최신 항목이 해제·취소라면
     * 현재 유효 특보가 없는 것으로 판단합니다.
     */
    private WeatherAlertResult parseCurrentSevereAlert(
            String response,
            String stationId
    ) {
        if (
                response == null
                        || response.isBlank()
                        || !response.contains("<item>")
        ) {
            return WeatherAlertResult.none(stationId);
        }

        try {
            Document document = parseXml(response);

            NodeList itemNodes =
                    document.getElementsByTagName("item");

            Optional<WeatherAlertItem> latestRelevantItem =
                    toWeatherAlertItems(itemNodes)
                            .stream()
                            .filter(item ->
                                    containsSevereWeatherKeyword(
                                            item.title()
                                    )
                            )
                            .max(
                                    Comparator.comparing(
                                            WeatherAlertItem::issuedAt,
                                            Comparator.nullsLast(
                                                    Comparator.naturalOrder()
                                            )
                                    )
                            );

            if (latestRelevantItem.isEmpty()) {
                return WeatherAlertResult.none(stationId);
            }

            WeatherAlertItem latest =
                    latestRelevantItem.get();

            if (isReleaseOrCancellation(latest.title())) {
                return WeatherAlertResult.none(stationId);
            }

            return new WeatherAlertResult(
                    true,
                    extractAlertName(latest.title()),
                    latest.title(),
                    latest.issuedAt(),
                    stationId
            );
        } catch (Exception exception) {
            log.warn(
                    "기상특보 XML 파싱 실패. stationId={}, message={}",
                    stationId,
                    exception.getMessage()
            );

            return WeatherAlertResult.none(stationId);
        }
    }

    /**
     * XML item 노드를 내부 모델 목록으로 변환합니다.
     */
    private List<WeatherAlertItem> toWeatherAlertItems(
            NodeList itemNodes
    ) {
        java.util.ArrayList<WeatherAlertItem> items =
                new java.util.ArrayList<>();

        for (int index = 0; index < itemNodes.getLength(); index++) {
            Node node = itemNodes.item(index);

            if (node.getNodeType() != Node.ELEMENT_NODE) {
                continue;
            }

            Element itemElement = (Element) node;

            String title = getChildText(
                    itemElement,
                    "title"
            );

            String tmFc = getChildText(
                    itemElement,
                    "tmFc"
            );

            /*
             * 일부 응답에서는 발표 시각 필드명이 다를 가능성을 고려합니다.
             */
            if (tmFc == null || tmFc.isBlank()) {
                tmFc = getChildText(
                        itemElement,
                        "tmEf"
                );
            }

            if (title == null || title.isBlank()) {
                continue;
            }

            items.add(
                    new WeatherAlertItem(
                            cleanText(title),
                            parseWeatherTime(tmFc)
                    )
            );
        }

        return items;
    }

    /**
     * 심각 기상특보 키워드 포함 여부.
     */
    private boolean containsSevereWeatherKeyword(
            String title
    ) {
        if (title == null || title.isBlank()) {
            return false;
        }

        return SEVERE_WEATHER_KEYWORDS
                .stream()
                .anyMatch(title::contains);
    }

    /**
     * 해제 또는 취소 공고인지 판단합니다.
     */
    private boolean isReleaseOrCancellation(
            String title
    ) {
        if (title == null) {
            return false;
        }

        return title.contains("해제")
                || title.contains("취소");
    }

    /**
     * 전체 제목에서 화면에 사용할 대표 특보명을 추출합니다.
     *
     * 예:
     * "폭염경보 발표" → "폭염경보"
     * "호우주의보 발표" → "호우주의보"
     */
    private String extractAlertName(
            String title
    ) {
        if (title == null || title.isBlank()) {
            return "심각한 기상특보";
        }

        String normalized = cleanText(title);

        for (String keyword : SEVERE_WEATHER_KEYWORDS) {
            int keywordIndex = normalized.indexOf(keyword);

            if (keywordIndex < 0) {
                continue;
            }

            String remaining =
                    normalized.substring(keywordIndex);

            if (remaining.contains("경보")) {
                int endIndex =
                        remaining.indexOf("경보") + 2;

                return remaining
                        .substring(0, endIndex)
                        .trim();
            }

            if (remaining.contains("주의보")) {
                int endIndex =
                        remaining.indexOf("주의보") + 3;

                return remaining
                        .substring(0, endIndex)
                        .trim();
            }

            return keyword;
        }

        return "심각한 기상특보";
    }

    /**
     * 기상청 발표 시각 문자열을 LocalDateTime으로 변환합니다.
     */
    private LocalDateTime parseWeatherTime(
            String value
    ) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String digitsOnly =
                value.replaceAll("[^0-9]", "");

        if (digitsOnly.length() < 12) {
            return null;
        }

        String normalized =
                digitsOnly.substring(0, 12);

        try {
            return LocalDateTime.parse(
                    normalized,
                    WEATHER_TIME_FORMATTER
            );
        } catch (DateTimeParseException exception) {
            log.debug(
                    "기상특보 발표 시각 파싱 실패: {}",
                    value
            );

            return null;
        }
    }

    /**
     * XML 문자열을 DOM 문서로 파싱합니다.
     *
     * 외부 엔티티 처리를 막아 XXE 공격 가능성을 차단합니다.
     */
    private Document parseXml(
            String xml
    ) throws Exception {
        DocumentBuilderFactory factory =
                DocumentBuilderFactory.newInstance();

        factory.setFeature(
                "http://apache.org/xml/features/disallow-doctype-decl",
                true
        );

        factory.setFeature(
                "http://xml.org/sax/features/external-general-entities",
                false
        );

        factory.setFeature(
                "http://xml.org/sax/features/external-parameter-entities",
                false
        );

        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);

        DocumentBuilder builder =
                factory.newDocumentBuilder();

        return builder.parse(
                new InputSource(
                        new StringReader(xml)
                )
        );
    }

    /**
     * 자식 태그의 텍스트를 반환합니다.
     */
    private String getChildText(
            Element parent,
            String tagName
    ) {
        NodeList nodes =
                parent.getElementsByTagName(tagName);

        if (nodes.getLength() == 0) {
            return null;
        }

        Node node = nodes.item(0);

        if (node == null) {
            return null;
        }

        return cleanText(node.getTextContent());
    }

    /**
     * CDATA와 불필요한 공백을 정리합니다.
     */
    private String cleanText(
            String value
    ) {
        if (value == null) {
            return null;
        }

        return value
                .replace("<![CDATA[", "")
                .replace("]]>", "")
                .replaceAll("\\s+", " ")
                .trim();
    }

    /**
     * 공공데이터 API를 호출합니다.
     */
    private String get(
            String urlString
    ) throws Exception {
        HttpURLConnection connection =
                (HttpURLConnection) new URL(
                        urlString
                ).openConnection();

        connection.setRequestMethod("GET");
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
        connection.setRequestProperty(
                "Accept",
                "application/xml"
        );

        int responseCode =
                connection.getResponseCode();

        InputStream inputStream;

        if (
                responseCode >= 200
                        && responseCode < 300
        ) {
            inputStream =
                    connection.getInputStream();
        } else {
            inputStream =
                    connection.getErrorStream();
        }

        if (inputStream == null) {
            throw new IllegalStateException(
                    "기상특보 API 응답이 없습니다. status="
                            + responseCode
            );
        }

        try (InputStream stream = inputStream) {
            String response =
                    new String(
                            stream.readAllBytes(),
                            StandardCharsets.UTF_8
                    );

            if (
                    responseCode < 200
                            || responseCode >= 300
            ) {
                throw new IllegalStateException(
                        "기상특보 API 오류. status="
                                + responseCode
                                + ", response="
                                + response
                );
            }

            return response;
        } finally {
            connection.disconnect();
        }
    }

    /**
     * XML 파싱용 내부 모델.
     */
    private record WeatherAlertItem(
            String title,
            LocalDateTime issuedAt
    ) {
    }
}