package com.nuri.woorilink.domain.schedule.controller;

import com.nuri.woorilink.domain.schedule.entity.VisitSchedule;
import com.nuri.woorilink.domain.schedule.service.VisitScheduleService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/schedules")
@RequiredArgsConstructor
public class VisitScheduleController {

    private final VisitScheduleService scheduleService;

    @GetMapping("/welfare-worker/{welfareWorkerId}")
    public List<VisitSchedule> getByWelfareWorker(@PathVariable Long welfareWorkerId) {
        return scheduleService.getByWelfareWorker(welfareWorkerId);
    }

    @GetMapping("/welfare-worker/{welfareWorkerId}/month")
    public List<VisitSchedule> getByMonth(@PathVariable Long welfareWorkerId,
                                          @RequestParam int year,
                                          @RequestParam int month) {
        return scheduleService.getByMonth(welfareWorkerId, year, month);
    }

    @GetMapping("/senior/{seniorId}")
    public List<VisitSchedule> getBySenior(@PathVariable Long seniorId) {
        return scheduleService.getBySenior(seniorId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public VisitSchedule create(@RequestBody VisitSchedule schedule) {
        return scheduleService.create(schedule);
    }

    @PatchMapping("/{id}/status")
    public VisitSchedule updateStatus(@PathVariable Long id,
                                      @RequestParam VisitSchedule.VisitStatus status) {
        return scheduleService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { scheduleService.delete(id); }
}
