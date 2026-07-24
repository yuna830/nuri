package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.GasDiscountDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GasDiscountDetailRepository
        extends JpaRepository<GasDiscountDetail, Long> {

    Optional<GasDiscountDetail> findBySeniorId(
            Long seniorId
    );

    boolean existsBySeniorId(
            Long seniorId
    );

    void deleteBySeniorId(
            Long seniorId
    );
}