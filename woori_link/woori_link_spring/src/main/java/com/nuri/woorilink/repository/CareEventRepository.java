package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.CareEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CareEventRepository extends JpaRepository<CareEvent, Long> {
    List<CareEvent> findBySeniorIdOrderByOccurredAtDesc(Long seniorId);
    List<CareEvent> findBySeniorIdAndTypeAndStatus(
            Long seniorId,
            CareEvent.EventType type,
            CareEvent.EventStatus status
    );
    boolean existsBySeniorIdAndTypeAndStatus(Long seniorId, CareEvent.EventType type, CareEvent.EventStatus status);
}
