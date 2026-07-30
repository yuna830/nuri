package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.entity.ActionRecord;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.ActionRecordRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ActionRecordService {

    private final ActionRecordRepository actionRecordRepository;
    private final SeniorRepository seniorRepository;
    private final SeniorAccessService seniorAccessService;

    public List<ActionRecord> getBySenior(
            AuthenticatedUser user,
            Long seniorId
    ) {
        seniorAccessService.requireReadableSenior(user, seniorId);
        return enrichSeniorInfo(actionRecordRepository.findBySeniorId(seniorId));
    }

    public List<ActionRecord> getByWelfareWorker(
            AuthenticatedUser user,
            Long welfareWorkerId
    ) {
        requireCurrentWelfareWorker(user, welfareWorkerId);
        return getByWelfareWorkerId(welfareWorkerId);
    }

    public List<ActionRecord> getPending(AuthenticatedUser user) {
        requireCurrentWelfareWorker(user, user == null ? null : user.getUserId());
        return getByWelfareWorkerId(user.getUserId()).stream()
                .filter(record -> record.getStatus() == ActionRecord.ActionStatus.PENDING)
                .toList();
    }

    @Transactional
    public ActionRecord create(
            AuthenticatedUser user,
            ActionRecord record
    ) {
        if (record == null || record.getSeniorId() == null) {
            throw new IllegalArgumentException("Senior ID is required.");
        }

        Senior senior;
        if ("GUARDIAN".equals(user == null ? null : user.getRole())) {
            senior = seniorAccessService.requireGuardianSenior(user, record.getSeniorId());
            record.setActionSubject(ActionRecord.ActionSubject.GUARDIAN);
        } else if ("WELFARE_WORKER".equals(user == null ? null : user.getRole())) {
            senior = seniorAccessService.requireAssignedWelfareWorkerSenior(
                    user,
                    record.getSeniorId()
            );
            record.setActionSubject(ActionRecord.ActionSubject.WELFARE_WORKER);
        } else {
            throw new AccessDeniedException(
                    "Only a linked guardian or assigned welfare worker can create an action."
            );
        }

        record.setId(null);
        record.setWelfareWorkerId(senior.getWelfareWorkerId());
        record.setCreatedAt(null);
        record.setUpdatedAt(null);
        if (record.getStatus() == null) {
            record.setStatus(ActionRecord.ActionStatus.PENDING);
        }
        return actionRecordRepository.save(record);
    }

    @Transactional
    public ActionRecord update(
            AuthenticatedUser user,
            Long id,
            ActionRecord changes
    ) {
        ActionRecord record = requireAssignedWorkerRecord(user, id);
        if (changes == null) {
            throw new IllegalArgumentException("Action changes are required.");
        }

        if (changes.getActionType() != null) {
            record.setActionType(changes.getActionType());
        }
        if (changes.getStatus() != null) {
            record.setStatus(changes.getStatus());
        }
        if (changes.getNote() != null) {
            record.setNote(changes.getNote());
        }
        if (changes.getProductName() != null) {
            record.setProductName(changes.getProductName());
        }
        if (changes.getDueDate() != null) {
            record.setDueDate(changes.getDueDate());
        }
        if (changes.getImmediateRisk() != null) {
            record.setImmediateRisk(changes.getImmediateRisk());
        }
        if (changes.getFallEnvironmentRisk() != null) {
            record.setFallEnvironmentRisk(changes.getFallEnvironmentRisk());
        }
        return actionRecordRepository.save(record);
    }

    @Transactional
    public ActionRecord updateStatus(
            AuthenticatedUser user,
            Long id,
            ActionRecord.ActionStatus status,
            String note
    ) {
        if (status == null) {
            throw new IllegalArgumentException("Action status is required.");
        }
        ActionRecord record = requireAssignedWorkerRecord(user, id);
        record.setStatus(status);
        if (note != null) {
            record.setNote(note);
        }
        return actionRecordRepository.save(record);
    }

    @Transactional
    public void delete(AuthenticatedUser user, Long id) {
        ActionRecord record = requireAssignedWorkerRecord(user, id);
        actionRecordRepository.delete(record);
    }

    private List<ActionRecord> getByWelfareWorkerId(Long welfareWorkerId) {
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

    private ActionRecord requireAssignedWorkerRecord(
            AuthenticatedUser user,
            Long id
    ) {
        ActionRecord record = actionRecordRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Action record not found: " + id
                ));
        if (record.getSeniorId() == null) {
            throw new AccessDeniedException(
                    "An action without a senior cannot be changed."
            );
        }
        seniorAccessService.requireAssignedWelfareWorkerSenior(
                user,
                record.getSeniorId()
        );
        return record;
    }

    private void requireCurrentWelfareWorker(
            AuthenticatedUser user,
            Long welfareWorkerId
    ) {
        if (user == null
                || !"WELFARE_WORKER".equals(user.getRole())
                || user.getUserId() == null
                || !Objects.equals(user.getUserId(), welfareWorkerId)) {
            throw new AccessDeniedException(
                    "Only the authenticated welfare worker can access these actions."
            );
        }
    }

    private List<ActionRecord> enrichSeniorInfo(List<ActionRecord> records) {
        Map<Long, Senior> seniorsById = new LinkedHashMap<>();
        for (ActionRecord record : records) {
            Long seniorId = record.getSeniorId();
            if (seniorId == null) {
                continue;
            }
            Senior senior = seniorsById.computeIfAbsent(
                    seniorId,
                    id -> seniorRepository.findById(id).orElse(null)
            );
            if (senior == null) {
                continue;
            }
            record.setSeniorName(senior.getName());
            record.setSeniorAge(senior.getAge());
        }
        return records;
    }
}
