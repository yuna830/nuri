package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.CareEvent;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

final class FallRiskCalculator {

    private static final long DUPLICATE_WINDOW_MINUTES = 10;

    private FallRiskCalculator() {
    }

    static Result calculate(List<CareEvent> events, LocalDateTime now) {
        List<List<CareEvent>> incidents = groupIncidents(events);
        int actualRiskScore = 0;
        int delayScore = 0;
        int historyScore = 0;
        boolean actionableRisk = false;
        boolean activeDetectedFall = false;
        boolean activeSos = false;

        for (List<CareEvent> incident : incidents) {
            int incidentActualScore = 0;
            int incidentDelayScore = 0;
            int incidentHistoryScore = 0;
            boolean incidentActionable = false;

            for (CareEvent event : incident) {
                if (isActive(event)) {
                    if (event.getType() == CareEvent.EventType.FALL_DETECTED
                            || event.getType() == CareEvent.EventType.SOS) {
                        incidentActualScore = Math.max(incidentActualScore, 50);
                        if (event.getType() == CareEvent.EventType.FALL_DETECTED) {
                            activeDetectedFall = true;
                            incidentDelayScore = Math.max(
                                    incidentDelayScore,
                                    delayScore(event.getOccurredAt(), now)
                            );
                        } else {
                            activeSos = true;
                        }
                        incidentActionable = true;
                    } else if (event.getType() == CareEvent.EventType.FALL_SUSPECTED) {
                        incidentActualScore = Math.max(incidentActualScore, 20);
                    }
                } else if (isResolvedFall(event)) {
                    incidentHistoryScore = Math.max(
                            incidentHistoryScore,
                            historyScore(event.getOccurredAt(), now)
                    );
                }
            }

            if (incidentActualScore > 0) {
                incidentHistoryScore = 0;
            }

            actualRiskScore += incidentActualScore;
            delayScore += incidentDelayScore;
            historyScore += incidentHistoryScore;
            actionableRisk = actionableRisk || incidentActionable;
        }

        return new Result(
                actualRiskScore,
                Math.min(delayScore, 40),
                Math.min(historyScore, 25),
                actionableRisk,
                activeDetectedFall,
                activeSos
        );
    }

    private static List<List<CareEvent>> groupIncidents(List<CareEvent> events) {
        List<CareEvent> falls = events.stream()
                .filter(FallRiskCalculator::isRiskIncident)
                .filter(event -> event.getOccurredAt() != null)
                .sorted(Comparator.comparing(CareEvent::getOccurredAt))
                .toList();
        List<List<CareEvent>> incidents = new ArrayList<>();

        for (CareEvent event : falls) {
            if (incidents.isEmpty()) {
                incidents.add(new ArrayList<>(List.of(event)));
                continue;
            }

            List<CareEvent> latestIncident = incidents.get(incidents.size() - 1);
            LocalDateTime latestTime = latestIncident.get(latestIncident.size() - 1).getOccurredAt();
            long minutes = ChronoUnit.MINUTES.between(latestTime, event.getOccurredAt());

            if (minutes <= DUPLICATE_WINDOW_MINUTES) {
                latestIncident.add(event);
            } else {
                incidents.add(new ArrayList<>(List.of(event)));
            }
        }

        return incidents;
    }

    private static boolean isFall(CareEvent event) {
        return event.getType() == CareEvent.EventType.FALL_DETECTED
                || event.getType() == CareEvent.EventType.FALL_SUSPECTED;
    }

    private static boolean isRiskIncident(CareEvent event) {
        return isFall(event) || event.getType() == CareEvent.EventType.SOS;
    }

    private static boolean isActive(CareEvent event) {
        return event.getStatus() == CareEvent.EventStatus.PENDING
                || event.getStatus() == CareEvent.EventStatus.CONFIRMED;
    }

    private static boolean isResolvedFall(CareEvent event) {
        return event.getType() == CareEvent.EventType.FALL_DETECTED
                && event.getStatus() == CareEvent.EventStatus.RESOLVED;
    }

    private static int delayScore(LocalDateTime occurredAt, LocalDateTime now) {
        if (occurredAt == null || !occurredAt.isBefore(now)) {
            return 0;
        }

        long minutes = Duration.between(occurredAt, now).toMinutes();
        if (minutes >= 60) {
            return 40;
        }
        if (minutes >= 30) {
            return 20;
        }
        if (minutes >= 10) {
            return 10;
        }
        return 0;
    }

    private static int historyScore(LocalDateTime occurredAt, LocalDateTime now) {
        if (occurredAt == null || occurredAt.isAfter(now)) {
            return 0;
        }

        long days = ChronoUnit.DAYS.between(occurredAt.toLocalDate(), now.toLocalDate());
        if (days <= 30) {
            return 10;
        }
        if (days <= 90) {
            return 5;
        }
        return 0;
    }

    record Result(
            int actualRiskScore,
            int delayScore,
            int historyScore,
            boolean actionableRisk,
            boolean activeDetectedFall,
            boolean activeSos
    ) {
    }
}
