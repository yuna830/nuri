package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.EnergySupportCaseDto;
import com.nuri.woorilink.dto.EnergySupportCaseUpdateRequest;
import com.nuri.woorilink.entity.EnergySupportCase;
import com.nuri.woorilink.service.EnergySupportCaseService;
import com.nuri.woorilink.service.EnergySupportAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/energy-support")
@RequiredArgsConstructor
public class EnergySupportCaseController {

    private final EnergySupportCaseService energySupportCaseService;
    private final EnergySupportAccessService accessService;

    @GetMapping("/candidates")
    public List<EnergySupportCaseDto> getCandidates(
            @RequestParam Long welfareWorkerId,
            @RequestParam EnergySupportCase.SupportType type,
            @RequestParam(defaultValue = "ACTIVE")
            EnergySupportCaseService.CandidateScope scope,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateWelfareWorker(user);
        if (!user.getUserId().equals(welfareWorkerId)) {
            throw new AccessDeniedException(
                    "다른 복지사의 대상자 목록을 조회할 수 없습니다."
            );
        }
        return energySupportCaseService.getCandidates(
                welfareWorkerId,
                type,
                scope
        );
    }

    @PutMapping("/{seniorId}/{type}")
    public EnergySupportCaseDto update(
            @PathVariable Long seniorId,
            @PathVariable EnergySupportCase.SupportType type,
            @RequestBody EnergySupportCaseUpdateRequest request,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateWelfareWorker(user);
        accessService.validateDetailAccess(user, seniorId);
        return energySupportCaseService.update(
                seniorId,
                type,
                request,
                user.getRole(),
                user.getUserId()
        );
    }
}
