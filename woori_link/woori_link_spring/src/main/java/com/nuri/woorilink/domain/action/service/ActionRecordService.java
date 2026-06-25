package com.nuri.woorilink.domain.action.service;

import com.nuri.woorilink.domain.action.entity.ActionRecord;
import com.nuri.woorilink.domain.action.repository.ActionRecordRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ActionRecordService {

    private final ActionRecordRepository actionRecordRepository;

    public List<ActionRecord> getBySenior(Long seniorId) {
        return actionRecordRepository.findBySeniorId(seniorId);
    }

    public List<ActionRecord> getByWelfareWorker(Long welfareWorkerId) {
        return actionRecordRepository.findByWelfareWorkerId(welfareWorkerId);
    }

    public List<ActionRecord> getPending() {
        return actionRecordRepository.findByStatus(ActionRecord.ActionStatus.PENDING);
    }

    @Transactional
    public ActionRecord create(ActionRecord record) {
        return actionRecordRepository.save(record);
    }

    @Transactional
    public ActionRecord updateStatus(Long id, ActionRecord.ActionStatus status, String note) {
        ActionRecord record = actionRecordRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("조치 기록을 찾을 수 없습니다: " + id));
        record.setStatus(status);
        if (note != null) record.setNote(note);
        return actionRecordRepository.save(record);
    }

    @Transactional
    public void delete(Long id) { actionRecordRepository.deleteById(id); }
}
