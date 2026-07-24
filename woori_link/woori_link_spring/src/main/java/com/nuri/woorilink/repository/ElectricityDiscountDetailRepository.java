package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.ElectricityDiscountDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ElectricityDiscountDetailRepository
        extends JpaRepository<ElectricityDiscountDetail, Long> {

    Optional<ElectricityDiscountDetail> findBySeniorId(Long seniorId);

    void deleteBySeniorId(Long seniorId);
}
