package com.nuri.woori.controller;

import com.nuri.woori.entity.RagDocument;
import com.nuri.woori.service.PublicWelfareRagDocumentService;
import com.nuri.woori.service.PublicWelfareRagEmbeddingSyncService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/public-welfare/rag-documents")
@CrossOrigin(origins = "*")
public class PublicWelfareRagDocumentController {

    private final PublicWelfareRagDocumentService publicWelfareRagDocumentService;
    private final PublicWelfareRagEmbeddingSyncService publicWelfareRagEmbeddingSyncService;

    public PublicWelfareRagDocumentController(
            PublicWelfareRagDocumentService publicWelfareRagDocumentService,
            PublicWelfareRagEmbeddingSyncService publicWelfareRagEmbeddingSyncService
    ) {
        this.publicWelfareRagDocumentService = publicWelfareRagDocumentService;
        this.publicWelfareRagEmbeddingSyncService = publicWelfareRagEmbeddingSyncService;
    }

    @PostMapping("/sync")
    public List<RagDocument> syncWelfareServiceRagDocuments(
            @RequestParam(defaultValue = "100") int limit
    ) {
        return publicWelfareRagDocumentService.syncWelfareServiceRagDocuments(limit);
    }

    @PostMapping("/embed-pending")
    public List<RagDocument> embedPendingWelfareServiceRagDocuments(
            @RequestParam(defaultValue = "100") int limit
    ) {
        return publicWelfareRagEmbeddingSyncService.embedPendingWelfareDocuments(limit);
    }

    @PostMapping("/delete-excluded-from-qdrant")
    public Map<String, Object> deleteExcludedWelfareDocumentsFromQdrant(
            @RequestParam(defaultValue = "300") int limit,
            @RequestParam(defaultValue = "30") int batchSize
    ) {
        return publicWelfareRagEmbeddingSyncService.deleteExcludedWelfareDocumentsFromQdrant(
                limit,
                batchSize
        );
    }

    @GetMapping("/count")
    public Map<String, Long> countWelfareServiceRagDocuments() {
        long ragDocumentCount = publicWelfareRagDocumentService.countWelfareServiceRagDocuments();
        Map<String, Long> embeddingStatus = publicWelfareRagEmbeddingSyncService.countWelfareEmbeddingStatus();

        return Map.of(
                "welfareServiceRagDocumentCount", ragDocumentCount,
                "total", embeddingStatus.get("total"),
                "pending", embeddingStatus.get("pending"),
                "embedded", embeddingStatus.get("embedded"),
                "failed", embeddingStatus.get("failed"),
                "excluded", embeddingStatus.get("excluded")
        );
    }
}