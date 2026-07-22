package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.ProductRecallResponse;
import com.nuri.woorilink.dto.RecallWorkflowUpdateRequest;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.service.FcmPushService;
import com.nuri.woorilink.service.ProductRecallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductRecallController {

    private final ProductRecallService productRecallService;
    private final FcmPushService fcmPushService;

    private boolean isGuardian(AuthenticatedUser user) {
        if (user == null || user.getRole() == null) return false;
        return "GUARDIAN".equalsIgnoreCase(user.getRole().replaceFirst("^ROLE_", ""));
    }

    private boolean isSenior(AuthenticatedUser user) {
        if (user == null || user.getRole() == null) return false;
        return "SENIOR".equalsIgnoreCase(user.getRole().replaceFirst("^ROLE_", ""));
    }

    @PostMapping("/{id}/notifications")
    public FcmPushService.SendResult sendNotification(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @RequestBody NotificationRequest request
    ) {
        if (!isGuardian(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "보호자 계정으로 다시 로그인해 주세요.");
        }
        if (request == null || request.message() == null || request.message().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "안내 내용을 입력해 주세요.");
        }

        RegisteredProduct product = productRecallService.getForGuardian(id, user.getUserId());
        try {
            return fcmPushService.sendToSenior(
                    product.getSeniorId(),
                    "WOORI 리콜 안내",
                    request.message().trim(),
                    Map.of(
                            "type", "PRODUCT_RECALL",
                            "productId", String.valueOf(id),
                            "seniorId", String.valueOf(product.getSeniorId())
                    )
            );
        } catch (java.util.NoSuchElementException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, e.getMessage());
        } catch (IllegalStateException e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
        }
    }

    public record NotificationRequest(String message) { }

    @GetMapping("/senior/{seniorId}")
    public List<ProductRecallResponse> getBySenior(@PathVariable Long seniorId) {
        return productRecallService.getBySenior(seniorId);
    }

    @GetMapping("/recalled")
    public List<ProductRecallResponse> getRecalled() {
        return productRecallService.getRecalled();
    }

    @GetMapping("/recalled/welfare-worker/{welfareWorkerId}")
    public List<ProductRecallResponse> getRecalledByWelfareWorker(@PathVariable Long welfareWorkerId) {
        return productRecallService.getRecalledByWelfareWorker(welfareWorkerId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductRecallResponse register(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody RegisteredProduct product
    ) {
        if (user == null) {
            throw new IllegalArgumentException("로그인이 필요합니다.");
        }
        if (isSenior(user)) {
            product.setSeniorId(user.getUserId());
        } else if (isGuardian(user)) {
            productRecallService.validateGuardianAccess(user.getUserId(), product.getSeniorId());
        } else {
            throw new IllegalArgumentException("제품을 등록할 수 있는 계정이 아닙니다.");
        }
        RegisteredProduct saved = productRecallService.register(product);
        return productRecallService.getResponse(saved.getId());
    }

    @PostMapping("/refresh")
    public void refreshAll() {
        productRecallService.refreshAll();
    }

    @PostMapping("/{productId}/recall-check")
    public ProductRecallResponse checkRecall(@PathVariable Long productId) {
        productRecallService.checkRecall(productId);
        return productRecallService.getResponse(productId);
    }

    @PostMapping("/recall-check/refresh-all")
    public void refreshAllNewPath() {
        productRecallService.refreshAll();
    }

    @PatchMapping("/{id}/current-use")
    public RegisteredProduct updateCurrentUseStatus(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @RequestParam RegisteredProduct.CurrentUseStatus status
    ) {
        if (!isGuardian(user)) {
            throw new IllegalArgumentException("보호자 계정으로 로그인해 주세요.");
        }
        return productRecallService.updateCurrentUseStatus(id, status, user.getUserId());
    }

    @PatchMapping("/{id}/workflow")
    public RegisteredProduct updateWorkflow(
            @PathVariable Long id,
            @RequestBody RecallWorkflowUpdateRequest request
    ) {
        return productRecallService.updateWorkflow(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        productRecallService.delete(id);
    }
}
