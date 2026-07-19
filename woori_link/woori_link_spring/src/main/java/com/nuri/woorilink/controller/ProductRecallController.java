package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.ProductRecallResponse;
import com.nuri.woorilink.dto.RecallWorkflowUpdateRequest;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.service.ProductRecallService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductRecallController {

    private final ProductRecallService productRecallService;

    @GetMapping("/senior/{seniorId}")
    public List<ProductRecallResponse> getBySenior(@PathVariable Long seniorId) {
        return productRecallService.getBySenior(seniorId);
    }

    @GetMapping("/recalled")
    public List<ProductRecallResponse> getRecalled() { return productRecallService.getRecalled(); }

    @GetMapping("/recalled/welfare-worker/{welfareWorkerId}")
    public List<ProductRecallResponse> getRecalledByWelfareWorker(@PathVariable Long welfareWorkerId) {
        return productRecallService.getRecalledByWelfareWorker(welfareWorkerId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductRecallResponse register(@RequestBody RegisteredProduct product) {
        RegisteredProduct saved = productRecallService.register(product);
        return productRecallService.getResponse(saved.getId());
    }

    @PostMapping("/refresh")
    public void refreshAll() { productRecallService.refreshAll(); }

    @PostMapping("/{productId}/recall-check")
    public ProductRecallResponse checkRecall(@PathVariable Long productId) {
        productRecallService.checkRecall(productId);
        return productRecallService.getResponse(productId);
    }

    @PostMapping("/recall-check/refresh-all")
    public void refreshAllNewPath() { productRecallService.refreshAll(); }

    @PatchMapping("/{id}/current-use")
    public RegisteredProduct updateCurrentUseStatus(
            @PathVariable Long id,
            @RequestParam RegisteredProduct.CurrentUseStatus status
    ) {
        return productRecallService.updateCurrentUseStatus(id, status);
    }

    @PatchMapping("/{id}/workflow")
    public RegisteredProduct updateWorkflow(@PathVariable Long id,
                                            @RequestBody RecallWorkflowUpdateRequest request) {
        return productRecallService.updateWorkflow(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { productRecallService.delete(id); }
}
