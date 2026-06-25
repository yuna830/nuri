package com.nuri.woorilink.domain.product.controller;

import com.nuri.woorilink.domain.product.entity.RegisteredProduct;
import com.nuri.woorilink.domain.product.service.ProductRecallService;
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
    public List<RegisteredProduct> getRecalled() { return productRecallService.getRecalled(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RegisteredProduct register(@RequestBody RegisteredProduct product) {
        return productRecallService.register(product);
    }

    @PostMapping("/refresh")
    public void refreshAll() { productRecallService.refreshAll(); }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { productRecallService.delete(id); }
}
