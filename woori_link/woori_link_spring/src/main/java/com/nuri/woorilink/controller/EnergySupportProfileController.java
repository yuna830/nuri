package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.EnergySupportProfileDto;
import com.nuri.woorilink.dto.EnergySupportProfileRequest;
import com.nuri.woorilink.service.EnergySupportAccessService;
import com.nuri.woorilink.service.EnergySupportProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/energy-support/profile")
@RequiredArgsConstructor
public class EnergySupportProfileController {

    private final EnergySupportProfileService profileService;
    private final EnergySupportAccessService accessService;

    @GetMapping("/{seniorId}")
    public ResponseEntity<EnergySupportProfileDto> get(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateReadAccess(user, seniorId);
        return ResponseEntity.ok(profileService.getBySeniorId(seniorId));
    }

    @PutMapping("/{seniorId}")
    public ResponseEntity<EnergySupportProfileDto> save(
            @PathVariable Long seniorId,
            @RequestBody EnergySupportProfileRequest request,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateWriteAccess(user, seniorId);
        request.setUpdatedByRole(accessService.getUpdatedByRole(user));
        request.setUpdatedById(user.getUserId());
        return ResponseEntity.ok(
                profileService.saveOrUpdate(seniorId, request));
    }
}
