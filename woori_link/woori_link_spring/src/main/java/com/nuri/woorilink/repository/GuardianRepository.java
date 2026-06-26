package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.Guardian;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GuardianRepository extends JpaRepository<Guardian, Long> {
    Optional<Guardian> findFirstByPhone(String phone);
    Optional<Guardian> findFirstByPhoneAndName(String phone, String name);
    boolean existsByPhone(String phone);
}