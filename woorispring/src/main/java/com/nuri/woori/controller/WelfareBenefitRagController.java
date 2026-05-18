package com.nuri.woori.controller;

import com.nuri.woori.service.WelfareBenefitRagService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/welfare/rag/benefits")
public class WelfareBenefitRagController {
    private final WelfareBenefitRagService welfareBenefitRagService;

    @PostMapping("/ask")
    public WelfareBenefitAskResponse ask(@RequestBody WelfareBenefitAskRequest request) {
        return welfareBenefitRagService.ask(request);
    }
}
