package com.nuri.woorilink.controller;

import com.nuri.woorilink.entity.WelfareWorker;
import com.nuri.woorilink.repository.WelfareWorkerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/welfare-workers")
@RequiredArgsConstructor
public class WelfareWorkerController {

    private final WelfareWorkerRepository welfareWorkerRepository;

    @GetMapping
    public List<WelfareWorker> getAll() { return welfareWorkerRepository.findAll(); }

    @GetMapping("/{id}")
    public WelfareWorker getById(@PathVariable Long id) {
        return welfareWorkerRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("복지사를 찾을 수 없습니다: " + id));
    }
}
