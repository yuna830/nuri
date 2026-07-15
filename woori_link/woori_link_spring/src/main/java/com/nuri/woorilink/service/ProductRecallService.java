package com.nuri.woorilink.service;

import com.nuri.woorilink.common.client.RecallApiClient;
import com.nuri.woorilink.dto.ProductRecallResponse;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductRecallService {

    private final RegisteredProductRepository productRepository;
    private final SeniorRepository seniorRepository;
    private final RecallApiClient recallApiClient;

    public List<RegisteredProduct> getBySenior(Long seniorId) {
        return productRepository.findBySeniorId(seniorId);
    }

    public List<ProductRecallResponse> getRecalled() {
        return productRepository.findByRecallStatus(RegisteredProduct.RecallStatus.RECALLED)
                .stream()
                .map(this::toRecallResponse)
                .toList();
    }

    private ProductRecallResponse toRecallResponse(RegisteredProduct product) {
        Senior senior = product.getSeniorId() == null
                ? null
                : seniorRepository.findById(product.getSeniorId()).orElse(null);

        return new ProductRecallResponse(
                product.getId(),
                product.getSeniorId(),
                senior == null ? null : senior.getName(),
                senior == null ? null : senior.getAge(),
                product.getProductName(),
                product.getManufacturer(),
                product.getModelNumber(),
                product.getRecallStatus(),
                product.getCurrentUseStatus(),
                product.getRecallReason(),
                product.getLastCheckedAt(),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }

    @Transactional
    public RegisteredProduct register(RegisteredProduct product) {
        applyRecallStatus(product);
        return productRepository.save(product);
    }

    @Transactional
    public void refreshAll() {
        productRepository.findAll().forEach(p -> {
            applyRecallStatus(p);
            productRepository.save(p);
        });
    }

    @Transactional
    public void delete(Long id) { productRepository.deleteById(id); }

    @Transactional
    public RegisteredProduct updateCurrentUseStatus(
            Long id,
            RegisteredProduct.CurrentUseStatus status
    ) {
        RegisteredProduct product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("등록 제품을 찾을 수 없습니다: " + id));
        product.setCurrentUseStatus(status);
        return productRepository.save(product);
    }

    private void applyRecallStatus(RegisteredProduct product) {
        RecallLookup lookup = lookupRecall(product);
        product.setRecallStatus(lookup.recalled()
                ? RegisteredProduct.RecallStatus.RECALLED
                : RegisteredProduct.RecallStatus.SAFE);
        product.setRecallReason(lookup.recalled() ? lookup.detail() : null);
        product.setLastCheckedAt(LocalDateTime.now());
    }

    private RecallLookup lookupRecall(RegisteredProduct product) {
        for (String term : buildRecallSearchTerms(product)) {
            if (recallApiClient.isRecalled(term)) {
                String detail = recallApiClient.getRecallDetail(term);
                String reason = detail != null && !detail.isBlank()
                        ? detail
                        : "제품안전정보센터 리콜 목록에서 조회되었습니다. 검색어: " + term;
                return new RecallLookup(true, reason);
            }
        }
        return new RecallLookup(false, null);
    }

    private List<String> buildRecallSearchTerms(RegisteredProduct product) {
        Set<String> terms = new LinkedHashSet<>();
        addIfNotBlank(terms, product.getModelNumber());
        addIfNotBlank(terms, product.getProductName());

        List<String> filtered = new ArrayList<>();
        for (String term : terms) {
            String normalized = term.trim();
            if (normalized.length() >= 2) filtered.add(normalized);
        }
        return filtered;
    }

    private void addIfNotBlank(Set<String> terms, String value) {
        if (value == null) return;
        String normalized = value.trim();
        if (!normalized.isBlank()) terms.add(normalized);
    }

    private record RecallLookup(boolean recalled, String detail) {}
}
