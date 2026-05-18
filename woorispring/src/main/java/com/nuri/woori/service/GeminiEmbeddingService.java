package com.nuri.woori.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class GeminiEmbeddingService {
    private final RestClient restClient = RestClient.create();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${gemini.api.key}")
    private String apiKey;

    @Value("${gemini.embedding.model}")
    private String model;

    public List<Double> embed(String text) {
        String url = "https://generativelanguage.googleapis.com/v1beta/models/"
                + model
                + ":embedContent?key="
                + apiKey;

        Map<String, Object> body = Map.of(
                "content", Map.of(
                        "parts", List.of(Map.of("text", text))
                )
        );

        String response = restClient.post()
                .uri(url)
                .body(body)
                .retrieve()
                .body(String.class);

        try {
            JsonNode values = objectMapper.readTree(response)
                    .path("embedding")
                    .path("values");

            List<Double> vector = new ArrayList<>();
            values.forEach(value -> vector.add(value.asDouble()));
            return vector;
        } catch (Exception exception) {
            throw new IllegalStateException("Gemini embedding failed", exception);
        }
    }
}
