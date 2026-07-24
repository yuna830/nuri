package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergySupportCompletionDto;
import com.nuri.woorilink.dto.EnergySupportConsultationRequestDto;
import com.nuri.woorilink.entity.EnergySupportConsultationRequest;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.EnergySupportConsultationRequestRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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


    /**
     * 보호자가 복지사에게 에너지복지 정보 확인 요청
     */
    @Transactional
    public EnergySupportConsultationRequestDto requestConsultation(
            Long seniorId,
            Long guardianId,
            String requestMessage
    ) {
        Senior senior = seniorRepository
                .findById(seniorId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "대상자를 찾을 수 없습니다: "
                                        + seniorId
                        )
                );

        if (
                senior.getGuardianId() == null
                        || !senior.getGuardianId()
                        .equals(guardianId)
        ) {
            throw new IllegalArgumentException(
                    "연결된 보호자만 상담을 요청할 수 있습니다."
            );
        }

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

        return toDto(
                consultationRepository.save(
                        request
                ),
                senior
        );
    }


    /**
     * 보호자 화면에서 현재 활성 상담 요청 조회
     */
    public EnergySupportConsultationRequestDto
    getActiveRequest(
            Long seniorId
    ) {
        Senior senior = seniorRepository
                .findById(seniorId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "대상자를 찾을 수 없습니다: "
                                        + seniorId
                        )
                );

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
     * 복지사에게 배정된 상담 요청 목록 조회
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
                .map(request -> {
                    Senior senior =
                            seniorRepository
                                    .findById(
                                            request.getSeniorId()
                                    )
                                    .orElse(null);

                    return toDto(
                            request,
                            senior
                    );
                })
                .toList();
    }


    /**
     * 복지사가 상담 요청 처리 시작
     */
    @Transactional
    public EnergySupportConsultationRequestDto
    startConsultation(
            Long requestId,
            Long welfareWorkerId
    ) {
        EnergySupportConsultationRequest request =
                getWorkerRequest(
                        requestId,
                        welfareWorkerId
                );

        if (
                request.getStatus()
                        == EnergySupportConsultationRequest
                        .ConsultationStatus
                        .RESOLVED
        ) {
            throw new IllegalStateException(
                    "이미 처리 완료된 요청입니다."
            );
        }

        request.setStatus(
                EnergySupportConsultationRequest
                        .ConsultationStatus
                        .IN_PROGRESS
        );

        Senior senior =
                seniorRepository
                        .findById(
                                request.getSeniorId()
                        )
                        .orElse(null);

        return toDto(
                consultationRepository.save(
                        request
                ),
                senior
        );
    }


    /**
     * 복지사가 상담 요청 처리 완료
     */
    @Transactional
    public EnergySupportConsultationRequestDto
    resolveConsultation(
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

        Senior senior =
                seniorRepository
                        .findById(
                                request.getSeniorId()
                        )
                        .orElse(null);

        return toDto(
                consultationRepository.save(
                        request
                ),
                senior
        );
    }


    private EnergySupportConsultationRequest
    getWorkerRequest(
            Long requestId,
            Long welfareWorkerId
    ) {
        EnergySupportConsultationRequest request =
                consultationRepository
                        .findById(requestId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "상담 요청을 찾을 수 없습니다."
                                )
                        );

        if (
                !request.getWelfareWorkerId()
                        .equals(welfareWorkerId)
        ) {
            throw new IllegalArgumentException(
                    "담당 복지사만 처리할 수 있습니다."
            );
        }

        return request;
    }


    private List<String> flattenMissingInformation(
            EnergySupportCompletionDto completion
    ) {
        List<String> result =
                new ArrayList<>();

        completion.missingInformation()
                .forEach(
                        (category, items) -> {
                            for (
                                    String item
                                    : items
                            ) {
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


    private EnergySupportConsultationRequestDto
    toDto(
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

        return new EnergySupportConsultationRequestDto(
                request.getId(),
                request.getSeniorId(),
                senior != null
                        ? senior.getName()
                        : null,
                request.getGuardianId(),
                request.getWelfareWorkerId(),
                request.getMissingCount(),
                missingInformation,
                request.getRequestMessage(),
                request.getStatus(),
                request.getResolvedBy(),
                request.getResolutionNote(),
                request.getResolvedAt(),
                request.getCreatedAt(),
                request.getUpdatedAt()
        );
    }
}