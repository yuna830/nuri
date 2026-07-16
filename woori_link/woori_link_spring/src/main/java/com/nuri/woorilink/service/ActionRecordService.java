package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.ActionRecord;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.ActionRecordRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ActionRecordService {

    private final ActionRecordRepository actionRecordRepository;
    private final SeniorRepository seniorRepository;

    public List<ActionRecord> getBySenior(Long seniorId) {
        return enrichSeniorInfo(actionRecordRepository.findBySeniorId(seniorId));
    }

    public List<ActionRecord> getByWelfareWorker(Long welfareWorkerId) {
        List<Long> assignedSeniorIds = seniorRepository.findByWelfareWorkerId(welfareWorkerId)
                .stream()
                .map(Senior::getId)
                .toList();

        Map<Long, ActionRecord> recordsById = new LinkedHashMap<>();
        actionRecordRepository.findByWelfareWorkerId(welfareWorkerId)
                .forEach(record -> recordsById.put(record.getId(), record));

        if (!assignedSeniorIds.isEmpty()) {
            actionRecordRepository.findBySeniorIdIn(assignedSeniorIds)
                    .forEach(record -> recordsById.put(record.getId(), record));
        }

        return enrichSeniorInfo(recordsById.values().stream()
                .sorted(Comparator.comparing(
                        ActionRecord::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .toList());
    }

    public List<ActionRecord> getPending() {
        return enrichSeniorInfo(actionRecordRepository.findByStatus(ActionRecord.ActionStatus.PENDING));
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

    private List<ActionRecord> enrichSeniorInfo(List<ActionRecord> records) {
        Map<Long, Senior> seniorsById = new LinkedHashMap<>();
        for (ActionRecord record : records) {
            Long seniorId = record.getSeniorId();
            if (seniorId == null) continue;
            Senior senior = seniorsById.computeIfAbsent(
                    seniorId,
                    id -> seniorRepository.findById(id).orElse(null)
            );
            if (senior == null) continue;
            record.setSeniorName(senior.getName());
            record.setSeniorAge(senior.getAge());
        }
        return records;
    }
}
