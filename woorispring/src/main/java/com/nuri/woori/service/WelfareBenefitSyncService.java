package com.nuri.woori.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nuri.woori.entity.WelfareBenefitDocument;
import com.nuri.woori.repository.WelfareBenefitDocumentRepository;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class WelfareBenefitSyncService {
    private final DataGoKrWelfareClient dataGoKrWelfareClient;
    private final WelfareBenefitDocumentRepository repository;
    private final GeminiEmbeddingService geminiEmbeddingService;
    private final ObjectMapper objectMapper;

    @Transactional
    public int sync() {
        List<DataGoKrWelfareClient.WelfareBenefitDoc> docs =
                dataGoKrWelfareClient.fetchBenefitDocs(1, 100);

        int savedCount = 0;

        for (DataGoKrWelfareClient.WelfareBenefitDoc doc : docs) {
            if (doc.externalId() == null || doc.externalId().isBlank() || doc.content() == null || doc.content().isBlank()) {
                continue;
            }

            WelfareBenefitDocument entity = repository.findByExternalId(doc.externalId())
                    .orElseGet(WelfareBenefitDocument::new);

            boolean contentChanged = !Objects.equals(entity.getContent(), doc.content());

            entity.setExternalId(doc.externalId());
            entity.setSourceType("PUBLIC_API");
            entity.setSourceName("공공데이터포털 지자체복지서비스");
            entity.setSourceUrl("https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations");
            entity.setPageNo(null);
            entity.setTitle(doc.title());
            entity.setOrganization(doc.organization());
            entity.setContent(doc.content());
            entity.setSyncedAt(LocalDateTime.now());

            if (contentChanged || entity.getEmbeddingJson() == null || entity.getEmbeddingJson().isBlank()) {
                try {
                    List<Double> embedding = geminiEmbeddingService.embed(doc.content());
                    entity.setEmbeddingJson(objectMapper.writeValueAsString(embedding));
                } catch (Exception exception) {
                    continue;
                }
            }

            repository.save(entity);
            savedCount++;
        }

        return savedCount;
    }
}
