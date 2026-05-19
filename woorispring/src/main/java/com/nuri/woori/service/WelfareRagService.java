package com.nuri.woori.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.controller.WelfareRagController;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;

@Service
public class WelfareRagService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Value("${gemini.api-key}")
    private String geminiApiKey;

    @Value("${gemini.generate-model}")
    private String generateModel;

    @Value("${gemini.embedding-model}")
    private String embeddingModel;

    public WelfareRagService(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    public WelfareRagController.WelfareRagResponse ask(WelfareRagController.WelfareRagRequest request) {
        String question = request.question() == null ? "" : request.question().trim();

        if (question.isBlank()) {
            return new WelfareRagController.WelfareRagResponse(
                    "질문을 입력해주세요.",
                    List.of()
            );
        }

        Map<String, Object> senior = request.senior() == null ? Map.of() : request.senior();
        String searchText = buildSearchText(question, senior);

        try {
            List<Double> queryEmbedding = createEmbedding(searchText);
            List<RagChunk> searchedChunks = searchSimilarChunks(queryEmbedding, 10);
            List<RagChunk> chunks = filterChunksBySenior(searchedChunks, senior)
                    .stream()
                    .limit(5)
                    .toList();

            if (chunks.isEmpty()) {
                chunks = searchedChunks.stream()
                        .limit(5)
                        .toList();
            }

            if (chunks.isEmpty()) {
                return new WelfareRagController.WelfareRagResponse(
                        "관련 복지 제도 문서를 찾지 못했습니다. 질문을 조금 더 구체적으로 입력해주세요.",
                        List.of()
                );
            }

            String answer = createAnswer(question, senior, chunks);

            List<WelfareRagController.Evidence> evidence = chunks.stream()
                    .map(chunk -> new WelfareRagController.Evidence(
                            chunk.title(),
                            summarizeEvidence(chunk.content())
                    ))
                    .toList();

            return new WelfareRagController.WelfareRagResponse(answer, evidence);
        } catch (Exception error) {
            error.printStackTrace();

            String message = error.getMessage() != null && error.getMessage().contains("429")
                    ? "Gemini API 사용량 제한에 걸렸습니다. 잠시 후 다시 시도해주세요."
                    : "제도 Q&A 답변을 생성하지 못했습니다. 원인: " + error.getMessage();

            return new WelfareRagController.WelfareRagResponse(
                    message,
                    List.of()
            );
        }
    }

    private String buildSearchText(String question, Map<String, Object> senior) {
        Integer age = toInteger(senior.get("age"));

        return """
            질문: %s
            대상자 나이: %s
            대상자 생애주기: %s
            대상자 지역: %s
            건강 상태: %s
            일자리 신청 상태: %s
            """.formatted(
                question,
                value(senior, "age"),
                ageToLifeCycle(age),
                firstValue(senior, "region", "address"),
                firstValue(senior, "healthStatus", "diseaseInfo", "walkingStatus"),
                firstValue(senior, "jobRequestStatus", "workRequestStatus")
        );
    }

    private String summarizeEvidence(String content) {
        if (content == null || content.isBlank()) {
            return "";
        }

        String normalized = content.replaceAll("\\s+", " ").trim();

        if (normalized.length() <= 120) {
            return normalized;
        }

        return normalized.substring(0, 120) + "...";
    }

    private String ageToLifeCycle(Integer age) {
        if (age == null) {
            return "미확인";
        }

        if (age >= 65) {
            return "노년";
        }

        if (age < 19) {
            return "아동";
        }

        if (age < 40) {
            return "청년";
        }

        return "중장년";
    }

    private List<RagChunk> searchSimilarChunks(List<Double> embedding, int limit) {
        String vectorText = toVectorText(embedding);

        String sql = """
                SELECT
                    d.title,
                    d.source,
                    c.content,
                    c.embedding <=> ?::vector AS distance
                FROM welfare_document_chunks c
                JOIN welfare_documents d ON d.id = c.document_id
                ORDER BY c.embedding <=> ?::vector
                LIMIT ?
                """;

        return jdbcTemplate.query(
                sql,
                (rs, rowNum) -> new RagChunk(
                        rs.getString("title"),
                        rs.getString("source"),
                        rs.getString("content"),
                        rs.getDouble("distance")
                ),
                vectorText,
                vectorText,
                limit
        );
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

    private String createAnswer(String question, Map<String, Object> senior, List<RagChunk> chunks) throws Exception {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + generateModel
                + ":generateContent?key="
                + geminiApiKey;

        String prompt = buildAnswerPrompt(question, senior, chunks);

        String body = objectMapper.writeValueAsString(Map.of(
                "system_instruction", Map.of(
                        "parts", List.of(Map.of("text", """
                                당신은 복지사가 대상자에게 맞는 복지 제도를 검토하도록 돕는 제도 Q&A 도우미입니다.
                                반드시 제공된 근거 문서 안에서만 답변하세요.
                                확정 표현 대신 검토 가능, 확인 필요 같은 표현을 사용하세요.
                                답변에는 "답변", "근거", "다음 확인" 같은 제목을 반복해서 쓰지 마세요.
                                답변은 3문장 이내로 작성하세요.
                                근거 목록은 answer에 쓰지 마세요. 근거는 evidence 필드로 따로 제공됩니다.
                                마크다운 기호(**, ###, ``` 등)를 사용하지 마세요.
                                """))
                ),
                "contents", List.of(Map.of(
                        "role", "user",
                        "parts", List.of(Map.of("text", prompt))
                )),
                "generationConfig", Map.of(
                        "temperature", 0.2,
                        "maxOutputTokens", 700
                )
        ));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Gemini answer failed: " + response.statusCode());
        }

        JsonNode parts = objectMapper.readTree(response.body())
                .path("candidates")
                .path(0)
                .path("content")
                .path("parts");

        StringBuilder answer = new StringBuilder();

        for (JsonNode part : parts) {
            answer.append(part.path("text").asText(""));
        }

        return answer.toString().trim();
    }

    private String buildAnswerPrompt(String question, Map<String, Object> senior, List<RagChunk> chunks) {
        String evidenceText = chunks.stream()
                .map(chunk -> """
                        [%s]
                        출처: %s
                        내용: %s
                        """.formatted(chunk.title(), chunk.source(), chunk.content()))
                .reduce((left, right) -> left + "\n" + right)
                .orElse("");

        return """
                질문:
                %s

                대상자 정보:
                - 이름: %s
                - 나이: %s
                - 지역/주소: %s
                - 건강 상태: %s
                - 일자리/복지 상태: %s

                검색된 복지 제도 근거:
                %s
                """.formatted(
                question,
                value(senior, "name"),
                value(senior, "age"),
                firstValue(senior, "region", "address"),
                firstValue(senior, "healthStatus", "diseaseInfo", "walkingStatus"),
                firstValue(senior, "jobRequestStatus", "workRequestStatus", "welfareDecision"),
                evidenceText
        );
    }

    private String toVectorText(List<Double> values) {
        return "[" + values.stream()
                .map(String::valueOf)
                .reduce((left, right) -> left + "," + right)
                .orElse("") + "]";
    }

    private String value(Map<String, Object> source, String key) {
        Object value = source.get(key);
        return value == null ? "미확인" : String.valueOf(value);
    }

    private List<RagChunk> filterChunksBySenior(List<RagChunk> chunks, Map<String, Object> senior) {
        Integer age = toInteger(senior.get("age"));
        String region = firstValue(senior, "region", "address");

        return chunks.stream()
                .filter(chunk -> isAgeMatched(chunk, age))
                .filter(chunk -> isRegionMatched(chunk, region))
                .toList();
    }

    private boolean isAgeMatched(RagChunk chunk, Integer age) {
        if (age == null) {
            return true;
        }

        String content = chunk.content();

        if (age >= 60) {
            return !containsAny(
                    content,
                    "생애주기: 아동",
                    "생애주기: 청년",
                    "대상자 특성: 다자녀",
                    "신혼부부"
            );
        }

        if (age < 19) {
            return !containsAny(
                    content,
                    "생애주기: 노년",
                    "75세 이상",
                    "65세 이상",
                    "어르신"
            );
        }

        return !containsAny(
                content,
                "생애주기: 아동",
                "생애주기: 노년"
        );
    }

    private boolean isRegionMatched(RagChunk chunk, String region) {
        if (region == null || region.isBlank() || "미확인".equals(region)) {
            return true;
        }

        String content = chunk.content();
        String normalizedRegion = region.replaceAll("\\s+", "");

        String sido = extractSido(normalizedRegion);
        String sigungu = extractSigungu(normalizedRegion);

        boolean hasRegionInfo = content.contains("지역:");

        if (!hasRegionInfo) {
            return true;
        }

        if (!sido.isBlank() && content.contains(sido)) {
            return true;
        }

        if (!sigungu.isBlank() && content.contains(sigungu)) {
            return true;
        }

        return false;
    }

    private String extractSido(String region) {
        String[] sidoNames = {
                "서울", "부산", "대구", "인천", "광주", "대전", "울산", "세종",
                "경기", "강원", "충북", "충청북도", "충남", "충청남도",
                "전북", "전라북도", "전남", "전라남도",
                "경북", "경상북도", "경남", "경상남도", "제주"
        };

        for (String sido : sidoNames) {
            if (region.contains(sido)) {
                return sido;
            }
        }

        return "";
    }

    private String extractSigungu(String region) {
        String[] parts = region.split("[시군구]");

        if (parts.length == 0) {
            return "";
        }

        String last = parts[parts.length - 1];

        if (last.isBlank()) {
            return "";
        }

        return last;
    }

    private boolean containsAny(String text, String... keywords) {
        if (text == null) {
            return false;
        }

        for (String keyword : keywords) {
            if (text.contains(keyword)) {
                return true;
            }
        }

        return false;
    }

    private Integer toInteger(Object value) {
        if (value == null) {
            return null;
        }

        String numberText = String.valueOf(value).replaceAll("[^0-9]", "");

        if (numberText.isBlank()) {
            return null;
        }

        try {
            return Integer.parseInt(numberText);
        } catch (NumberFormatException error) {
            return null;
        }
    }

    private String firstValue(Map<String, Object> source, String... keys) {
        for (String key : keys) {
            Object value = source.get(key);

            if (value != null && !String.valueOf(value).isBlank()) {
                return String.valueOf(value);
            }
        }

        return "미확인";
    }

    private record RagChunk(
            String title,
            String source,
            String content,
            double distance
    ) {
    }
}