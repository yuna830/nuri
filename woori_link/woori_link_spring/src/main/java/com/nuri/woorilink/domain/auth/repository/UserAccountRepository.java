package com.nuri.woorilink.domain.auth.repository;

import com.nuri.woorilink.domain.auth.entity.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByPhone(String phone);
    Optional<UserAccount> findByLoginId(String loginId);
    boolean existsByPhone(String phone);
    boolean existsByLoginId(String loginId);
}
