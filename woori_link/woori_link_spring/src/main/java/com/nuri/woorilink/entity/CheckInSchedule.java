package com.nuri.woorilink.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * 어르신별 자동 안부 확인 기본 설정.
 *
 * 실제 발송 시간 목록은
 * wl_check_in_schedule_times 테이블에서 관리한다.
 */
@Entity
@Table(
        name = "wl_check_in_schedules",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_check_in_schedule_senior",
                        columnNames = "senior_id"
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckInSchedule {

    private static final int DEFAULT_TIMEOUT_MINUTES =
            30;

    private static final String DEFAULT_TIMEZONE =
            "Asia/Seoul";

    @Id
    @GeneratedValue(
            strategy = GenerationType.IDENTITY
    )
    private Long id;

    /**
     * 자동 안부 확인 대상 어르신 ID.
     *
     * 어르신 한 명당 기본 설정은 하나만 저장한다.
     */
    @Column(
            name = "senior_id",
            nullable = false
    )
    private Long seniorId;

    /**
     * 자동 안부 확인 사용 여부.
     */
    @Builder.Default
    @Column(
            name = "enabled",
            nullable = false
    )
    private Boolean enabled = true;

    /**
     * 발송 방식.
     *
     * DIRECT:
     * 보호자가 여러 시간을 직접 지정한다.
     *
     * INTERVAL:
     * 6시간 간격처럼 일정 간격으로 발송한다.
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(
            name = "schedule_mode",
            nullable = false,
            length = 20
    )
    private ScheduleMode scheduleMode =
            ScheduleMode.DIRECT;

    /**
     * INTERVAL 방식에서 사용할 시간 간격.
     *
     * 예:
     * 6시간 간격이면 6
     *
     * DIRECT 방식에서는 null일 수 있다.
     */
    @Column(
            name = "interval_hours"
    )
    private Integer intervalHours;

    /**
     * 요청 후 응답을 기다리는 시간.
     *
     * 각 CheckIn이 생성될 때 이 값을 복사하여 저장한다.
     */
    @Builder.Default
    @Column(
            name = "timeout_minutes",
            nullable = false
    )
    private Integer timeoutMinutes =
            DEFAULT_TIMEOUT_MINUTES;

    /**
     * 자동 요청 시간을 판단할 시간대.
     */
    @Builder.Default
    @Column(
            name = "timezone",
            nullable = false,
            length = 100
    )
    private String timezone =
            DEFAULT_TIMEZONE;

    /*
     * 아래 두 필드는 기존 단일 시간 방식과의 호환을 위해
     * 다중 시간 전환이 끝날 때까지 임시로 유지한다.
     */

    /**
     * 기존 단일 자동 요청 시간.
     *
     * 신규 코드에서는 CheckInScheduleTime을 사용한다.
     */
    @Column(
            name = "request_time",
            nullable = false
    )
    private LocalTime requestTime;

    /**
     * 기존 단일 시간의 마지막 발송 날짜.
     *
     * 신규 코드에서는 각 CheckInScheduleTime의
     * lastSentDate를 사용한다.
     */
    @Column(
            name = "last_sent_date"
    )
    private LocalDate lastSentDate;

    @CreationTimestamp
    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(
            name = "updated_at",
            nullable = false
    )
    private LocalDateTime updatedAt;

    public enum ScheduleMode {
        DIRECT,
        INTERVAL
    }
}