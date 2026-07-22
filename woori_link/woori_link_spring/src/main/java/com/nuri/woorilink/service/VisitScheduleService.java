package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.VisitScheduleResponse;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.entity.VisitSchedule;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.repository.VisitScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class VisitScheduleService {

    private final VisitScheduleRepository scheduleRepository;
    private final SeniorRepository seniorRepository;

    public List<VisitScheduleResponse> getByWelfareWorker(Long welfareWorkerId) {
        return scheduleRepository.findByWelfareWorkerId(welfareWorkerId)
                .stream()
                .map(this::toWelfareWorkerResponse)
                .toList();
    }

    public List<VisitScheduleResponse> getByMonth(Long welfareWorkerId, int year, int month) {
        return scheduleRepository.findByWelfareWorkerIdAndMonth(welfareWorkerId, year, month)
                .stream()
                .map(this::toWelfareWorkerResponse)
                .toList();
    }

    public List<VisitSchedule> getBySenior(Long seniorId) {
        return scheduleRepository.findBySeniorId(seniorId);
    }

    @Transactional
    public VisitSchedule create(VisitSchedule schedule) {
        return scheduleRepository.save(schedule);
    }

    @Transactional
    public VisitSchedule updateStatus(Long id, VisitSchedule.VisitStatus status) {
        VisitSchedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("일정을 찾을 수 없습니다: " + id));
        schedule.setStatus(status);
        return scheduleRepository.save(schedule);
    }

    @Transactional
    public void delete(Long id) { scheduleRepository.deleteById(id); }

    private VisitScheduleResponse toWelfareWorkerResponse(VisitSchedule schedule) {
        String seniorName = schedule.getSeniorId() == null
                ? null
                : seniorRepository.findById(schedule.getSeniorId())
                .map(Senior::getName)
                .orElse(null);
        String displayName = seniorName == null ? "어르신" : seniorName;
        String purpose = schedule.getPurpose() == null || schedule.getPurpose().isBlank()
                ? (seniorName == null
                    ? "어르신 조치 방문일"
                    : seniorName + "님 조치 방문일")
                : schedule.getPurpose();
        return new VisitScheduleResponse(
                schedule.getId(),
                schedule.getSeniorId(),
                displayName,
                schedule.getWelfareWorkerId(),
                schedule.getVisitDate(),
                schedule.getVisitTime(),
                purpose,
                schedule.getNote(),
                schedule.getStatus(),
                schedule.getCreatedAt()
        );
    }
}
