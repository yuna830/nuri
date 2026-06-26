package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.VisitSchedule;
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

    public List<VisitSchedule> getByWelfareWorker(Long welfareWorkerId) {
        return scheduleRepository.findByWelfareWorkerId(welfareWorkerId);
    }

    public List<VisitSchedule> getByMonth(Long welfareWorkerId, int year, int month) {
        return scheduleRepository.findByWelfareWorkerIdAndMonth(welfareWorkerId, year, month);
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
}
