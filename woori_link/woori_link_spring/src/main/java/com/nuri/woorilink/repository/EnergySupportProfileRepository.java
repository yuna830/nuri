package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.EnergySupportProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EnergySupportProfileRepository
        extends JpaRepository<EnergySupportProfile, Long> {

    Optional<EnergySupportProfile> findBySeniorId(Long seniorId);
}
