package com.nuri.woori.controller;

import com.nuri.woori.service.WelfareDocumentIngestService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/welfare-documents")
@CrossOrigin(origins = "*")
public class WelfareDocumentController {

    private final WelfareDocumentIngestService welfareDocumentIngestService;

    public WelfareDocumentController(WelfareDocumentIngestService welfareDocumentIngestService) {
        this.welfareDocumentIngestService = welfareDocumentIngestService;
    }

    @PostMapping("/sync")
    public WelfareDocumentIngestService.SyncResult sync(
            @RequestParam(defaultValue = "1") int maxPages,
            @RequestParam(defaultValue = "20") int numOfRows
    ) {
        return welfareDocumentIngestService.sync(maxPages, numOfRows);
    }
}