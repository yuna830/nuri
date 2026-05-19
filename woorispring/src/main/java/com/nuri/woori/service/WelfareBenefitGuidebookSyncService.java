package com.nuri.woori.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.WelfareBenefitDocument;
import com.nuri.woori.repository.WelfareBenefitDocumentRepository;
import lombok.RequiredArgsConstructor;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class WelfareBenefitGuidebookSyncService {
    private static final String SOURCE_TYPE = "GUIDEBOOK";
    private static final String SOURCE_NAME = "2025 나에게 힘이 되는 복지서비스";
    private static final String SOURCE_URL = "사회보장위원회 복지서비스 가이드북";
    private static final int CHUNK_SIZE = 900;

    private final WelfareBenefitDocumentRepository repository;
    private final GeminiEmbeddingService geminiEmbeddingService;
    private final ObjectMapper objectMapper;

    @Transactional
    public int sync(String filePath, Integer startPage, Integer endPage) {
        File file = new File(filePath);

        if (!file.exists()) {
            throw new IllegalArgumentException("PDF 파일을 찾을 수 없습니다: " + filePath);
        }

        int savedCount = 0;

        try (var document = Loader.loadPDF(file)) {
            PDFTextStripper stripper = new PDFTextStripper();
            int pageCount = document.getNumberOfPages();

            int totalPages = document.getNumberOfPages();
            int fromPage = startPage == null ? 1 : Math.max(1, startPage);
            int toPage = endPage == null ? totalPages : Math.min(totalPages, endPage);

            for (int page = fromPage; page <= toPage; page++) {
                stripper.setStartPage(page);
                stripper.setEndPage(page);

                String pageText = cleanText(stripper.getText(document));

                if (pageText.length() < 80) {
                    continue;
                }

                List<String> chunks = splitText(pageText, CHUNK_SIZE);

                for (int index = 0; index < chunks.size(); index++) {
                    String chunk = chunks.get(index);
                    String externalId = "guidebook-2025-page-" + page + "-chunk-" + index;

                    WelfareBenefitDocument entity = repository.findByExternalId(externalId)
                            .orElseGet(WelfareBenefitDocument::new);

                    entity.setExternalId(externalId);
                    entity.setSourceType(SOURCE_TYPE);
                    entity.setSourceName(SOURCE_NAME);
                    entity.setSourceUrl(SOURCE_URL);
                    entity.setPageNo(page);
                    entity.setTitle(SOURCE_NAME + " " + page + "쪽");
                    entity.setOrganization("보건복지부");
                    entity.setContent(chunk);
                    entity.setSyncedAt(LocalDateTime.now());

                    boolean contentChanged = !chunk.equals(entity.getContent());

                    entity.setContent(chunk);

                    if (contentChanged || entity.getEmbeddingJson() == null || entity.getEmbeddingJson().isBlank()) {
                        List<Double> embedding = geminiEmbeddingService.embed(chunk);
                        entity.setEmbeddingJson(objectMapper.writeValueAsString(embedding));
                    }

                    repository.save(entity);
                    savedCount++;
                }
            }

            return savedCount;
        } catch (Exception exception) {
            throw new IllegalStateException("복지서비스 가이드북 동기화에 실패했습니다.", exception);
        }
    }

    private String cleanText(String text) {
        if (text == null) {
            return "";
        }

        return text
                .replaceAll("\\s+", " ")
                .trim();
    }

    private List<String> splitText(String text, int chunkSize) {
        List<String> chunks = new java.util.ArrayList<>();

        for (int start = 0; start < text.length(); start += chunkSize) {
            int end = Math.min(start + chunkSize, text.length());
            chunks.add(text.substring(start, end));
        }

        return chunks;
    }
}
