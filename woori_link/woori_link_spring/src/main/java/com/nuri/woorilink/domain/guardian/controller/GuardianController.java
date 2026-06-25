package com.nuri.woorilink.domain.guardian.controller;

import com.nuri.woorilink.domain.guardian.entity.Guardian;
import com.nuri.woorilink.domain.guardian.repository.GuardianRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/guardians")
@RequiredArgsConstructor
public class GuardianController {

    private final GuardianRepository guardianRepository;

    @GetMapping
    public List<Guardian> getAll() { return guardianRepository.findAll(); }

    @GetMapping("/{id}")
    public Guardian getById(@PathVariable Long id) {
        return guardianRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("보호자를 찾을 수 없습니다: " + id));
    }
}
