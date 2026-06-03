package com.nuri.woori.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "senior_activity_snapshots")
public class SeniorActivitySnapshot {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private LocalDate snapshotDate;

    @Column(columnDefinition = "TEXT")
    private String baselineJson;

    @Column(columnDefinition = "TEXT")
    private String fallPatternJson;

    @Column(columnDefinition = "TEXT")
    private String activityTodayJson;

    @Column(columnDefinition = "TEXT")
    private String activitySlotsJson;

    @Column(columnDefinition = "TEXT")
    private String activityTrendJson;

    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSeniorId() { return seniorId; }
    public void setSeniorId(Long seniorId) { this.seniorId = seniorId; }

    public LocalDate getSnapshotDate() { return snapshotDate; }
    public void setSnapshotDate(LocalDate snapshotDate) { this.snapshotDate = snapshotDate; }

    public String getBaselineJson() { return baselineJson; }
    public void setBaselineJson(String baselineJson) { this.baselineJson = baselineJson; }

    public String getFallPatternJson() { return fallPatternJson; }
    public void setFallPatternJson(String fallPatternJson) { this.fallPatternJson = fallPatternJson; }

    public String getActivityTodayJson() { return activityTodayJson; }
    public void setActivityTodayJson(String activityTodayJson) { this.activityTodayJson = activityTodayJson; }

    public String getActivitySlotsJson() { return activitySlotsJson; }
    public void setActivitySlotsJson(String activitySlotsJson) { this.activitySlotsJson = activitySlotsJson; }

    public String getActivityTrendJson() { return activityTrendJson; }
    public void setActivityTrendJson(String activityTrendJson) { this.activityTrendJson = activityTrendJson; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
