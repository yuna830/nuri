package com.nuri.woori.controller;

import com.nuri.woori.entity.Schedule;
import com.nuri.woori.repository.ScheduleRepository;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@RestController
@RequestMapping("/api/schedules")
@CrossOrigin(origins = "*")
public class ScheduleController {

    private final ScheduleRepository scheduleRepository;

    public ScheduleController(ScheduleRepository scheduleRepository) {
        this.scheduleRepository = scheduleRepository;
    }

    @PostMapping
    public Schedule createSchedule(@RequestBody ScheduleRequest request) {
        Schedule schedule = new Schedule();
        applyRequest(schedule, request);
        return scheduleRepository.save(schedule);
    }

    @GetMapping("/senior/{seniorId}")
    public List<Schedule> getSeniorSchedules(@PathVariable Long seniorId) {
        return scheduleRepository.findBySeniorIdOrderByScheduleDateAscScheduleTimeAsc(seniorId);
    }

    @GetMapping("/senior/{seniorId}/today")
    public List<Schedule> getTodaySeniorSchedules(@PathVariable Long seniorId) {
        return scheduleRepository.findBySeniorIdAndScheduleDateOrderByScheduleTimeAsc(seniorId, LocalDate.now());
    }

    @GetMapping("/senior/{seniorId}/date/{scheduleDate}")
    public List<Schedule> getSeniorSchedulesByDate(
            @PathVariable Long seniorId,
            @PathVariable String scheduleDate
    ) {
        return scheduleRepository.findBySeniorIdAndScheduleDateOrderByScheduleTimeAsc(
                seniorId,
                LocalDate.parse(scheduleDate)
        );
    }

    @PutMapping("/{id}")
    public Schedule updateSchedule(@PathVariable Long id, @RequestBody ScheduleRequest request) {
        Schedule schedule = scheduleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Schedule not found"));

        applyRequest(schedule, request);
        return scheduleRepository.save(schedule);
    }

    @DeleteMapping("/{id}")
    public void deleteSchedule(@PathVariable Long id) {
        scheduleRepository.deleteById(id);
    }

    private void applyRequest(Schedule schedule, ScheduleRequest request) {
        schedule.setGuardianId(request.guardianId());
        schedule.setSeniorId(request.seniorId());
        schedule.setTitle(request.title());
        schedule.setContent(request.content());
        schedule.setScheduleDate(LocalDate.parse(request.scheduleDate()));
        schedule.setScheduleTime(parseTime(request.scheduleTime()));
        schedule.setIsRepeat(request.isRepeat() != null ? request.isRepeat() : false);
        schedule.setIsAlarm(request.isAlarm() != null ? request.isAlarm() : true);
    }

    private LocalTime parseTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return LocalTime.parse(value.length() == 5 ? value + ":00" : value);
    }

    public record ScheduleRequest(
            Long guardianId,
            Long seniorId,
            String title,
            String content,
            String scheduleDate,
            String scheduleTime,
            Boolean isRepeat,
            Boolean isAlarm
    ) {
    }
}
