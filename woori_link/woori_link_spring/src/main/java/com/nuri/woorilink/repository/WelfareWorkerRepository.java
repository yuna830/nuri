package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.WelfareWorker;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WelfareWorkerRepository extends JpaRepository<WelfareWorker, Long> {
    Optional<WelfareWorker> findFirstByLoginId(String loginId);
    boolean existsByLoginId(String loginId);
}
