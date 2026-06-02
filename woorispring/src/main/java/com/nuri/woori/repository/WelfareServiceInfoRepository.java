package com.nuri.woori.repository;

import com.nuri.woori.entity.WelfareServiceInfo;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface WelfareServiceInfoRepository extends JpaRepository<WelfareServiceInfo, Long> {
    Optional<WelfareServiceInfo> findByServiceId(String serviceId);
}