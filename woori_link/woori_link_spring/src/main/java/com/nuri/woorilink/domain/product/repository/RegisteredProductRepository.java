package com.nuri.woorilink.domain.product.repository;

import com.nuri.woorilink.domain.product.entity.RegisteredProduct;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RegisteredProductRepository extends JpaRepository<RegisteredProduct, Long> {
    List<RegisteredProduct> findBySeniorId(Long seniorId);
    List<RegisteredProduct> findByRecallStatus(RegisteredProduct.RecallStatus recallStatus);
}
