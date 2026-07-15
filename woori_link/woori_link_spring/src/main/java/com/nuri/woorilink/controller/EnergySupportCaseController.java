package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.EnergySupportCaseDto;
import com.nuri.woorilink.dto.EnergySupportCaseUpdateRequest;
import com.nuri.woorilink.entity.EnergySupportCase;
import com.nuri.woorilink.service.EnergySupportCaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/energy-support")
@RequiredArgsConstructor
public class EnergySupportCaseController {

    private final EnergySupportCaseService energySupportCaseService;

    @GetMapping("/candidates")
    public List<EnergySupportCaseDto> getCandidates(
            @RequestParam Long welfareWorkerId,
            @RequestParam EnergySupportCase.SupportType type
    ) {
        return energySupportCaseService.getCandidates(welfareWorkerId, type);
    }

    @PutMapping("/{seniorId}/{type}")
    public EnergySupportCaseDto update(
            @PathVariable Long seniorId,
            @PathVariable EnergySupportCase.SupportType type,
            @RequestBody EnergySupportCaseUpdateRequest request
    ) {
        return energySupportCaseService.update(seniorId, type, request);
    }
}
