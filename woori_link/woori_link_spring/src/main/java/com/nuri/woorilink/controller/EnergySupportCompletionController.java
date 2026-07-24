package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.EnergySupportCompletionDto;
import com.nuri.woorilink.service.EnergySupportAccessService;
import com.nuri.woorilink.service.EnergySupportCompletionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/energy-support/completion")
@RequiredArgsConstructor
public class EnergySupportCompletionController {

    private final EnergySupportCompletionService completionService;
    private final EnergySupportAccessService accessService;

    @GetMapping("/{seniorId}")
    public ResponseEntity<EnergySupportCompletionDto> get(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateReadAccess(user, seniorId);
        return ResponseEntity.ok(
                completionService.getCompletion(seniorId)
        );
    }
}
