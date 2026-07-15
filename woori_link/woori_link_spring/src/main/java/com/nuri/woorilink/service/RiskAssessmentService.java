package com.nuri.woorilink.service;

import com.nuri.woorilink.common.client.WeatherAlertApiClient;
import com.nuri.woorilink.dto.RiskAssessmentDto;
import com.nuri.woorilink.entity.ActionRecord;
import com.nuri.woorilink.entity.RegisteredProduct;
import com.nuri.woorilink.entity.RiskAssessment;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.entity.VisitSchedule;
import com.nuri.woorilink.repository.ActionRecordRepository;
import com.nuri.woorilink.repository.RegisteredProductRepository;
import com.nuri.woorilink.repository.RiskAssessmentRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import com.nuri.woorilink.repository.VisitScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RiskAssessmentService {

    private final RiskAssessmentRepository riskRepository;
    private final SeniorRepository seniorRepository;
    private final RegisteredProductRepository productRepository;
    private final ActionRecordRepository actionRepository;
    private final VisitScheduleRepository visitRepository;
    private final WeatherAlertApiClient weatherAlertApiClient;

    public Optional<RiskAssessmentDto> getLatest(Long seniorId) {
        return riskRepository.findTopBySeniorIdOrderByAssessedAtDesc(seniorId).map(this::toDto);
    }

    public List<RiskAssessmentDto> getHighRisk() {
        return riskRepository.findLatestByLevel(RiskAssessment.RiskLevel.HIGH).stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public RiskAssessmentDto assess(Long seniorId) {
        Senior senior = seniorRepository.findById(seniorId)
                .orElseThrow(() -> new IllegalArgumentException("대상자를 찾을 수 없습니다: " + seniorId));

        List<RegisteredProduct> products = productRepository.findBySeniorId(seniorId);
        List<ActionRecord> actions = actionRepository.findBySeniorId(seniorId);
        List<VisitSchedule> visits = visitRepository.findBySeniorId(seniorId);

        List<RegisteredProduct> unresolvedRecalledProducts = products.stream()
                .filter(product -> product.getRecallStatus() == RegisteredProduct.RecallStatus.RECALLED)
                .filter(product -> !isRecallActionCompleted(product, actions))
                .toList();
        boolean recallRisk = unresolvedRecalledProducts.stream()
                .anyMatch(product -> product.getCurrentUseStatus() == RegisteredProduct.CurrentUseStatus.IN_USE);
        boolean recallUsageUnknown = !recallRisk && unresolvedRecalledProducts.stream()
                .anyMatch(product -> product.getCurrentUseStatus() == null
                        || product.getCurrentUseStatus() == RegisteredProduct.CurrentUseStatus.UNKNOWN);
        boolean weatherRisk = weatherAlertApiClient.hasWeatherAlert(senior.getAddress());
        List<ActionRecord> pendingActions = actions.stream().filter(this::isPending).toList();
        boolean safetyRisk = pendingActions.stream()
                .anyMatch(action -> isSafetyAction(action) && Boolean.TRUE.equals(action.getImmediateRisk()));
        boolean safetyInspectionOverdue = pendingActions.stream()
                .anyMatch(action -> isSafetyAction(action) && isPastDue(action));
        long maxActionOverdueDays = getMaxActionOverdueDays(pendingActions);
        boolean overdueAction = maxActionOverdueDays >= 7;
        boolean delayedVisit = visits.stream().anyMatch(this::isVisitDelayed);
        boolean repeatedIssue = hasRepeatedPendingIssue(actions);
        boolean aiNoResponse = senior.getAiCheckStatus() == Senior.FeatureStatus.ACTIVE
                && Boolean.TRUE.equals(senior.getAiConsecutiveNoResponse())
                && !Boolean.TRUE.equals(senior.getAiCheckResolved());
        boolean locationAnomaly = senior.getLocationStatus() == Senior.FeatureStatus.ACTIVE
                && Boolean.TRUE.equals(senior.getUnresolvedGeofenceExit())
                && !Boolean.TRUE.equals(senior.getLocationEventResolved());
        boolean livingAlone = Boolean.TRUE.equals(senior.getLivingAlone());
        boolean guardianMissing = senior.getGuardianId() == null;
        boolean longTermCare = Boolean.TRUE.equals(senior.getLongTermCare());
        boolean severeDisability = isSevereDisability(senior.getDisabilityGrade());
        boolean voucherUnapplied = Boolean.TRUE.equals(senior.getEnergyVoucherEligible())
                && !Boolean.TRUE.equals(senior.getEnergyVoucherApplied());
        boolean discountUnapplied =
                (Boolean.TRUE.equals(senior.getElectricityDiscountEligible())
                        && !Boolean.TRUE.equals(senior.getElectricityDiscountApplied()))
                || (Boolean.TRUE.equals(senior.getGasDiscountEligible())
                        && !Boolean.TRUE.equals(senior.getGasDiscountApplied()));

        List<String> reasons = new ArrayList<>();

        int actualRiskScore = 0;
        if (recallRisk) {
            actualRiskScore += 30;
            reasons.add("사용 중인 미조치 리콜 제품");
        } else if (recallUsageUnknown) {
            actualRiskScore += 20;
            reasons.add("리콜 제품 사용 여부 미확인");
        }
        if (weatherRisk) {
            actualRiskScore += 20;
            reasons.add("심각한 지역 기상위험");
        }
        if (safetyRisk) {
            actualRiskScore += 25;
            reasons.add("전기·가스 즉시 개선 항목");
        }
        if (safetyInspectionOverdue) {
            actualRiskScore += 10;
            reasons.add("전기·가스 안전점검 미완료");
        }
        if (aiNoResponse) {
            actualRiskScore += 30;
            reasons.add("AI 안부 확인 연속 미응답");
        }
        if (locationAnomaly) {
            actualRiskScore += 20;
            reasons.add("안전반경 이탈 후 상태 미확인");
        }

        int delayScore = calculateActionDelayScore(maxActionOverdueDays);
        if (delayScore > 0) {
            reasons.add("조치 예정일 " + maxActionOverdueDays + "일 초과");
        }
        if (delayedVisit) {
            delayScore += 15;
            reasons.add("예정 방문·상담 7일 이상 지연");
        }
        if (repeatedIssue) {
            delayScore += 10;
            reasons.add("최근 30일 내 동일 미처리 문제 반복");
        }
        delayScore = Math.min(delayScore, 40);

        int vulnerabilityScore = 0;
        if (livingAlone) {
            vulnerabilityScore += 10;
            reasons.add("독거 가구");
        }
        if (guardianMissing) {
            vulnerabilityScore += 10;
            reasons.add("보호자 미등록");
        }
        if (longTermCare) {
            vulnerabilityScore += 10;
            reasons.add("장기요양 대상");
        }
        if (severeDisability) {
            vulnerabilityScore += 10;
            reasons.add("중증 장애");
        }
        if (voucherUnapplied) {
            vulnerabilityScore += 5;
            reasons.add("에너지바우처 대상 미신청");
        }
        if (discountUnapplied) {
            vulnerabilityScore += 5;
            reasons.add("전기·가스요금 복지할인 대상 미신청");
        }
        vulnerabilityScore = Math.min(vulnerabilityScore, 25);

        int totalScore = actualRiskScore
                + Math.min(delayScore, 40)
                + Math.min(vulnerabilityScore, 25);
        boolean hasActionableRisk = recallRisk || weatherRisk || safetyRisk
                || overdueAction || delayedVisit || aiNoResponse || locationAnomaly;
        RiskAssessment.RiskLevel level = totalScore >= 50 && hasActionableRisk
                ? RiskAssessment.RiskLevel.HIGH
                : totalScore >= 20 ? RiskAssessment.RiskLevel.MEDIUM : RiskAssessment.RiskLevel.LOW;

        RiskAssessment saved = riskRepository.save(RiskAssessment.builder()
                .seniorId(seniorId)
                .totalScore(totalScore)
                .level(level)
                .weatherRisk(weatherRisk)
                .recallRisk(recallRisk)
                .recallUsageUnknown(recallUsageUnknown)
                .safetyRisk(safetyRisk)
                .safetyInspectionOverdue(safetyInspectionOverdue)
                .overdueAction(overdueAction)
                .delayedVisit(delayedVisit)
                .repeatedIssue(repeatedIssue)
                .aiNoResponse(aiNoResponse)
                .locationAnomaly(locationAnomaly)
                .livingAlone(livingAlone)
                .guardianMissing(guardianMissing)
                .longTermCare(longTermCare)
                .severeDisability(severeDisability)
                .voucherUnapplied(voucherUnapplied)
                .discountUnapplied(discountUnapplied)
                .actualRiskScore(actualRiskScore)
                .delayScore(delayScore)
                .vulnerabilityScore(vulnerabilityScore)
                .riskReason(reasons.isEmpty() ? "확인 필요 항목 없음" : String.join(" + ", reasons))
                .build());

        return toDto(saved, senior);
    }

    @Transactional
    public void assessAll() {
        seniorRepository.findAll().forEach(senior -> assess(senior.getId()));
    }

    private RiskAssessmentDto toDto(RiskAssessment assessment) {
        Senior senior = seniorRepository.findById(assessment.getSeniorId()).orElse(null);
        return toDto(assessment, senior);
    }

    private RiskAssessmentDto toDto(RiskAssessment assessment, Senior senior) {
        boolean guardianMissing = senior != null
                ? senior.getGuardianId() == null
                : Boolean.TRUE.equals(assessment.getGuardianMissing());

        int actualRiskScore = 0;
        if (Boolean.TRUE.equals(assessment.getRecallRisk())) {
            actualRiskScore += 30;
        } else if (Boolean.TRUE.equals(assessment.getRecallUsageUnknown())) {
            actualRiskScore += 20;
        }
        actualRiskScore += Boolean.TRUE.equals(assessment.getWeatherRisk()) ? 20 : 0;
        actualRiskScore += Boolean.TRUE.equals(assessment.getSafetyRisk()) ? 25 : 0;
        actualRiskScore += Boolean.TRUE.equals(assessment.getSafetyInspectionOverdue()) ? 10 : 0;
        actualRiskScore += Boolean.TRUE.equals(assessment.getAiNoResponse()) ? 30 : 0;
        actualRiskScore += Boolean.TRUE.equals(assessment.getLocationAnomaly()) ? 20 : 0;

        int delayScore = assessment.getDelayScore() != null
                ? Math.min(assessment.getDelayScore(), 40)
                : Math.min(
                        (Boolean.TRUE.equals(assessment.getOverdueAction()) ? 10 : 0)
                                + (Boolean.TRUE.equals(assessment.getDelayedVisit()) ? 15 : 0)
                                + (Boolean.TRUE.equals(assessment.getRepeatedIssue()) ? 10 : 0),
                        40
                );

        int vulnerabilityScore = 0;
        vulnerabilityScore += Boolean.TRUE.equals(assessment.getLivingAlone()) ? 10 : 0;
        vulnerabilityScore += guardianMissing ? 10 : 0;
        vulnerabilityScore += Boolean.TRUE.equals(assessment.getLongTermCare()) ? 10 : 0;
        vulnerabilityScore += Boolean.TRUE.equals(assessment.getSevereDisability()) ? 10 : 0;
        vulnerabilityScore += Boolean.TRUE.equals(assessment.getVoucherUnapplied()) ? 5 : 0;
        vulnerabilityScore += Boolean.TRUE.equals(assessment.getDiscountUnapplied()) ? 5 : 0;
        vulnerabilityScore = Math.min(vulnerabilityScore, 25);

        int totalScore = actualRiskScore + Math.min(delayScore, 40) + Math.min(vulnerabilityScore, 25);
        boolean hasActionableRisk = Boolean.TRUE.equals(assessment.getRecallRisk())
                || Boolean.TRUE.equals(assessment.getWeatherRisk())
                || Boolean.TRUE.equals(assessment.getSafetyRisk())
                || Boolean.TRUE.equals(assessment.getOverdueAction())
                || Boolean.TRUE.equals(assessment.getDelayedVisit())
                || Boolean.TRUE.equals(assessment.getAiNoResponse())
                || Boolean.TRUE.equals(assessment.getLocationAnomaly());
        RiskAssessment.RiskLevel level = totalScore >= 50 && hasActionableRisk
                ? RiskAssessment.RiskLevel.HIGH
                : totalScore >= 20 ? RiskAssessment.RiskLevel.MEDIUM : RiskAssessment.RiskLevel.LOW;

        return RiskAssessmentDto.builder()
                .id(assessment.getId())
                .seniorId(assessment.getSeniorId())
                .seniorName(senior != null ? senior.getName() : null)
                .seniorAge(senior != null ? senior.getAge() : null)
                .totalScore(totalScore)
                .level(level)
                .weatherRisk(assessment.getWeatherRisk())
                .recallRisk(assessment.getRecallRisk())
                .recallUsageUnknown(assessment.getRecallUsageUnknown())
                .safetyRisk(assessment.getSafetyRisk())
                .safetyInspectionOverdue(assessment.getSafetyInspectionOverdue())
                .overdueAction(assessment.getOverdueAction())
                .delayedVisit(assessment.getDelayedVisit())
                .repeatedIssue(assessment.getRepeatedIssue())
                .aiNoResponse(assessment.getAiNoResponse())
                .locationAnomaly(assessment.getLocationAnomaly())
                .livingAlone(assessment.getLivingAlone())
                .guardianMissing(guardianMissing)
                .longTermCare(assessment.getLongTermCare())
                .severeDisability(assessment.getSevereDisability())
                .voucherUnapplied(assessment.getVoucherUnapplied())
                .discountUnapplied(assessment.getDiscountUnapplied())
                .actualRiskScore(actualRiskScore)
                .delayScore(delayScore)
                .vulnerabilityScore(vulnerabilityScore)
                .riskReason(assessment.getRiskReason())
                .assessedAt(assessment.getAssessedAt())
                .build();
    }

    private boolean isRecallActionCompleted(RegisteredProduct product, List<ActionRecord> actions) {
        return actions.stream().anyMatch(action ->
                action.getActionType() == ActionRecord.ActionType.RECALL
                        && action.getStatus() == ActionRecord.ActionStatus.COMPLETED
                        && (action.getProductName() == null
                        || Objects.equals(action.getProductName(), product.getProductName())));
    }

    private boolean isVisitDelayed(VisitSchedule visit) {
        return visit.getStatus() == VisitSchedule.VisitStatus.PLANNED
                && visit.getVisitDate() != null
                && !visit.getVisitDate().isAfter(LocalDate.now().minusDays(7));
    }

    private boolean isPending(ActionRecord action) {
        return action.getStatus() == ActionRecord.ActionStatus.PENDING
                || action.getStatus() == ActionRecord.ActionStatus.IN_PROGRESS;
    }

    private boolean isSafetyAction(ActionRecord action) {
        return action.getActionType() == ActionRecord.ActionType.GAS_CHECK
                || action.getActionType() == ActionRecord.ActionType.ELECTRIC_CHECK;
    }

    private boolean isPastDue(ActionRecord action) {
        return action.getDueDate() != null && action.getDueDate().isBefore(LocalDate.now());
    }

    private long getMaxActionOverdueDays(List<ActionRecord> actions) {
        return actions.stream()
                .filter(this::isPastDue)
                .mapToLong(action -> ChronoUnit.DAYS.between(action.getDueDate(), LocalDate.now()))
                .max()
                .orElse(0);
    }

    private int calculateActionDelayScore(long overdueDays) {
        if (overdueDays >= 14) return 20;
        if (overdueDays >= 7) return 10;
        if (overdueDays >= 1) return 5;
        return 0;
    }

    private boolean hasRepeatedPendingIssue(List<ActionRecord> actions) {
        LocalDateTime since = LocalDateTime.now().minusDays(30);
        return actions.stream()
                .filter(action -> action.getActionType() != null)
                .filter(action -> action.getStatus() == ActionRecord.ActionStatus.PENDING
                        || action.getStatus() == ActionRecord.ActionStatus.IN_PROGRESS)
                .filter(action -> action.getCreatedAt() != null && !action.getCreatedAt().isBefore(since))
                .collect(Collectors.groupingBy(ActionRecord::getActionType, Collectors.counting()))
                .values().stream()
                .anyMatch(count -> count >= 2);
    }

    private boolean isSevereDisability(String disabilityGrade) {
        if (disabilityGrade == null || disabilityGrade.isBlank()) {
            return false;
        }
        String normalized = disabilityGrade.trim().toUpperCase(Locale.ROOT);
        return normalized.contains("중증")
                || normalized.contains("장애의 정도가 심한")
                || normalized.contains("SEVERE");
    }
}
