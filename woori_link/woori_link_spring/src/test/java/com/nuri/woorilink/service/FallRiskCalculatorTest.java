package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.CareEvent;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FallRiskCalculatorTest {

    private final LocalDateTime now = LocalDateTime.of(2026, 7, 19, 15, 0);

    @Test
    void detectedFallAddsCurrentRiskAndDelay() {
        FallRiskCalculator.Result result = FallRiskCalculator.calculate(
                List.of(event(
                        CareEvent.EventType.FALL_DETECTED,
                        CareEvent.EventStatus.PENDING,
                        now.minusMinutes(35)
                )),
                now
        );

        assertThat(result.actualRiskScore()).isEqualTo(50);
        assertThat(result.delayScore()).isEqualTo(20);
        assertThat(result.actionableRisk()).isTrue();
    }

    @Test
    void suspectedFallIsNotActionableAndHasNoDelay() {
        FallRiskCalculator.Result result = FallRiskCalculator.calculate(
                List.of(event(
                        CareEvent.EventType.FALL_SUSPECTED,
                        CareEvent.EventStatus.PENDING,
                        now.minusMinutes(70)
                )),
                now
        );

        assertThat(result.actualRiskScore()).isEqualTo(20);
        assertThat(result.delayScore()).isZero();
        assertThat(result.actionableRisk()).isFalse();
    }

    @Test
    void resolvedFallMovesToHistoryWithoutCurrentScore() {
        FallRiskCalculator.Result result = FallRiskCalculator.calculate(
                List.of(event(
                        CareEvent.EventType.FALL_DETECTED,
                        CareEvent.EventStatus.RESOLVED,
                        now.minusDays(45)
                )),
                now
        );

        assertThat(result.actualRiskScore()).isZero();
        assertThat(result.delayScore()).isZero();
        assertThat(result.historyScore()).isEqualTo(5);
    }

    @Test
    void falseAlarmAndSafetyConfirmationScoreZero() {
        FallRiskCalculator.Result result = FallRiskCalculator.calculate(
                List.of(
                        event(CareEvent.EventType.FALL_DETECTED, CareEvent.EventStatus.FALSE_ALARM, now.minusDays(2)),
                        event(CareEvent.EventType.FALL_DETECTED, CareEvent.EventStatus.SAFETY_CONFIRMED, now.minusMinutes(20))
                ),
                now
        );

        assertThat(result.actualRiskScore()).isZero();
        assertThat(result.delayScore()).isZero();
        assertThat(result.historyScore()).isZero();
    }

    @Test
    void eventsWithinTenMinutesUseOnlyHighestIncidentScore() {
        FallRiskCalculator.Result result = FallRiskCalculator.calculate(
                List.of(
                        event(CareEvent.EventType.FALL_SUSPECTED, CareEvent.EventStatus.PENDING, now.minusMinutes(8)),
                        event(CareEvent.EventType.FALL_DETECTED, CareEvent.EventStatus.PENDING, now.minusMinutes(5))
                ),
                now
        );

        assertThat(result.actualRiskScore()).isEqualTo(50);
    }

    @Test
    void fallAndSosWithinTenMinutesAreOneIncident() {
        FallRiskCalculator.Result result = FallRiskCalculator.calculate(
                List.of(
                        event(CareEvent.EventType.SOS, CareEvent.EventStatus.PENDING, now.minusMinutes(8)),
                        event(CareEvent.EventType.FALL_DETECTED, CareEvent.EventStatus.PENDING, now.minusMinutes(5))
                ),
                now
        );

        assertThat(result.actualRiskScore()).isEqualTo(50);
        assertThat(result.actionableRisk()).isTrue();
    }

    @Test
    void activeSosIsAnActionableRisk() {
        FallRiskCalculator.Result result = FallRiskCalculator.calculate(
                List.of(event(
                        CareEvent.EventType.SOS,
                        CareEvent.EventStatus.PENDING,
                        now.minusMinutes(3)
                )),
                now
        );

        assertThat(result.actualRiskScore()).isEqualTo(50);
        assertThat(result.delayScore()).isZero();
        assertThat(result.actionableRisk()).isTrue();
    }

    @Test
    void incidentsMoreThanTenMinutesApartAreScoredSeparately() {
        FallRiskCalculator.Result result = FallRiskCalculator.calculate(
                List.of(
                        event(CareEvent.EventType.SOS, CareEvent.EventStatus.PENDING, now.minusMinutes(25)),
                        event(CareEvent.EventType.FALL_DETECTED, CareEvent.EventStatus.PENDING, now.minusMinutes(5))
                ),
                now
        );

        assertThat(result.actualRiskScore()).isEqualTo(100);
    }

    private CareEvent event(
            CareEvent.EventType type,
            CareEvent.EventStatus status,
            LocalDateTime occurredAt
    ) {
        return CareEvent.builder()
                .type(type)
                .status(status)
                .occurredAt(occurredAt)
                .build();
    }
}
