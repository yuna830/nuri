package com.nuri.woorilink.domain.guardian.repository;

import com.nuri.woorilink.domain.guardian.entity.Guardian;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GuardianRepository extends JpaRepository<Guardian, Long> {}
