package com.nuri.woori.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "job_matching_feedback")
public class JobMatchingFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private String label;
    private String source;

    private String jobId;
    private String title;
    private String organization;
    private String jobType;
    private String workEnvironment;
    private String physicalIntensity;
    private String dailyHours;
    private String commuteLevel;
    private Boolean closed;

    @Column(columnDefinition = "TEXT")
    private String taskTags;

    @Column(columnDefinition = "TEXT")
    private String workDays;

    @Column(columnDefinition = "TEXT")
    private String workCondition;

    private Integer ruleScore;
    private String ruleGrade;
    private String mlPrediction;
    private Integer mlScore;

    @Column(columnDefinition = "TEXT")
    private String mlProbabilitiesJson;

    private String healthStatus;
    private String medicineCount;
    private String walkingAid;
    private String recentFall;
    private String maxHours;
    private String maxDistance;

    @Column(columnDefinition = "TEXT")
    private String disabledWork;

    @Column(columnDefinition = "TEXT")
    private String diseaseText;

    @Column(columnDefinition = "TEXT")
    private String hopeJobType;

    @Column(columnDefinition = "TEXT")
    private String hopeCondition;

    private LocalDateTime createdAt = LocalDateTime.now();
}
