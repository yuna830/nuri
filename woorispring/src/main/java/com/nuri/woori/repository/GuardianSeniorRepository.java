package com.nuri.woori.repository;

import com.nuri.woori.entity.GuardianSenior;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GuardianSeniorRepository extends JpaRepository<GuardianSenior, Long> {
    List<GuardianSenior> findByGuardianId(Long guardianId);
}
