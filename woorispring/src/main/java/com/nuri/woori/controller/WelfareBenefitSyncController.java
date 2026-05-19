package com.nuri.woori.controller;

import com.nuri.woori.service.WelfareBenefitSyncService;
import com.nuri.woori.service.WelfareBenefitGuidebookSyncService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/welfare/rag/benefits")
public class WelfareBenefitSyncController {
    private final WelfareBenefitSyncService syncService;
    private final WelfareBenefitGuidebookSyncService guidebookSyncService;

    @PostMapping("/sync")
    public Map<String, Object> sync() {
        int count = syncService.sync();

        return Map.of(
                "syncedCount", count
        );
    }

    @PostMapping("/sync-guidebook")
    public Map<String, Object> syncGuidebook(@RequestBody GuidebookSyncRequest request) {
        int count = guidebookSyncService.sync(
                request.filePath(),
                request.startPage(),
                request.endPage()
        );

        return Map.of("syncedCount", count, "sourceType", "GUIDEBOOK");
    }

    public record GuidebookSyncRequest(
            String filePath,
            Integer startPage,
            Integer endPage
    ) {}
}