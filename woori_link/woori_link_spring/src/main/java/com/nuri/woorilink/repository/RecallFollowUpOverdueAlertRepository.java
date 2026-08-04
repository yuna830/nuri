package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.RecallFollowUpOverdueAlert;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RecallFollowUpOverdueAlertRepository
        extends JpaRepository<
        RecallFollowUpOverdueAlert,
        Long
        > {

    Optional<RecallFollowUpOverdueAlert>
    findByRegisteredProductId(
            Long registeredProductId
    );

    List<RecallFollowUpOverdueAlert>
    findByStatus(
            RecallFollowUpOverdueAlert.AlertStatus status
    );

    List<RecallFollowUpOverdueAlert>
    findByWelfareWorkerIdAndStatusOrderByUpdatedAtDesc(
            Long welfareWorkerId,
            RecallFollowUpOverdueAlert.AlertStatus status
    );
}