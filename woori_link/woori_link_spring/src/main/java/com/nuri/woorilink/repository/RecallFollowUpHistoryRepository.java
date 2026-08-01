package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.RecallFollowUpHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecallFollowUpHistoryRepository
        extends JpaRepository<RecallFollowUpHistory, Long> {

    List<RecallFollowUpHistory>
    findByRegisteredProductIdOrderByCreatedAtDesc(
            Long registeredProductId
    );

    void deleteByRegisteredProductId(
            Long registeredProductId
    );
}