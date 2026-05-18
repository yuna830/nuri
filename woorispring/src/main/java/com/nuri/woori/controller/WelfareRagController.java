package com.nuri.woori.controller;

import com.nuri.woori.service.WelfareRagService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/welfare-rag")
@CrossOrigin(origins = "*")
public class WelfareRagController {

    private final WelfareRagService welfareRagService;

    public WelfareRagController(WelfareRagService welfareRagService) {
        this.welfareRagService = welfareRagService;
    }

    @PostMapping("/ask")
    public WelfareRagResponse ask(@RequestBody WelfareRagRequest request) {
        return welfareRagService.ask(request);
    }

    public record WelfareRagRequest(
            String question,
            Map<String, Object> senior
    ) {
    }

    public record WelfareRagResponse(
            String answer,
            List<Evidence> evidence
    ) {
    }

    public record Evidence(
            String title,
            String content
    ) {
    }
}
