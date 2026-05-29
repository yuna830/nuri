package com.nuri.woori.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.RagDocument;
import com.nuri.woori.repository.RagDocumentRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class PublicWelfareRagEmbeddingSyncService {

    private static final String SOURCE_TYPE = "welfare_service";
    private static final String PENDING_STATUS = "PENDING_EMBEDDING";
    private static final String EMBEDDED_STATUS = "EMBEDDED";
    private static final String FAILED_STATUS = "EMBED_FAILED";
    private static final String EXCLUDED_STATUS = "EXCLUDED";

    private final RagDocumentRepository ragDocumentRepository;
    private final ObjectMapper objectMapper;

    @Value("${ai.backend.base-url:http://127.0.0.1:8001/api}")
    private String aiBackendBaseUrl;

    public PublicWelfareRagEmbeddingSyncService(
            RagDocumentRepository ragDocumentRepository
    ) {
        this.ragDocumentRepository = ragDocumentRepository;
        this.objectMapper = new ObjectMapper();
    }

    public List<RagDocument> embedPendingWelfareDocuments(int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 100));

        List<RagDocument> pendingDocuments = ragDocumentRepository
                .findByStatusAndSourceTypeOrderByUpdatedAtAsc(
                        PENDING_STATUS,
                        SOURCE_TYPE,
                        PageRequest.of(0, safeLimit)
                );

        List<RagDocument> processedDocuments = new ArrayList<>();

        for (RagDocument document : pendingDocuments) {
            try {
                validateDocumentForEmbedding(document);

                Map<String, Object> requestBody = new LinkedHashMap<>();
                requestBody.put("document_id", document.getDocumentId());
                requestBody.put("title", document.getTitle());
                requestBody.put("filename", document.getFilename());
                requestBody.put("source_type", document.getSourceType());
                requestBody.put("source_id", document.getSourceId());
                requestBody.put("source", document.getSource());
                requestBody.put("qdrant_collection", document.getQdrantCollection());
                requestBody.put("content", document.getContent());

                String requestUrl = aiBackendBaseUrl + "/rag-documents/embed-document";
                String jsonBody = objectMapper.writeValueAsString(requestBody);

                System.out.println("AI backend URL = " + requestUrl);
                System.out.println("JSON body length = " + jsonBody.length());
                System.out.println("JSON body preview = " + jsonBody.substring(0, Math.min(jsonBody.length(), 300)));

                Map<String, Object> response = postJson(requestUrl, jsonBody);

                String responseStatus = response.get("status") == null
                        ? ""
                        : String.valueOf(response.get("status"));

                if ("EMBEDDED".equals(responseStatus) || "SKIPPED_EXISTS".equals(responseStatus)) {
                    document.setStatus(EMBEDDED_STATUS);
                } else {
                    document.setStatus(FAILED_STATUS);
                }

                Object savedChunks = response.get("saved_chunks");
                Object existingChunks = response.get("existing_chunks");

                if (savedChunks instanceof Number number) {
                    document.setChunkCount(number.intValue());
                } else if (existingChunks instanceof Number number) {
                    document.setChunkCount(number.intValue());
                }

                document.setUpdatedAt(LocalDateTime.now());
                processedDocuments.add(ragDocumentRepository.save(document));

            } catch (Exception error) {
                document.setStatus(FAILED_STATUS);
                document.setUpdatedAt(LocalDateTime.now());
                processedDocuments.add(ragDocumentRepository.save(document));

                System.out.println(
                        "RAG 문서 Qdrant 임베딩 실패 documentId="
                                + document.getDocumentId()
                                + ", message="
                                + error.getMessage()
                );
            }
        }

        return processedDocuments;
    }

    public Map<String, Object> deleteExcludedWelfareDocumentsFromQdrant(
            int limit,
            int batchSize
    ) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        int safeBatchSize = Math.max(1, Math.min(batchSize, 100));

        List<RagDocument> excludedDocuments = ragDocumentRepository
                .findByStatusAndSourceTypeOrderByUpdatedAtAsc(
                        EXCLUDED_STATUS,
                        SOURCE_TYPE,
                        PageRequest.of(0, safeLimit)
                );

        List<String> documentIds = excludedDocuments
                .stream()
                .map(RagDocument::getDocumentId)
                .filter(documentId -> documentId != null && !documentId.isBlank())
                .distinct()
                .toList();

        if (documentIds.isEmpty()) {
            Map<String, Object> emptyResult = new LinkedHashMap<>();
            emptyResult.put("message", "Qdrant에서 삭제할 EXCLUDED 문서가 없습니다.");
            emptyResult.put("selected_document_count", 0);
            emptyResult.put("requested_document_count", 0);
            emptyResult.put("target_document_count", 0);
            emptyResult.put("deleted_chunk_count", 0);
            emptyResult.put("batch_count", 0);
            return emptyResult;
        }

        Map<String, Object> requestBody = new LinkedHashMap<>();
        requestBody.put("document_ids", documentIds);

        String requestUrl = aiBackendBaseUrl
                + "/rag-documents/delete-documents"
                + "?batch_size="
                + safeBatchSize;

        try {
            String jsonBody = objectMapper.writeValueAsString(requestBody);

            System.out.println("Qdrant excluded delete URL = " + requestUrl);
            System.out.println("Qdrant excluded delete document count = " + documentIds.size());
            System.out.println("Qdrant excluded delete body preview = " + jsonBody.substring(0, Math.min(jsonBody.length(), 300)));

            Map<String, Object> response = postJson(requestUrl, jsonBody);

            for (RagDocument document : excludedDocuments) {
                document.setStatus(EXCLUDED_STATUS);
                document.setUpdatedAt(LocalDateTime.now());
            }

            ragDocumentRepository.saveAll(excludedDocuments);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("message", "EXCLUDED 문서 Qdrant 삭제 요청 완료");
            result.put("selected_document_count", excludedDocuments.size());
            result.put("sent_document_count", documentIds.size());
            result.put("batch_size", safeBatchSize);
            result.put("qdrant_response", response);

            return result;
        } catch (Exception error) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("message", "EXCLUDED 문서 Qdrant 삭제 실패");
            result.put("selected_document_count", excludedDocuments.size());
            result.put("sent_document_count", documentIds.size());
            result.put("batch_size", safeBatchSize);
            result.put("error", error.getMessage());

            System.out.println(
                    "EXCLUDED 문서 Qdrant 삭제 실패, message="
                            + error.getMessage()
            );

            return result;
        }
    }

    public Map<String, Long> countWelfareEmbeddingStatus() {
        long total = ragDocumentRepository.countBySourceType(SOURCE_TYPE);
        long pending = ragDocumentRepository.countByStatusAndSourceType(PENDING_STATUS, SOURCE_TYPE);
        long embedded = ragDocumentRepository.countByStatusAndSourceType(EMBEDDED_STATUS, SOURCE_TYPE);
        long failed = ragDocumentRepository.countByStatusAndSourceType(FAILED_STATUS, SOURCE_TYPE);
        long excluded = ragDocumentRepository.countByStatusAndSourceType(EXCLUDED_STATUS, SOURCE_TYPE);

        Map<String, Long> result = new LinkedHashMap<>();
        result.put("total", total);
        result.put("pending", pending);
        result.put("embedded", embedded);
        result.put("failed", failed);
        result.put("excluded", excluded);

        return result;
    }

    private Map<String, Object> postJson(String requestUrl, String jsonBody) {
        HttpURLConnection connection = null;

        try {
            URI uri = URI.create(requestUrl);
            connection = (HttpURLConnection) uri.toURL().openConnection();

            byte[] bodyBytes = jsonBody.getBytes(StandardCharsets.UTF_8);

            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setConnectTimeout(30_000);
            connection.setReadTimeout(180_000);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            connection.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));

            try (OutputStream outputStream = connection.getOutputStream()) {
                outputStream.write(bodyBytes);
                outputStream.flush();
            }

            int statusCode = connection.getResponseCode();

            String responseBody;

            if (statusCode >= 200 && statusCode < 300) {
                try (InputStream inputStream = connection.getInputStream()) {
                    responseBody = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
                }
            } else {
                InputStream errorStream = connection.getErrorStream();

                if (errorStream == null) {
                    throw new RuntimeException("AI backend 응답 오류 status=" + statusCode + ", body 없음");
                }

                try (InputStream inputStream = errorStream) {
                    responseBody = new String(inputStream.readAllBytes(), StandardCharsets.UTF_8);
                }

                throw new RuntimeException("AI backend 응답 오류 status=" + statusCode + ", body=" + responseBody);
            }

            if (responseBody == null || responseBody.isBlank()) {
                return new LinkedHashMap<>();
            }

            return objectMapper.readValue(responseBody, new TypeReference<Map<String, Object>>() {});
        } catch (Exception error) {
            throw new RuntimeException("AI backend POST 실패: " + error.getMessage(), error);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    private void validateDocumentForEmbedding(RagDocument document) {
        if (document.getDocumentId() == null || document.getDocumentId().isBlank()) {
            throw new IllegalArgumentException("documentId가 비어 있습니다.");
        }

        if (document.getSourceType() == null || document.getSourceType().isBlank()) {
            throw new IllegalArgumentException("sourceType이 비어 있습니다. documentId=" + document.getDocumentId());
        }

        if (document.getContent() == null || document.getContent().isBlank()) {
            throw new IllegalArgumentException("content가 비어 있습니다. documentId=" + document.getDocumentId());
        }
    }
}