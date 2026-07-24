package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.EnergyVoucherDetail;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EnergyVoucherDetailRepository
        extends JpaRepository<EnergyVoucherDetail, Long> {

    Optional<EnergyVoucherDetail> findBySeniorId(Long seniorId);

    void deleteBySeniorId(Long seniorId);
}
