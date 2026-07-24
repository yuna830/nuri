package com.nuri.woorilink.service;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.entity.GasDiscountDetail;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class EnergySupportAccessService {

    private final SeniorRepository seniorRepository;

    public void validateDetailAccess(
            AuthenticatedUser user,
            Long seniorId
    ) {
        validateReadAccess(user, seniorId);
    }

    public void validateReadAccess(
            AuthenticatedUser user,
            Long seniorId
    ) {
        validateRelationship(user, seniorId, true);
    }

    public void validateWriteAccess(
            AuthenticatedUser user,
            Long seniorId
    ) {
        validateRelationship(user, seniorId, false);
    }

    private void validateRelationship(
            AuthenticatedUser user,
            Long seniorId,
            boolean allowWelfareWorker
    ) {
        if (user == null || user.getUserId() == null) {
            throw new AccessDeniedException("로그인이 필요합니다.");
        }

        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "대상자를 찾을 수 없습니다: " + seniorId
                ));

        boolean allowed = switch (user.getRole()) {
            case "SENIOR" -> user.getUserId().equals(senior.getId());
            case "GUARDIAN" ->
                    user.getUserId().equals(senior.getGuardianId());
            case "WELFARE_WORKER" ->
                    allowWelfareWorker
                            && user.getUserId().equals(
                            senior.getWelfareWorkerId()
                    );
            default -> false;
        };

        if (!allowed) {
            throw new AccessDeniedException(
                    "해당 대상자의 에너지복지 정보에 접근할 수 없습니다."
            );
        }
    }

    public void validateWelfareWorker(AuthenticatedUser user) {
        if (user == null || !"WELFARE_WORKER".equals(user.getRole())) {
            throw new AccessDeniedException("복지사 권한이 필요합니다.");
        }
    }

    public GasDiscountDetail.UpdatedByRole getUpdatedByRole(
            AuthenticatedUser user
    ) {
        return GasDiscountDetail.UpdatedByRole.valueOf(user.getRole());
    }
}
