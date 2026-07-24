package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergySupportCompletionDto;
import com.nuri.woorilink.dto.EnergySupportConsultationRequestDto;
import com.nuri.woorilink.entity.CareAlert;
import com.nuri.woorilink.entity.CareEvent;
import com.nuri.woorilink.entity.EnergySupportConsultationRequest;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.CareAlertRepository;
import com.nuri.woorilink.repository.EnergySupportConsultationRequestRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class EnergySupportConsultationService {

    private static final List<
            EnergySupportConsultationRequest.ConsultationStatus
            > ACTIVE_STATUSES = List.of(
            EnergySupportConsultationRequest
                    .ConsultationStatus
                    .REQUESTED,

            EnergySupportConsultationRequest
                    .ConsultationStatus
                    .IN_PROGRESS
    );

    private final EnergySupportConsultationRequestRepository
            consultationRepository;

    private final SeniorRepository seniorRepository;

    private final EnergySupportCompletionService
            completionService;

    private final CareAlertRepository careAlertRepository;


    /**
     * 보호자가 복지사에게 에너지복지 정보 확인 요청
     */
    @Transactional
    public EnergySupportConsultationRequestDto requestConsultation(
            Long seniorId,
            Long guardianId,
            String requestMessage
    ) {
        Senior senior =
                getSenior(seniorId);

        validateGuardianAccess(
                senior,
                guardianId
        );

        if (senior.getWelfareWorkerId() == null) {
            throw new IllegalStateException(
                    "담당 복지사가 배정되지 않았습니다."
            );
        }

        EnergySupportCompletionDto completion =
                completionService.getCompletion(
                        seniorId
                );

        if (completion.completed()) {
            throw new IllegalStateException(
                    "필수 정보가 이미 모두 입력되어 있습니다."
            );
        }

        List<String> missingInformation =
                flattenMissingInformation(
                        completion
                );

        String missingText =
                String.join(
                        "||",
                        missingInformation
                );

        EnergySupportConsultationRequest existing =
                consultationRepository
                        .findFirstBySeniorIdAndStatusInOrderByCreatedAtDesc(
                                seniorId,
                                ACTIVE_STATUSES
                        )
                        .orElse(null);

        if (existing != null) {
            existing.setMissingCount(
                    completion.missingCount()
            );

            existing.setMissingInformation(
                    missingText
            );

            existing.setRequestMessage(
                    normalizeMessage(
                            requestMessage
                    )
            );

            return toDto(
                    consultationRepository.save(
                            existing
                    ),
                    senior
            );
        }

        EnergySupportConsultationRequest request =
                EnergySupportConsultationRequest
                        .builder()
                        .seniorId(
                                seniorId
                        )
                        .guardianId(
                                guardianId
                        )
                        .welfareWorkerId(
                                senior.getWelfareWorkerId()
                        )
                        .missingCount(
                                completion.missingCount()
                        )
                        .missingInformation(
                                missingText
                        )
                        .requestMessage(
                                normalizeMessage(
                                        requestMessage
                                )
                        )
                        .status(
                                EnergySupportConsultationRequest
                                        .ConsultationStatus
                                        .REQUESTED
                        )
                        .build();

        EnergySupportConsultationRequest saved =
                consultationRepository.save(
                        request
                );

        return toDto(
                saved,
                senior
        );
    }


    /**
     * 활성 상담 요청 조회
     */
    public EnergySupportConsultationRequestDto getActiveRequest(
            Long seniorId
    ) {
        Senior senior =
                getSenior(seniorId);

        return consultationRepository
                .findFirstBySeniorIdAndStatusInOrderByCreatedAtDesc(
                        seniorId,
                        ACTIVE_STATUSES
                )
                .map(request ->
                        toDto(
                                request,
                                senior
                        )
                )
                .orElse(null);
    }


    /**
     * 상담 요청 단건 조회
     */
    public EnergySupportConsultationRequestDto getRequest(
            Long requestId,
            Long userId,
            String role
    ) {
        EnergySupportConsultationRequest request =
                getRequestEntity(
                        requestId
                );

        if (
                "GUARDIAN".equals(role)
                        && !request.getGuardianId().equals(userId)
        ) {
            throw new AccessDeniedException(
                    "연결된 보호자만 상담 요청을 조회할 수 있습니다."
            );
        }

        if (
                "WELFARE_WORKER".equals(role)
                        && !request
                        .getWelfareWorkerId()
                        .equals(userId)
        ) {
            throw new AccessDeniedException(
                    "담당 복지사만 상담 요청을 조회할 수 있습니다."
            );
        }

        if (
                !"GUARDIAN".equals(role)
                        && !"WELFARE_WORKER".equals(role)
        ) {
            throw new AccessDeniedException(
                    "상담 요청 조회 권한이 없습니다."
            );
        }

        return toDto(
                request,
                getSenior(
                        request.getSeniorId()
                )
        );
    }


    /**
     * 복지사 상담 요청 목록
     */
    public List<EnergySupportConsultationRequestDto>
    getWorkerRequests(
            Long welfareWorkerId
    ) {
        return consultationRepository
                .findByWelfareWorkerIdAndStatusInOrderByCreatedAtDesc(
                        welfareWorkerId,
                        ACTIVE_STATUSES
                )
                .stream()
                .map(request ->
                        toDto(
                                request,
                                seniorRepository
                                        .findById(
                                                request.getSeniorId()
                                        )
                                        .orElse(null)
                        )
                )
                .toList();
    }


    /**
     * 복지사가 상담 일정 제안
     */
    @Transactional
    public EnergySupportConsultationRequestDto proposeSchedule(
            Long requestId,
            Long welfareWorkerId,
            LocalDate consultationDate,
            String availableStartTime,
            String availableEndTime,
            EnergySupportConsultationRequest.ConsultationMethod
                    consultationMethod,
            String scheduleMessage
    ) {
        EnergySupportConsultationRequest request =
                getWorkerRequest(
                        requestId,
                        welfareWorkerId
                );

        validateSchedule(
                consultationDate,
                availableStartTime,
                availableEndTime,
                consultationMethod
        );

        request.setConsultationDate(
                consultationDate
        );

        request.setAvailableStartTime(
                availableStartTime
        );

        request.setAvailableEndTime(
                availableEndTime
        );

        request.setConsultationMethod(
                consultationMethod
        );

        request.setScheduleStatus(
                EnergySupportConsultationRequest
                        .ScheduleStatus
                        .PROPOSED
        );

        request.setScheduleProposedBy(
                EnergySupportConsultationRequest
                        .ScheduleProposedBy
                        .WELFARE_WORKER
        );

        request.setScheduleMessage(
                normalizeMessage(
                        scheduleMessage
                )
        );

        request.setScheduleProposedAt(
                LocalDateTime.now()
        );

        request.setScheduleRespondedAt(
                null
        );

        request.setStatus(
                EnergySupportConsultationRequest
                        .ConsultationStatus
                        .IN_PROGRESS
        );

        EnergySupportConsultationRequest saved =
                consultationRepository.save(
                        request
                );

        Senior senior =
                getSenior(
                        saved.getSeniorId()
                );

        createGuardianScheduleAlert(
                saved,
                senior
        );

        return toDto(
                saved,
                senior
        );
    }


    /**
     * 보호자가 상담 일정 가능 응답
     */
    @Transactional
    public EnergySupportConsultationRequestDto confirmSchedule(
            Long requestId,
            Long guardianId
    ) {
        EnergySupportConsultationRequest request =
                getGuardianRequest(
                        requestId,
                        guardianId
                );

        if (
                request.getScheduleStatus()
                        != EnergySupportConsultationRequest
                        .ScheduleStatus
                        .PROPOSED
        ) {
            throw new IllegalStateException(
                    "확정할 수 있는 상담 일정 제안이 없습니다."
            );
        }

        request.setScheduleStatus(
                EnergySupportConsultationRequest
                        .ScheduleStatus
                        .CONFIRMED
        );

        request.setScheduleRespondedAt(
                LocalDateTime.now()
        );

        return toDto(
                consultationRepository.save(
                        request
                ),
                getSenior(
                        request.getSeniorId()
                )
        );
    }


    /**
     * 보호자가 다른 날짜·시간 제안
     */
    @Transactional
    public EnergySupportConsultationRequestDto requestScheduleChange(
            Long requestId,
            Long guardianId,
            LocalDate consultationDate,
            String availableStartTime,
            String availableEndTime,
            String scheduleMessage
    ) {
        EnergySupportConsultationRequest request =
                getGuardianRequest(
                        requestId,
                        guardianId
                );

        validateSchedule(
                consultationDate,
                availableStartTime,
                availableEndTime,
                request.getConsultationMethod() == null
                        ? EnergySupportConsultationRequest
                        .ConsultationMethod
                        .PHONE
                        : request.getConsultationMethod()
        );

        request.setConsultationDate(
                consultationDate
        );

        request.setAvailableStartTime(
                availableStartTime
        );

        request.setAvailableEndTime(
                availableEndTime
        );

        request.setScheduleMessage(
                normalizeMessage(
                        scheduleMessage
                )
        );

        request.setScheduleStatus(
                EnergySupportConsultationRequest
                        .ScheduleStatus
                        .CHANGE_REQUESTED
        );

        request.setScheduleProposedBy(
                EnergySupportConsultationRequest
                        .ScheduleProposedBy
                        .GUARDIAN
        );

        request.setScheduleProposedAt(
                LocalDateTime.now()
        );

        request.setScheduleRespondedAt(
                LocalDateTime.now()
        );

        return toDto(
                consultationRepository.save(
                        request
                ),
                getSenior(
                        request.getSeniorId()
                )
        );
    }


    /**
     * 복지사가 상담 요청 처리 시작
     */
    @Transactional
    public EnergySupportConsultationRequestDto startConsultation(
            Long requestId,
            Long welfareWorkerId
    ) {
        EnergySupportConsultationRequest request =
                getWorkerRequest(
                        requestId,
                        welfareWorkerId
                );

        request.setStatus(
                EnergySupportConsultationRequest
                        .ConsultationStatus
                        .IN_PROGRESS
        );

        return toDto(
                consultationRepository.save(
                        request
                ),
                getSenior(
                        request.getSeniorId()
                )
        );
    }


    /**
     * 복지사가 상담 요청 처리 완료
     */
    @Transactional
    public EnergySupportConsultationRequestDto resolveConsultation(
            Long requestId,
            Long welfareWorkerId,
            String resolutionNote
    ) {
        EnergySupportConsultationRequest request =
                getWorkerRequest(
                        requestId,
                        welfareWorkerId
                );

        EnergySupportCompletionDto completion =
                completionService.getCompletion(
                        request.getSeniorId()
                );

        if (!completion.completed()) {
            throw new IllegalStateException(
                    "필수 미입력 정보가 남아 있어 처리 완료할 수 없습니다."
            );
        }

        request.setStatus(
                EnergySupportConsultationRequest
                        .ConsultationStatus
                        .RESOLVED
        );

        request.setScheduleStatus(
                EnergySupportConsultationRequest
                        .ScheduleStatus
                        .COMPLETED
        );

        request.setResolvedBy(
                welfareWorkerId
        );

        request.setResolutionNote(
                normalizeMessage(
                        resolutionNote
                )
        );

        request.setResolvedAt(
                LocalDateTime.now()
        );

        request.setMissingCount(
                0
        );

        request.setMissingInformation(
                ""
        );

        return toDto(
                consultationRepository.save(
                        request
                ),
                getSenior(
                        request.getSeniorId()
                )
        );
    }


    private void createGuardianScheduleAlert(
            EnergySupportConsultationRequest request,
            Senior senior
    ) {
        Map<String, Object> details =
                new LinkedHashMap<>();

        details.put(
                "category",
                "ENERGY_SUPPORT_CONSULTATION_SCHEDULE"
        );

        details.put(
                "consultationRequestId",
                request.getId()
        );

        details.put(
                "scheduleStatus",
                request.getScheduleStatus().name()
        );

        details.put(
                "consultationDate",
                request.getConsultationDate().toString()
        );

        details.put(
                "availableStartTime",
                request.getAvailableStartTime()
        );

        details.put(
                "availableEndTime",
                request.getAvailableEndTime()
        );

        details.put(
                "consultationMethod",
                request.getConsultationMethod().name()
        );

        String methodLabel =
                request.getConsultationMethod()
                        == EnergySupportConsultationRequest
                        .ConsultationMethod
                        .VISIT
                        ? "방문 상담"
                        : "전화 상담";

        String message =
                "담당 복지사가 "
                        + request.getConsultationDate()
                        + " "
                        + request.getAvailableStartTime()
                        + "부터 "
                        + request.getAvailableEndTime()
                        + "까지 "
                        + methodLabel
                        + "을 요청했습니다.";

        careAlertRepository.save(
                CareAlert.builder()
                        .seniorId(
                                senior.getId()
                        )
                        .guardianId(
                                request.getGuardianId()
                        )
                        .type(
                                CareEvent.EventType
                                        .WELFARE_NOTICE
                        )
                        .severity(
                                CareAlert.Severity
                                        .MEDIUM
                        )
                        .status(
                                CareAlert.AlertStatus
                                        .UNREAD
                        )
                        .title(
                                "에너지복지 상담 일정 확인"
                        )
                        .message(
                                message
                        )
                        .fallDetails(
                                details
                        )
                        .build()
        );
    }


    private void validateSchedule(
            LocalDate consultationDate,
            String startTime,
            String endTime,
            EnergySupportConsultationRequest.ConsultationMethod
                    method
    ) {
        if (consultationDate == null) {
            throw new IllegalArgumentException(
                    "상담 예정일을 입력해 주세요."
            );
        }

        if (consultationDate.isBefore(LocalDate.now())) {
            throw new IllegalArgumentException(
                    "상담 예정일은 오늘 이후로 선택해 주세요."
            );
        }

        if (
                startTime == null
                        || !startTime.matches(
                        "^([01]\\d|2[0-3]):[0-5]\\d$"
                )
        ) {
            throw new IllegalArgumentException(
                    "상담 가능 시작 시간을 확인해 주세요."
            );
        }

        if (
                endTime == null
                        || !endTime.matches(
                        "^([01]\\d|2[0-3]):[0-5]\\d$"
                )
        ) {
            throw new IllegalArgumentException(
                    "상담 가능 종료 시간을 확인해 주세요."
            );
        }

        if (
                !LocalTime.parse(endTime)
                        .isAfter(
                                LocalTime.parse(startTime)
                        )
        ) {
            throw new IllegalArgumentException(
                    "종료 시간은 시작 시간보다 늦어야 합니다."
            );
        }

        if (method == null) {
            throw new IllegalArgumentException(
                    "상담 방식을 선택해 주세요."
            );
        }
    }


    private Senior getSenior(
            Long seniorId
    ) {
        return seniorRepository
                .findById(seniorId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "대상자를 찾을 수 없습니다: "
                                        + seniorId
                        )
                );
    }


    private EnergySupportConsultationRequest
    getRequestEntity(
            Long requestId
    ) {
        return consultationRepository
                .findById(requestId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "상담 요청을 찾을 수 없습니다."
                        )
                );
    }


    private EnergySupportConsultationRequest
    getWorkerRequest(
            Long requestId,
            Long welfareWorkerId
    ) {
        EnergySupportConsultationRequest request =
                getRequestEntity(requestId);

        if (
                !request.getWelfareWorkerId()
                        .equals(welfareWorkerId)
        ) {
            throw new AccessDeniedException(
                    "담당 복지사만 처리할 수 있습니다."
            );
        }

        return request;
    }


    private EnergySupportConsultationRequest
    getGuardianRequest(
            Long requestId,
            Long guardianId
    ) {
        EnergySupportConsultationRequest request =
                getRequestEntity(requestId);

        if (
                !request.getGuardianId()
                        .equals(guardianId)
        ) {
            throw new AccessDeniedException(
                    "연결된 보호자만 상담 일정에 응답할 수 있습니다."
            );
        }

        return request;
    }


    private void validateGuardianAccess(
            Senior senior,
            Long guardianId
    ) {
        if (
                senior.getGuardianId() == null
                        || !senior.getGuardianId()
                        .equals(guardianId)
        ) {
            throw new AccessDeniedException(
                    "연결된 보호자만 상담을 요청할 수 있습니다."
            );
        }
    }


    private List<String> flattenMissingInformation(
            EnergySupportCompletionDto completion
    ) {
        List<String> result =
                new ArrayList<>();

        completion.missingInformation()
                .forEach(
                        (category, items) -> {
                            for (String item : items) {
                                result.add(
                                        category
                                                + ":"
                                                + item
                                );
                            }
                        }
                );

        return result;
    }


    private String normalizeMessage(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String trimmed =
                value.trim();

        return trimmed.isEmpty()
                ? null
                : trimmed;
    }


    private EnergySupportConsultationRequestDto toDto(
            EnergySupportConsultationRequest request,
            Senior senior
    ) {
        List<String> missingInformation =
                request.getMissingInformation() == null
                        || request
                        .getMissingInformation()
                        .isBlank()
                        ? List.of()
                        : List.of(
                        request
                                .getMissingInformation()
                                .split("\\|\\|")
                );

        String guardianDisplayName =
                senior == null
                        ? "보호자"
                        : senior.getName()
                        + " 님 보호자";

        return new EnergySupportConsultationRequestDto(
                request.getId(),
                request.getSeniorId(),
                senior != null
                        ? senior.getName()
                        : null,
                request.getGuardianId(),
                guardianDisplayName,
                request.getWelfareWorkerId(),
                request.getMissingCount(),
                missingInformation,
                request.getRequestMessage(),
                request.getStatus(),
                request.getConsultationDate(),
                request.getAvailableStartTime(),
                request.getAvailableEndTime(),
                request.getConsultationMethod(),
                request.getScheduleStatus(),
                request.getScheduleProposedBy(),
                request.getScheduleMessage(),
                request.getScheduleProposedAt(),
                request.getScheduleRespondedAt(),
                request.getResolvedBy(),
                request.getResolutionNote(),
                request.getResolvedAt(),
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }
}