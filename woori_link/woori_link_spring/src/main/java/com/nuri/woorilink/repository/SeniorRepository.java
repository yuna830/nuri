package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.Senior;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface SeniorRepository extends JpaRepository<Senior, Long> {
    Optional<Senior> findFirstByPhone(String phone);
    Optional<Senior> findFirstByPhoneAndName(String phone, String name);
    boolean existsByPhone(String phone);
    List<Senior> findByGuardianId(Long guardianId);
    List<Senior> findByWelfareWorkerId(Long welfareWorkerId);

    @Query("""
    select s
    from Senior s
    where s.energyVoucherEligible = true
      and s.energyVoucherApplied = false
""")
    List<Senior> findEnergyVoucherUnappliedTargets();
    List<Senior> findByNameContainingAndPhone(String name, String phone);
}
