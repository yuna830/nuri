package com.nuri.woorilink.domain.senior.controller;

import com.nuri.woorilink.domain.senior.entity.Senior;
import com.nuri.woorilink.domain.senior.service.SeniorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/seniors")
@RequiredArgsConstructor
public class SeniorController {

    private final SeniorService seniorService;

    @GetMapping
    public List<Senior> getAll() { return seniorService.getAll(); }

    @GetMapping("/{id}")
    public Senior getById(@PathVariable Long id) { return seniorService.getById(id); }

    @GetMapping("/by-guardian/{guardianId}")
    public List<Senior> getByGuardian(@PathVariable Long guardianId) {
        return seniorService.getByGuardian(guardianId);
    }

    @GetMapping("/by-welfare-worker/{welfareWorkerId}")
    public List<Senior> getByWelfareWorker(@PathVariable Long welfareWorkerId) {
        return seniorService.getByWelfareWorker(welfareWorkerId);
    }

    @GetMapping("/voucher-unapplied")
    public List<Senior> getVoucherUnapplied() { return seniorService.getVoucherUnapplied(); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Senior create(@RequestBody Senior senior) { return seniorService.create(senior); }

    @PatchMapping("/{id}")
    public Senior update(@PathVariable Long id, @RequestBody Senior req) {
        return seniorService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) { seniorService.delete(id); }
}
