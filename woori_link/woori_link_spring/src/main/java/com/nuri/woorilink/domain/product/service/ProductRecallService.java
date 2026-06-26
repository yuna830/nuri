package com.nuri.woorilink.domain.product.service;

import com.nuri.woorilink.common.client.RecallApiClient;
import com.nuri.woorilink.domain.product.entity.RegisteredProduct;
import com.nuri.woorilink.domain.product.repository.RegisteredProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductRecallService {

    private final RegisteredProductRepository productRepository;
    private final RecallApiClient recallApiClient;

    public List<RegisteredProduct> getBySenior(Long seniorId) {
        return productRepository.findBySeniorId(seniorId);
    }

    public List<RegisteredProduct> getRecalled() {
        return productRepository.findByRecallStatus(RegisteredProduct.RecallStatus.RECALLED);
    }

    @Transactional
    public RegisteredProduct register(RegisteredProduct product) {
        boolean recalled = recallApiClient.isRecalled(product.getProductName());
        if (recalled) {
            product.setRecallStatus(RegisteredProduct.RecallStatus.RECALLED);
            product.setRecallReason(recallApiClient.getRecallDetail(product.getProductName()));
        } else {
            product.setRecallStatus(RegisteredProduct.RecallStatus.SAFE);
        }
        product.setLastCheckedAt(LocalDateTime.now());
        return productRepository.save(product);
    }

    @Transactional
    public void refreshAll() {
        productRepository.findAll().forEach(p -> {
            boolean recalled = recallApiClient.isRecalled(p.getProductName());
            p.setRecallStatus(recalled
                    ? RegisteredProduct.RecallStatus.RECALLED
                    : RegisteredProduct.RecallStatus.SAFE);
            if (recalled) p.setRecallReason(recallApiClient.getRecallDetail(p.getProductName()));
            p.setLastCheckedAt(LocalDateTime.now());
            productRepository.save(p);
        });
    }

    @Transactional
    public void delete(Long id) { productRepository.deleteById(id); }
}
