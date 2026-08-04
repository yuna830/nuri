package com.nuri.woorilink.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "wl_recall_follow_up_overdue_alerts",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_recall_overdue_alert_product",
                        columnNames = "registered_product_id"
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecallFollowUpOverdueAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 기한이 초과된 등록 제품 ID입니다.
     *
     * 하나의 제품에는 활성·해결 여부와 관계없이
     * 하나의 기한 초과 알림 기록만 유지합니다.
     */
    @Column(
            name = "registered_product_id",
            nullable = false
    )
    private Long registeredProductId;

    @Column(nullable = false)
    private Long seniorId;

    @Column(nullable = false)
    private Long welfareWorkerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertSeverity severity;

    /**
     * 현재 기준 며칠 기한이 초과되었는지 저장합니다.
     */
    @Column(nullable = false)
    private Integer overdueDays;

    /**
     * 최초로 기한 초과를 감지한 시각입니다.
     */
    @Column(nullable = false)
    private LocalDateTime firstDetectedAt;

    /**
     * 마지막으로 반복 알림을 갱신한 시각입니다.
     */
    private LocalDateTime lastRemindedAt;

    /**
     * 최초 알림 이후 반복 갱신된 횟수입니다.
     *
     * 최초 생성 시 0,
     * 다음 날에도 미처리 상태라면 1이 됩니다.
     */
    @Column(nullable = false)
    private Integer reminderCount;

    /**
     * 후속조치가 완료되어 알림이 종료된 시각입니다.
     */
    private LocalDateTime resolvedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now =
                LocalDateTime.now();

        if (status == null) {
            status =
                    AlertStatus.ACTIVE;
        }

        if (severity == null) {
            severity =
                    AlertSeverity.MEDIUM;
        }

        if (overdueDays == null) {
            overdueDays = 1;
        }

        if (reminderCount == null) {
            reminderCount = 0;
        }

        if (firstDetectedAt == null) {
            firstDetectedAt = now;
        }

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt =
                LocalDateTime.now();
    }

    public enum AlertStatus {
        ACTIVE,
        RESOLVED
    }

    public enum AlertSeverity {
        MEDIUM,
        HIGH
    }
}