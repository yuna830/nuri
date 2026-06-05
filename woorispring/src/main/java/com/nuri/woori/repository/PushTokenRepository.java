package com.nuri.woori.repository;

import com.nuri.woori.entity.PushToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PushTokenRepository extends JpaRepository<PushToken, Long> {
    Optional<PushToken> findByToken(String token);
    List<PushToken> findByRoleAndUserId(String role, Long userId);
}