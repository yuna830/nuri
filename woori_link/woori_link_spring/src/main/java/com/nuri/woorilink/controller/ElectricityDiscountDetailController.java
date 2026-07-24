package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.ElectricityDiscountDetailDto;
import com.nuri.woorilink.dto.ElectricityDiscountDetailRequest;
import com.nuri.woorilink.service.ElectricityDiscountDetailService;
import com.nuri.woorilink.service.EnergySupportAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/energy-support/electricity")
@RequiredArgsConstructor
public class ElectricityDiscountDetailController {

    private final ElectricityDiscountDetailService service;
    private final EnergySupportAccessService accessService;

    @GetMapping("/{seniorId}")
    public ResponseEntity<ElectricityDiscountDetailDto> get(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateReadAccess(user, seniorId);
        return ResponseEntity.ok(service.getBySeniorId(seniorId));
    }

    @PutMapping("/{seniorId}")
    public ResponseEntity<ElectricityDiscountDetailDto> save(
            @PathVariable Long seniorId,
            @RequestBody ElectricityDiscountDetailRequest request,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateWriteAccess(user, seniorId);
        request.setUpdatedByRole(accessService.getUpdatedByRole(user));
        request.setUpdatedById(user.getUserId());
        return ResponseEntity.ok(service.saveOrUpdate(seniorId, request));
    }

    @DeleteMapping("/{seniorId}")
    public ResponseEntity<Void> delete(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateWelfareWorker(user);
        accessService.validateDetailAccess(user, seniorId);
        service.deleteBySeniorId(seniorId);
        return ResponseEntity.noContent().build();
    }
}
