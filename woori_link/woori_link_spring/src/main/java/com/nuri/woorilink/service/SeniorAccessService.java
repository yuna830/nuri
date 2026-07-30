package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SeniorAccessService {

    private final SeniorRepository seniorRepository;

    public Senior requireReadableSenior(AuthenticatedUser user, Long seniorId) {
        requireAuthenticatedUser(user);
        Senior senior = requireSenior(seniorId);

        boolean allowed = switch (user.getRole()) {
            case "SENIOR" -> Objects.equals(user.getUserId(), senior.getId());
            case "GUARDIAN" -> Objects.equals(user.getUserId(), senior.getGuardianId());
            case "WELFARE_WORKER" ->
                    Objects.equals(user.getUserId(), senior.getWelfareWorkerId());
            default -> false;
        };

        if (!allowed) {
            throw new AccessDeniedException("You do not have permission to access this senior.");
        }
        return senior;
    }

    public Senior requireGuardianSenior(AuthenticatedUser user, Long seniorId) {
        requireAuthenticatedUser(user);
        Senior senior = requireSenior(seniorId);

        if (!"GUARDIAN".equals(user.getRole())
                || !Objects.equals(user.getUserId(), senior.getGuardianId())) {
            throw new AccessDeniedException(
                    "Only the linked guardian can perform this operation."
            );
        }
        return senior;
    }

    public Senior requireAssignedWelfareWorkerSenior(
            AuthenticatedUser user,
            Long seniorId
    ) {
        requireAuthenticatedUser(user);
        Senior senior = requireSenior(seniorId);

        if (!"WELFARE_WORKER".equals(user.getRole())
                || !Objects.equals(user.getUserId(), senior.getWelfareWorkerId())) {
            throw new AccessDeniedException(
                    "Only the assigned welfare worker can perform this operation."
            );
        }
        return senior;
    }

    private void requireAuthenticatedUser(AuthenticatedUser user) {
        if (user == null || user.getRole() == null || user.getUserId() == null) {
            throw new AccessDeniedException("Authentication is required.");
        }
    }

    private Senior requireSenior(Long seniorId) {
        if (seniorId == null) {
            throw new IllegalArgumentException("Senior ID is required.");
        }
        return seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("Senior not found."));
    }
}
