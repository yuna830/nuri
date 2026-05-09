package com.nuri.woori.repository;

import com.nuri.woori.entity.GuardianSenior;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GuardianSeniorRepository extends JpaRepository<GuardianSenior, Long> {
    List<GuardianSenior> findByGuardianId(Long guardianId);

    List<GuardianSenior> findBySeniorId(Long seniorId);

    boolean existsByGuardianIdAndSeniorId(Long guardianId, Long seniorId);

    Optional<GuardianSenior> findByGuardianIdAndSeniorId(Long guardianId, Long seniorId);
}