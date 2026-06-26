package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.ActionRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActionRecordRepository extends JpaRepository<ActionRecord, Long> {
    List<ActionRecord> findBySeniorId(Long seniorId);
    List<ActionRecord> findByWelfareWorkerId(Long welfareWorkerId);
    List<ActionRecord> findByStatus(ActionRecord.ActionStatus status);
}
