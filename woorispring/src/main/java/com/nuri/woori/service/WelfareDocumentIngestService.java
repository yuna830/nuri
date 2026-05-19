package com.nuri.woori.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class WelfareDocumentIngestService {

    private static final int CHUNK_SIZE = 900;
    private static final int CHUNK_OVERLAP = 120;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${public-data.welfare-service-key}")
    private String welfareServiceKey;

    @Value("${public-data.welfare-list-url}")
    private String welfareListUrl;

    @Value("${public-data.welfare-detail-url}")
    private String welfareDetailUrl;

    @Value("${gemini.api-key}")
    private String geminiApiKey;

    @Value("${gemini.embedding-model}")
    private String embeddingModel;

    public WelfareDocumentIngestService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public SyncResult sync(int maxPages, int numOfRows) {
        int savedDocuments = 0;
        int savedChunks = 0;

        for (int pageNo = 1; pageNo <= maxPages; pageNo++) {
            String listXml = requestXml(buildListUrl(pageNo, numOfRows));
            List<WelfareListItem> listItems = parseListItems(listXml);

            if (listItems.isEmpty()) {
                break;
            }

            for (WelfareListItem item : listItems) {
                try {
                    WelfareDocumentData documentData = fetchDocumentData(item);
                    Long documentId = saveDocument(documentData);
                    int chunkCount = saveChunks(documentId, documentData.content());

                    savedDocuments += 1;
                    savedChunks += chunkCount;
                } catch (Exception error) {
                    System.out.println("복지 문서 수집 실패: " + item.serviceId() + " / " + error.getMessage());
                }
            }
        }

        return new SyncResult(savedDocuments, savedChunks);
    }

    private WelfareDocumentData fetchDocumentData(WelfareListItem item) {
        String detailXml = "";

        if (!item.serviceId().isBlank() && !welfareDetailUrl.isBlank()) {
            detailXml = requestXml(buildDetailUrl(item.serviceId()));
        }

        Document detailDocument = detailXml.isBlank() ? null : parseXml(detailXml);
        String title = firstNotBlank(
                item.title(),
                text(detailDocument, "servNm"),
                text(detailDocument, "serviceName"),
                text(detailDocument, "svcNm"),
                "지자체 복지서비스"
        );

        String source = "data.go.kr:local-welfare:" + firstNotBlank(item.serviceId(), title);

        String content = buildContent(item, detailDocument);

        return new WelfareDocumentData(title, source, content);
    }

    private Long saveDocument(WelfareDocumentData data) {
        List<Long> existingIds = jdbcTemplate.query(
                "SELECT id FROM welfare_documents WHERE source = ? ORDER BY id LIMIT 1",
                (rs, rowNum) -> rs.getLong("id"),
                data.source()
        );

        if (!existingIds.isEmpty()) {
            Long documentId = existingIds.get(0);

            jdbcTemplate.update(
                    "UPDATE welfare_documents SET title = ?, content = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?",
                    data.title(),
                    data.content(),
                    documentId
            );
            jdbcTemplate.update("DELETE FROM welfare_document_chunks WHERE document_id = ?", documentId);

            return documentId;
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update((connection) -> {
            PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO welfare_documents(title, source, content) VALUES (?, ?, ?)",
                    new String[] { "id" }
            );

            statement.setString(1, data.title());
            statement.setString(2, data.source());
            statement.setString(3, data.content());

            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();

        if (key == null) {
            throw new IllegalStateException("문서 id 생성 실패");
        }

        return key.longValue();
    }

    private int saveChunks(Long documentId, String content) throws Exception {
        List<String> chunks = chunkText(content);
        int saved = 0;

        for (int index = 0; index < chunks.size(); index++) {
            String chunk = chunks.get(index);
            List<Double> embedding = createEmbedding(chunk);
            String vectorText = toVectorText(embedding);

            jdbcTemplate.update(
                    "INSERT INTO welfare_document_chunks(document_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?::vector)",
                    documentId,
                    index,
                    chunk,
                    vectorText
            );

            saved += 1;
        }

        return saved;
    }

    private List<String> chunkText(String text) {
        String normalized = text == null ? "" : text.replaceAll("\\s+", " ").trim();
        List<String> chunks = new ArrayList<>();

        if (normalized.isBlank()) {
            return chunks;
        }

        int start = 0;

        while (start < normalized.length()) {
            int end = Math.min(start + CHUNK_SIZE, normalized.length());
            chunks.add(normalized.substring(start, end));

            if (end >= normalized.length()) {
                break;
            }

            start = Math.max(0, end - CHUNK_OVERLAP);
        }

        return chunks;
    }

    private List<Double> createEmbedding(String text) throws Exception {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + embeddingModel
                + ":embedContent?key="
                + geminiApiKey;

        String body = objectMapper.writeValueAsString(Map.of(
                "content", Map.of(
                        "parts", List.of(Map.of("text", text))
                )
        ));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Gemini embedding failed: " + response.statusCode());
        }

        JsonNode values = objectMapper.readTree(response.body())
                .path("embedding")
                .path("values");

        return objectMapper.convertValue(
                values,
                objectMapper.getTypeFactory().constructCollectionType(List.class, Double.class)
        );
    }

    private String buildContent(WelfareListItem item, Document detailDocument) {
        List<String> lines = new ArrayList<>();

        addLine(lines, "서비스명", firstNotBlank(item.title(), text(detailDocument, "servNm"), text(detailDocument, "serviceName")));
        addLine(lines, "지역", joinRegion(item.region(), item.district()));
        addLine(lines, "생애주기", item.lifeCycle());
        addLine(lines, "대상자 특성", item.target());
        addLine(lines, "관심 주제", item.theme());
        addLine(lines, "제공 형태", item.provision());
        addLine(lines, "담당 부서", item.department());
        addLine(lines, "지원대상", firstNotBlank(text(detailDocument, "tgtrDtlCn"), text(detailDocument, "supportTarget"), text(detailDocument, "trgterIndvdl")));
        addLine(lines, "선정기준", firstNotBlank(text(detailDocument, "slctCritCn"), text(detailDocument, "selectionCriteria")));
        addLine(lines, "지원내용", firstNotBlank(text(detailDocument, "alwServCn"), text(detailDocument, "servDgst"), text(detailDocument, "supportContent"), item.summary()));
        addLine(lines, "신청방법", firstNotBlank(text(detailDocument, "aplyMtdCn"), text(detailDocument, "applicationMethod"), item.applyMethod()));
        addLine(lines, "문의처", firstNotBlank(text(detailDocument, "inqNum"), text(detailDocument, "contact")));
        addLine(lines, "상세링크", item.detailLink());

        return String.join("\n", lines);
    }

    private List<WelfareListItem> parseListItems(String xml) {
        Document document = parseXml(xml);
        List<Element> itemElements = elements(document, "servList");

        if (itemElements.isEmpty()) {
            itemElements = elements(document, "item");
        }

        if (itemElements.isEmpty()) {
            itemElements = elements(document, "data");
        }

        return itemElements.stream()
                .map((element) -> new WelfareListItem(
                        firstNotBlank(
                                text(element, "servId"),
                                text(element, "serviceId"),
                                text(element, "svcId"),
                                text(element, "bizId"),
                                text(element, "id")
                        ),
                        firstNotBlank(
                                text(element, "servNm"),
                                text(element, "serviceName"),
                                text(element, "svcNm"),
                                text(element, "title")
                        ),
                        firstNotBlank(
                                text(element, "ctpvNm"),
                                text(element, "region")
                        ),
                        firstNotBlank(
                                text(element, "sggNm")
                        ),
                        firstNotBlank(
                                text(element, "servDgst"),
                                text(element, "summary"),
                                text(element, "description")
                        ),
                        firstNotBlank(
                                text(element, "aplyMtdNm")
                        ),
                        firstNotBlank(
                                text(element, "bizChrDeptNm")
                        ),
                        firstNotBlank(
                                text(element, "lifeNmArray")
                        ),
                        firstNotBlank(
                                text(element, "trgterIndvdlNmArray")
                        ),
                        firstNotBlank(
                                text(element, "intrsThemaNmArray")
                        ),
                        firstNotBlank(
                                text(element, "srvPvsnNm")
                        ),
                        firstNotBlank(
                                text(element, "servDtlLink")
                        )
                ))
                .filter((item) -> !item.serviceId().isBlank() || !item.title().isBlank())
                .toList();
    }

    private String requestXml(String url) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("Public data API failed: " + response.statusCode());
            }

            return response.body();
        } catch (Exception error) {
            throw new IllegalStateException("공공데이터 API 호출 실패", error);
        }
    }

    private String joinRegion(String region, String district) {
        if (region == null || region.isBlank()) {
            return district == null ? "" : district;
        }

        if (district == null || district.isBlank()) {
            return region;
        }

        return region + " " + district;
    }

    private String buildListUrl(int pageNo, int numOfRows) {
        return welfareListUrl
                .replace("{serviceKey}", welfareServiceKey)
                .replace("{pageNo}", String.valueOf(pageNo))
                .replace("{numOfRows}", String.valueOf(numOfRows));
    }

    private String buildDetailUrl(String serviceId) {
        return welfareDetailUrl
                .replace("{serviceKey}", welfareServiceKey)
                .replace("{serviceId}", serviceId);
    }

    private Document parseXml(String xml) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);

            return factory.newDocumentBuilder()
                    .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("XML 파싱 실패", error);
        }
    }

    private List<Element> elements(Document document, String tagName) {
        if (document == null) {
            return List.of();
        }

        var nodes = document.getElementsByTagName(tagName);
        List<Element> elements = new ArrayList<>();

        for (int index = 0; index < nodes.getLength(); index++) {
            Node node = nodes.item(index);

            if (node instanceof Element element) {
                elements.add(element);
            }
        }

        return elements;
    }

    private String text(Document document, String tagName) {
        if (document == null) {
            return "";
        }

        var nodes = document.getElementsByTagName(tagName);

        if (nodes.getLength() == 0) {
            return "";
        }

        return nodes.item(0).getTextContent().trim();
    }

    private String text(Element element, String tagName) {
        var nodes = element.getElementsByTagName(tagName);

        if (nodes.getLength() == 0) {
            return "";
        }

        return nodes.item(0).getTextContent().trim();
    }

    private void addLine(List<String> lines, String label, String value) {
        if (value != null && !value.isBlank()) {
            lines.add(label + ": " + value.trim());
        }
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }

        return "";
    }

    private String toVectorText(List<Double> values) {
        return "[" + values.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + "," + right)
                .orElse("") + "]";
    }

    private record WelfareListItem(
            String serviceId,
            String title,
            String region,
            String district,
            String summary,
            String applyMethod,
            String department,
            String lifeCycle,
            String target,
            String theme,
            String provision,
            String detailLink
    ) {
    }

    private record WelfareDocumentData(
            String title,
            String source,
            String content
    ) {
    }

    public record SyncResult(
            int savedDocuments,
            int savedChunks
    ) {
    }
}