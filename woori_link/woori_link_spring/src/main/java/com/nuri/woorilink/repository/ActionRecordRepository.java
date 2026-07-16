package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.ActionRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActionRecordRepository extends JpaRepository<ActionRecord, Long> {
    List<ActionRecord> findBySeniorId(Long seniorId);
    List<ActionRecord> findBySeniorIdIn(List<Long> seniorIds);
    List<ActionRecord> findByWelfareWorkerId(Long welfareWorkerId);
    List<ActionRecord> findByStatus(ActionRecord.ActionStatus status);
    List<ActionRecord> findBySeniorIdAndActionTypeAndProductNameOrderByCreatedAtDesc(
            Long seniorId,
            ActionRecord.ActionType actionType,
            String productName
    );
}
