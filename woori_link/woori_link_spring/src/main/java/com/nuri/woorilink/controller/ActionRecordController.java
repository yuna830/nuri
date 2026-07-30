package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.entity.ActionRecord;
import com.nuri.woorilink.service.ActionRecordService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/actions")
@RequiredArgsConstructor
public class ActionRecordController {

    private final ActionRecordService actionRecordService;

    @GetMapping("/senior/{seniorId}")
    public List<ActionRecord> getBySenior(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long seniorId
    ) {
        return actionRecordService.getBySenior(user, seniorId);
    }

    @GetMapping("/welfare-worker/{welfareWorkerId}")
    public List<ActionRecord> getByWelfareWorker(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long welfareWorkerId
    ) {
        return actionRecordService.getByWelfareWorker(user, welfareWorkerId);
    }

    @GetMapping("/pending")
    public List<ActionRecord> getPending(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return actionRecordService.getPending(user);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ActionRecord create(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody ActionRecord record
    ) {
        return actionRecordService.create(user, record);
    }

    @PatchMapping("/{id}")
    public ActionRecord update(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @RequestBody ActionRecord changes
    ) {
        return actionRecordService.update(user, id, changes);
    }

    @PatchMapping("/{id}/status")
    public ActionRecord updateStatus(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id,
            @RequestParam ActionRecord.ActionStatus status,
            @RequestParam(required = false) String note
    ) {
        return actionRecordService.updateStatus(user, id, status, note);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long id
    ) {
        actionRecordService.delete(user, id);
    }
}
