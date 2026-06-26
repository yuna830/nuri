package com.nuri.woorilink.controller;

import com.nuri.woorilink.entity.ActionRecord;
import com.nuri.woorilink.service.ActionRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/actions")
@RequiredArgsConstructor
public class ActionRecordController {

    private final ActionRecordService actionRecordService;

    @GetMapping("/senior/{seniorId}")
    public List<ActionRecord> getBySenior(@PathVariable Long seniorId) {
        return actionRecordService.getBySenior(seniorId);
    }

    @GetMapping("/welfare-worker/{welfareWorkerId}")
    public List<ActionRecord> getByWelfareWorker(@PathVariable Long welfareWorkerId) {
        return actionRecordService.getByWelfareWorker(welfareWorkerId);
    }

    @GetMapping("/pending")
    public List<ActionRecord> getPending() { return actionRecordService.getPending(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActionRecord create(@RequestBody ActionRecord record) {
        return actionRecordService.create(record);
    }

    @PatchMapping("/{id}/status")
    public ActionRecord updateStatus(@PathVariable Long id,
                                     @RequestParam ActionRecord.ActionStatus status,
                                     @RequestParam(required = false) String note) {
        return actionRecordService.updateStatus(id, status, note);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { actionRecordService.delete(id); }
}
