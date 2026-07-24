package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.EnergyVoucherDetailDto;
import com.nuri.woorilink.dto.EnergyVoucherDetailRequest;
import com.nuri.woorilink.service.EnergyVoucherDetailService;
import com.nuri.woorilink.service.EnergySupportAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/energy-support/voucher")
@RequiredArgsConstructor
public class EnergyVoucherDetailController {

    private final EnergyVoucherDetailService service;
    private final EnergySupportAccessService accessService;

    @GetMapping("/{seniorId}")
    public ResponseEntity<EnergyVoucherDetailDto> get(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateDetailAccess(user, seniorId);
        return ResponseEntity.ok(service.getBySeniorId(seniorId));
    }

    @PutMapping("/{seniorId}")
    public ResponseEntity<EnergyVoucherDetailDto> save(
            @PathVariable Long seniorId,
            @RequestBody EnergyVoucherDetailRequest request,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateDetailAccess(user, seniorId);
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
