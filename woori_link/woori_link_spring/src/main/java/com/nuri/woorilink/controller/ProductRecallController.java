package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.ProductRecallResponse;
import com.nuri.woorilink.dto.RecallWorkflowUpdateRequest;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.service.FcmPushService;
import com.nuri.woorilink.service.ProductRecallService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductRecallController {

    private final ProductRecallService productRecallService;
    private final FcmPushService fcmPushService;

    private boolean isGuardian(AuthenticatedUser user) {
        if (user == null || user.getRole() == null) {
            return false;
        }

        String role = user.getRole()
                .replaceFirst("^ROLE_", "")
                .trim();

        return "GUARDIAN".equalsIgnoreCase(role);
    }

    private boolean isSenior(AuthenticatedUser user) {
        if (user == null || user.getRole() == null) {
            return false;
        }

        String role = user.getRole()
                .replaceFirst("^ROLE_", "")
                .trim();

        return "SENIOR".equalsIgnoreCase(role);
    }

    @PostMapping("/{id}/notifications")
    public FcmPushService.SendResult sendNotification(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @RequestBody NotificationRequest request
    ) {
        log.info(
                "[리콜 알림 요청] productId={}, user={}, userId={}, role={}",
                id,
                user,
                user != null ? user.getUserId() : null,
                user != null ? user.getRole() : null
        );

        if (user == null) {
            log.warn(
                    "[리콜 알림 거부] 인증된 사용자 정보가 없습니다. productId={}",
                    id
            );

            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "로그인이 필요합니다."
            );
        }

        if (!isGuardian(user)) {
            log.warn(
                    "[리콜 알림 거부] 보호자 권한이 아닙니다. userId={}, role={}",
                    user.getUserId(),
                    user.getRole()
            );

            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "보호자 계정으로 다시 로그인해 주세요."
            );
        }

        if (
                request == null
                        || request.message() == null
                        || request.message().isBlank()
        ) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "안내 내용을 입력해 주세요."
            );
        }

        RegisteredProduct product;

        try {
            product = productRecallService.getForGuardian(
                    id,
                    user.getUserId()
            );
        } catch (ResponseStatusException exception) {
            log.warn(
                    "[리콜 알림 권한 확인 실패] productId={}, loginUserId={}, status={}, reason={}",
                    id,
                    user.getUserId(),
                    exception.getStatusCode(),
                    exception.getReason()
            );

            throw exception;
        } catch (RuntimeException exception) {
            log.error(
                    "[리콜 알림 제품 조회 실패] productId={}, loginUserId={}",
                    id,
                    user.getUserId(),
                    exception
            );

            throw exception;
        }

        log.info(
                "[리콜 알림 권한 확인 성공] productId={}, seniorId={}, loginUserId={}",
                product.getId(),
                product.getSeniorId(),
                user.getUserId()
        );

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
        } catch (java.util.NoSuchElementException exception) {
            log.warn(
                    "[리콜 알림 발송 실패] 어르신 기기 토큰 없음. seniorId={}, message={}",
                    product.getSeniorId(),
                    exception.getMessage()
            );

            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    exception.getMessage()
            );
        } catch (IllegalStateException exception) {
            log.error(
                    "[리콜 알림 발송 실패] FCM 상태 오류. seniorId={}",
                    product.getSeniorId(),
                    exception
            );

            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    exception.getMessage()
            );
        }
    }

    public record NotificationRequest(
            String message
    ) {
    }

    @GetMapping("/senior/{seniorId}")
    public List<ProductRecallResponse> getBySenior(
            @PathVariable Long seniorId
    ) {
        return productRecallService.getBySenior(
                seniorId
        );
    }

    @GetMapping("/recalled")
    public List<ProductRecallResponse> getRecalled() {
        return productRecallService.getRecalled();
    }

    @GetMapping("/recalled/welfare-worker/{welfareWorkerId}")
    public List<ProductRecallResponse> getRecalledByWelfareWorker(
            @PathVariable Long welfareWorkerId
    ) {
        return productRecallService.getRecalledByWelfareWorker(
                welfareWorkerId
        );
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductRecallResponse register(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody RegisteredProduct product
    ) {
        if (user == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "로그인이 필요합니다."
            );
        }

        if (isSenior(user)) {
            product.setSeniorId(
                    user.getUserId()
            );
        } else if (isGuardian(user)) {
            productRecallService.validateGuardianAccess(
                    user.getUserId(),
                    product.getSeniorId()
            );
        } else {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "제품을 등록할 수 있는 계정이 아닙니다."
            );
        }

        RegisteredProduct saved =
                productRecallService.register(
                        product
                );

        return productRecallService.getResponse(
                saved.getId()
        );
    }

    @PostMapping("/refresh")
    public void refreshAll() {
        productRecallService.refreshAll();
    }

    @PostMapping("/{productId}/recall-check")
    public ProductRecallResponse checkRecall(
            @PathVariable Long productId
    ) {
        productRecallService.checkRecall(
                productId
        );

        return productRecallService.getResponse(
                productId
        );
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
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "보호자 계정으로 로그인해 주세요."
            );
        }

        return productRecallService.updateCurrentUseStatus(
                id,
                status,
                user.getUserId()
        );
    }

    @PatchMapping("/{id}/workflow")
    public RegisteredProduct updateWorkflow(
            @PathVariable Long id,
            @RequestBody RecallWorkflowUpdateRequest request
    ) {
        return productRecallService.updateWorkflow(
                id,
                request
        );
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id
    ) {
        productRecallService.delete(
                id
        );
    }
}