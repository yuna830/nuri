package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.CheckInAnalysisRecordRequest;
import com.nuri.woorilink.dto.CheckInAnalysisRequest;
import com.nuri.woorilink.dto.CheckInAnalysisResponse;
import com.nuri.woorilink.entity.CheckIn;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.CheckInRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * 보호자의 권한을 검증하고,
 * 최근 안부 기록을 조회해 FastAPI에 전달한다.
 *
 * 통계 계산과 위험 판정은 FastAPI가 담당한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CheckInAnalysisService {

    private static final int ANALYSIS_PERIOD_DAYS = 7;

    private final CheckInRepository checkInRepository;

    private final SeniorRepository seniorRepository;

    private final CheckInAnalysisAiClient checkInAnalysisAiClient;

    /**
     * 최근 7일 안부 기록을 FastAPI로 전달하고
     * 분석 결과를 반환한다.
     */
    public CheckInAnalysisResponse analyze(
            Long seniorId,
            Long guardianId
    ) {
        if (seniorId == null) {
            throw new IllegalArgumentException(
                    "Senior ID is required"
            );
        }

        if (guardianId == null) {
            throw new AccessDeniedException(
                    "Guardian authentication is required"
            );
        }

        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Senior not found: " + seniorId
                        )
                );

        validateGuardianAccess(
                senior,
                guardianId
        );

        LocalDateTime periodEnd =
                LocalDateTime.now();

        LocalDateTime periodStart =
                periodEnd.minusDays(
                        ANALYSIS_PERIOD_DAYS
                );

        List<CheckIn> checkIns =
                checkInRepository
                        .findBySeniorIdAndRequestedAtGreaterThanEqualOrderByRequestedAtDesc(
                                seniorId,
                                periodStart
                        );

        List<CheckInAnalysisRecordRequest> records =
                checkIns.stream()
                        .map(this::toAnalysisRecord)
                        .toList();

        CheckInAnalysisRequest request =
                new CheckInAnalysisRequest(
                        seniorId,
                        ANALYSIS_PERIOD_DAYS,
                        periodStart,
                        periodEnd,
                        records
                );

        log.info(
                "Sending check-in analysis to FastAPI. seniorId={}, guardianId={}, recordCount={}",
                seniorId,
                guardianId,
                records.size()
        );

        CheckInAnalysisResponse response =
                checkInAnalysisAiClient.analyze(
                        request
                );

        log.info(
                "Check-in analysis completed. seniorId={}, riskLevel={}, summarySource={}",
                seniorId,
                response.riskLevel(),
                response.summarySource()
        );

        return response;
    }

    /**
     * FastAPI에 전달할 안부 기록 DTO로 변환한다.
     */
    private CheckInAnalysisRecordRequest toAnalysisRecord(
            CheckIn checkIn
    ) {
        return new CheckInAnalysisRecordRequest(
                checkIn.getId(),

                checkIn.getStatus() == null
                        ? null
                        : checkIn.getStatus().name(),

                checkIn.getRequestedAt(),

                checkIn.getRespondedAt()
        );
    }

    /**
     * 로그인한 보호자가 해당 님과 연결되어 있는지 확인한다.
     */
    private void validateGuardianAccess(
            Senior senior,
            Long authenticatedGuardianId
    ) {
        Long seniorGuardianId =
                senior.getGuardianId();

        if (!Objects.equals(
                seniorGuardianId,
                authenticatedGuardianId
        )) {
            log.warn(
                    "Check-in analysis access denied. seniorId={}, seniorGuardianId={}, authenticatedGuardianId={}",
                    senior.getId(),
                    seniorGuardianId,
                    authenticatedGuardianId
            );

            throw new AccessDeniedException(
                    "You can only analyze your assigned senior"
            );
        }

        log.info(
                "Check-in analysis access granted. seniorId={}, guardianId={}",
                senior.getId(),
                authenticatedGuardianId
        );
    }
}