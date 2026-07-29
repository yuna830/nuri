package com.nuri.woorilink.common.security;

import com.nuri.woorilink.repository.GuardianRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.repository.WelfareWorkerRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AccountExistenceService {

    private final GuardianRepository guardianRepository;
    private final SeniorRepository seniorRepository;
    private final WelfareWorkerRepository welfareWorkerRepository;

    public boolean exists(String role, Long userId) {
        if (role == null || userId == null) {
            return false;
        }

        return switch (role) {
            case "GUARDIAN" -> guardianRepository.existsById(userId);
            case "SENIOR" -> seniorRepository.existsById(userId);
            case "WELFARE_WORKER" -> welfareWorkerRepository.existsById(userId);
            default -> false;
        };
    }
}
