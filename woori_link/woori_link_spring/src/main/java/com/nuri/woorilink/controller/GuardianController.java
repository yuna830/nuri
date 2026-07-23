package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.dto.GuardianNotificationSettingsRequest;
import com.nuri.woorilink.dto.GuardianPasswordChangeRequest;
import com.nuri.woorilink.dto.GuardianProfileRequest;
import com.nuri.woorilink.dto.GuardianProfileResponse;
import com.nuri.woorilink.dto.GuardianTodayCheckInSummaryResponse;
import com.nuri.woorilink.dto.GuardianUrgentSummaryResponse;
import com.nuri.woorilink.entity.CareAlert;
import com.nuri.woorilink.entity.CareEvent;
import com.nuri.woorilink.entity.CheckIn;
import com.nuri.woorilink.entity.Guardian;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.CareAlertRepository;
import com.nuri.woorilink.repository.CheckInRepository;
import com.nuri.woorilink.repository.GuardianRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.service.GuardianAuthService;

import lombok.RequiredArgsConstructor;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/guardians")
@RequiredArgsConstructor
public class GuardianController {

    private static final ZoneId KOREA_ZONE =
            ZoneId.of("Asia/Seoul");

    /**
     * 보호자가 아직 해결하지 않은 알림 상태.
     *
     * 현재 CareAlert.AlertStatus에는
     * UNREAD, ACKNOWLEDGED, RESOLVED만 존재한다.
     */
    private static final Set<CareAlert.AlertStatus>
            UNRESOLVED_ALERT_STATUSES =
            EnumSet.of(
                    CareAlert.AlertStatus.UNREAD,
                    CareAlert.AlertStatus.ACKNOWLEDGED
            );

    private final GuardianRepository guardianRepository;
    private final GuardianAuthService guardianAuthService;
    private final SeniorRepository seniorRepository;
    private final CheckInRepository checkInRepository;
    private final CareAlertRepository careAlertRepository;

    @GetMapping("/me")
    public GuardianProfileResponse getMyProfile(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return guardianAuthService.getProfile(
                requireGuardian(user)
        );
    }

    @PatchMapping("/me")
    public GuardianProfileResponse updateMyProfile(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody GuardianProfileRequest request
    ) {
        return guardianAuthService.updateProfile(
                requireGuardian(user),
                request
        );
    }

    /**
     * 오늘 안부 요청 현황 요약.
     *
     * 반환 값:
     * - 오늘 한 번이라도 미응답한 어르신 수
     * - 오늘 생성된 전체 요청 수
     * - 응답 완료 수
     * - 미응답 수
     */
    @GetMapping("/me/check-in-summary/today")
    public GuardianTodayCheckInSummaryResponse
    getTodayCheckInSummary(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        Long guardianId = requireGuardian(user);

        List<Long> seniorIds =
                getGuardianSeniorIds(guardianId);

        if (seniorIds.isEmpty()) {
            return new GuardianTodayCheckInSummaryResponse(
                    0,
                    0,
                    0,
                    0
            );
        }

        LocalDateTime start = getTodayStart();
        LocalDateTime end = start.plusDays(1);

        List<CheckIn> checkIns =
                checkInRepository
                        .findBySeniorIdInAndRequestedAtGreaterThanEqualAndRequestedAtLessThan(
                                seniorIds,
                                start,
                                end
                        );

        long respondedCount = checkIns.stream()
                .filter(item ->
                        item.getStatus()
                                == CheckIn.Status.RESPONDED
                )
                .count();

        List<CheckIn> missedCheckIns =
                checkIns.stream()
                        .filter(item ->
                                item.getStatus()
                                        == CheckIn.Status.MISSED
                        )
                        .toList();

        long seniorCountWithMissed =
                missedCheckIns.stream()
                        .map(CheckIn::getSeniorId)
                        .distinct()
                        .count();

        return new GuardianTodayCheckInSummaryResponse(
                seniorCountWithMissed,
                checkIns.size(),
                respondedCount,
                missedCheckIns.size()
        );
    }

    /**
     * 보호자 홈의 긴급 확인 현황.
     *
     * 현재 실제 데이터로 집계하는 항목:
     * - 미처리 낙상 의심·낙상 감지
     * - 미처리 SOS
     * - 오늘 안부 연속 3회 이상 미응답
     *
     * 생활안전 신고와 심각한 기상특보는
     * 관련 이벤트 타입과 저장 구조를 추가한 뒤 집계한다.
     */
    @GetMapping("/me/urgent-summary")
    public GuardianUrgentSummaryResponse getUrgentSummary(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        Long guardianId = requireGuardian(user);

        List<Long> seniorIds =
                getGuardianSeniorIds(guardianId);

        if (seniorIds.isEmpty()) {
            return new GuardianUrgentSummaryResponse(
                    0,
                    0,
                    0,
                    0,
                    0,
                    0
            );
        }

        List<CareAlert> fallAlerts =
                careAlertRepository
                        .findByGuardianIdAndTypeInAndStatusIn(
                                guardianId,
                                EnumSet.of(
                                        CareEvent.EventType.FALL_SUSPECTED,
                                        CareEvent.EventType.FALL_DETECTED
                                ),
                                UNRESOLVED_ALERT_STATUSES
                        );

        List<CareAlert> sosAlerts =
                careAlertRepository
                        .findByGuardianIdAndTypeAndStatusIn(
                                guardianId,
                                CareEvent.EventType.SOS,
                                UNRESOLVED_ALERT_STATUSES
                        );

        long fallCount =
                countDistinctUrgentAlerts(fallAlerts);

        long sosCount =
                countDistinctUrgentAlerts(sosAlerts);

        long consecutiveMissedCheckInCount =
                countSeniorsWithThreeConsecutiveMissed(
                        seniorIds
                );

        /*
         * 아직 현재 프로젝트에 실제 이벤트 타입과
         * 저장 데이터가 없는 항목이다.
         */
        long lifeSafetyCount = 0;
        long severeWeatherCount = 0;

        long totalCount =
                fallCount
                        + sosCount
                        + lifeSafetyCount
                        + severeWeatherCount
                        + consecutiveMissedCheckInCount;

        return new GuardianUrgentSummaryResponse(
                totalCount,
                fallCount,
                sosCount,
                lifeSafetyCount,
                severeWeatherCount,
                consecutiveMissedCheckInCount
        );
    }

    @PostMapping("/me/invite-code/regenerate")
    public GuardianProfileResponse regenerateInviteCode(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        return guardianAuthService.regenerateInviteCode(
                requireGuardian(user)
        );
    }

    @PatchMapping("/me/notifications")
    public GuardianProfileResponse updateNotifications(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody
            GuardianNotificationSettingsRequest request
    ) {
        return guardianAuthService
                .updateNotificationSettings(
                        requireGuardian(user),
                        request
                );
    }

    @PatchMapping("/me/password")
    public void changePassword(
            @AuthenticationPrincipal AuthenticatedUser user,
            @RequestBody
            GuardianPasswordChangeRequest request
    ) {
        guardianAuthService.changePassword(
                requireGuardian(user),
                request
        );
    }

    @PatchMapping("/me/seniors/{seniorId}/relationship")
    public Senior updateRelationship(
            @AuthenticationPrincipal AuthenticatedUser user,
            @PathVariable Long seniorId,
            @RequestBody Map<String, String> request
    ) {
        Long guardianId = requireGuardian(user);

        Senior senior = seniorRepository.findById(seniorId)
                .filter(item ->
                        guardianId.equals(
                                item.getGuardianId()
                        )
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "연결된 어르신을 찾을 수 없습니다."
                        )
                );

        senior.setGuardianRelationship(
                request.get("relationship")
        );

        return seniorRepository.save(senior);
    }

    @DeleteMapping("/me")
    public void deleteMyAccount(
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        guardianAuthService.deleteAccount(
                requireGuardian(user)
        );
    }

    @GetMapping
    public List<Guardian> getAll() {
        return guardianRepository.findAll();
    }

    @GetMapping("/{id}")
    public Guardian getById(
            @PathVariable Long id
    ) {
        return guardianRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "보호자를 찾을 수 없습니다: "
                                        + id
                        )
                );
    }

    /**
     * 보호자에게 연결된 어르신 ID 목록을 반환한다.
     */
    private List<Long> getGuardianSeniorIds(
            Long guardianId
    ) {
        return seniorRepository
                .findByGuardianId(guardianId)
                .stream()
                .map(Senior::getId)
                .toList();
    }

    /**
     * 한국 시간 기준 오늘 시작 시각.
     */
    private LocalDateTime getTodayStart() {
        LocalDate today =
                LocalDate.now(KOREA_ZONE);

        return today.atStartOfDay();
    }

    /**
     * 같은 사건에서 여러 알림이 생성된 경우
     * careEventId 기준으로 한 건만 집계한다.
     *
     * careEventId가 없는 기존 알림은
     * alert ID를 기준으로 개별 집계한다.
     */
    private long countDistinctUrgentAlerts(
            List<CareAlert> alerts
    ) {
        return alerts.stream()
                .map(alert -> {
                    if (alert.getCareEventId() != null) {
                        return "event-"
                                + alert.getCareEventId();
                    }

                    return "alert-"
                            + alert.getId();
                })
                .distinct()
                .count();
    }

    /**
     * 오늘 한 번이라도 연속 3회 이상
     * MISSED 상태가 발생한 어르신 수를 계산한다.
     *
     * 한 어르신이 연속 미응답 구간을 여러 번 가져도
     * 긴급 확인 카드에는 1건으로 집계한다.
     */
    private long countSeniorsWithThreeConsecutiveMissed(
            List<Long> seniorIds
    ) {
        LocalDateTime start = getTodayStart();
        LocalDateTime end = start.plusDays(1);

        List<CheckIn> todayCheckIns =
                checkInRepository
                        .findBySeniorIdInAndRequestedAtGreaterThanEqualAndRequestedAtLessThan(
                                seniorIds,
                                start,
                                end
                        );

        Map<Long, List<CheckIn>> checkInsBySenior =
                todayCheckIns.stream()
                        .collect(
                                Collectors.groupingBy(
                                        CheckIn::getSeniorId
                                )
                        );

        return checkInsBySenior.values()
                .stream()
                .filter(this::hasThreeConsecutiveMissed)
                .count();
    }

    /**
     * 시간순으로 안부 기록을 확인해
     * 최대 연속 미응답 횟수가 3회 이상인지 판단한다.
     *
     * 예:
     * MISSED → MISSED → MISSED → RESPONDED
     * 결과: true
     *
     * MISSED → RESPONDED → MISSED → MISSED
     * 결과: false
     *
     * PENDING 요청은 아직 응답 제한 시간이
     * 끝나지 않은 요청이므로 연속 미응답을 끊지 않고
     * 계산 대상에서도 제외한다.
     */
    private boolean hasThreeConsecutiveMissed(
            List<CheckIn> checkIns
    ) {
        List<CheckIn> orderedCheckIns =
                checkIns.stream()
                        .sorted(
                                Comparator.comparing(
                                        CheckIn::getRequestedAt
                                )
                        )
                        .toList();

        int consecutiveMissed = 0;

        for (CheckIn checkIn : orderedCheckIns) {
            if (
                    checkIn.getStatus()
                            == CheckIn.Status.PENDING
            ) {
                continue;
            }

            if (
                    checkIn.getStatus()
                            == CheckIn.Status.MISSED
            ) {
                consecutiveMissed++;

                if (consecutiveMissed >= 3) {
                    return true;
                }

                continue;
            }

            consecutiveMissed = 0;
        }

        return false;
    }

    private Long requireGuardian(
            AuthenticatedUser user
    ) {
        if (
                user == null
                        || !"GUARDIAN".equalsIgnoreCase(
                        user.getRole()
                                .replaceFirst(
                                        "^ROLE_",
                                        ""
                                )
                )
        ) {
            throw new IllegalArgumentException(
                    "보호자 로그인이 필요합니다."
            );
        }

        return user.getUserId();
    }
}