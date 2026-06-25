package com.nuri.woorilink.domain.senior.repository;

import com.nuri.woorilink.domain.senior.entity.Senior;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SeniorRepository extends JpaRepository<Senior, Long> {
    List<Senior> findByGuardianId(Long guardianId);
    List<Senior> findByWelfareWorkerId(Long welfareWorkerId);
    List<Senior> findByEnergyVoucherAppliedFalseOrEnergyVoucherAppliedIsNull();
}
