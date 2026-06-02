package com.nuri.woori.repository;

import com.nuri.woori.entity.Admin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminRepository extends JpaRepository<Admin, Long> {
    Optional<Admin> findByEmailIgnoreCase(String email);
    Optional<Admin> findByLoginIdIgnoreCase(String loginId);
    long countByStatus(String status);
}
