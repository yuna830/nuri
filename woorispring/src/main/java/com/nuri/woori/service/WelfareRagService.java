package com.nuri.woori.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.controller.WelfareRagController;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class WelfareRagService {

    private final ObjectMapper objectMapper;
    private List<WelfareDocument> documents = List.of();

    public WelfareRagService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadDocuments() {
        try {
            ClassPathResource resource = new ClassPathResource("welfare-documents.json");

            try (InputStream inputStream = resource.getInputStream()) {
                documents = objectMapper.readValue(
                        inputStream,
                        new TypeReference<List<WelfareDocument>>() {
                        }
                );
            }
        } catch (Exception error) {
            documents = List.of();
        }
    }

    public WelfareRagController.WelfareRagResponse ask(WelfareRagController.WelfareRagRequest request) {
        String question = request.question() == null ? "" : request.question();
        Map<String, Object> senior = request.senior() == null ? Map.of() : request.senior();

        Integer age = toInteger(senior.get("age"));
        String name = toText(senior.get("name"), "대상자");

        List<WelfareDocument> matchedDocuments = documents.stream()
                .map(document -> document.withScore(score(document, question, age)))
                .filter(document -> document.score() > 0)
                .sorted(Comparator.comparingInt(WelfareDocument::score).reversed())
                .limit(3)
                .toList();

        if (matchedDocuments.isEmpty()) {
            return new WelfareRagController.WelfareRagResponse(
                    "현재 질문과 대상자 정보만으로는 관련 복지 제도를 찾지 못했습니다. 기초연금, 노인일자리, 장기요양처럼 제도명을 포함해 다시 질문해주세요.",
                    List.of()
            );
        }

        String programNames = matchedDocuments.stream()
                .map(WelfareDocument::title)
                .distinct()
                .reduce((left, right) -> left + ", " + right)
                .orElse("복지 제도");

        StringBuilder answer = new StringBuilder();

        answer.append(name).append("님");

        if (age != null) {
            answer.append("은 만 ").append(age).append("세로 확인됩니다.\n");
        } else {
            answer.append("의 대상자 정보를 기준으로 확인했습니다.\n");
        }

        answer.append("우선 검토할 수 있는 제도는 ")
                .append(programNames)
                .append("입니다.");

        List<WelfareRagController.Evidence> evidence = matchedDocuments.stream()
                .map(document -> new WelfareRagController.Evidence(
                        document.title(),
                        document.content()
                ))
                .toList();

        return new WelfareRagController.WelfareRagResponse(
                answer.toString(),
                evidence
        );
    }

    private int score(WelfareDocument document, String question, Integer age) {
        int score = 0;

        for (String keyword : document.keywords()) {
            if (question.contains(keyword)) {
                score += 3;
            }
        }

        if (age != null && age >= 65 && document.content().contains("65세")) {
            score += 2;
        }

        if (age != null && age >= 60 && document.content().contains("60세")) {
            score += 1;
        }

        return score;
    }

    private Integer toInteger(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException error) {
            return null;
        }
    }

    private String toText(Object value, String fallback) {
        if (value == null || String.valueOf(value).isBlank()) {
            return fallback;
        }

        return String.valueOf(value);
    }

    private record WelfareDocument(
            String title,
            String content,
            List<String> keywords,
            int score
    ) {
        WelfareDocument(String title, String content, List<String> keywords) {
            this(title, content, keywords, 0);
        }

        WelfareDocument withScore(int nextScore) {
            return new WelfareDocument(title, content, keywords, nextScore);
        }
    }
}
