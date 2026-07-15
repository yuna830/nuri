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
    public List<RegisteredProduct> getBySenior(@PathVariable Long seniorId) {
        return productRecallService.getBySenior(seniorId);
    }

    @GetMapping("/recalled")
    public List<ProductRecallResponse> getRecalled() { return productRecallService.getRecalled(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RegisteredProduct register(@RequestBody RegisteredProduct product) {
        return productRecallService.register(product);
    }

    @PostMapping("/refresh")
    public void refreshAll() { productRecallService.refreshAll(); }

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
