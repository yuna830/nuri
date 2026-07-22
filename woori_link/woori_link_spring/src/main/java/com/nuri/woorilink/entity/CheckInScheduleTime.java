package com.nuri.woorilink.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * 자동 안부 확인의 개별 발송 시간.
 *
 * 하나의 CheckInSchedule에 여러 시간이 연결될 수 있다.
 *
 * 예:
 * scheduleId = 1, requestTime = 09:00
 * scheduleId = 1, requestTime = 12:00
 * scheduleId = 1, requestTime = 18:00
 */
@Entity
@Table(
        name = "wl_check_in_schedule_times",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_check_in_schedule_time",
                        columnNames = {
                                "schedule_id",
                                "request_time"
                        }
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckInScheduleTime {

    @Id
    @GeneratedValue(
            strategy = GenerationType.IDENTITY
    )
    private Long id;

    /**
     * wl_check_in_schedules의 ID.
     *
     * JPA 연관관계 대신 ID만 저장하여
     * 저장 및 삭제 로직을 단순하게 유지한다.
     */
    @Column(
            name = "schedule_id",
            nullable = false
    )
    private Long scheduleId;

    /**
     * 자동 안부 요청 발송 시간.
     */
    @Column(
            name = "request_time",
            nullable = false
    )
    private LocalTime requestTime;

    /**
     * 해당 시간으로 마지막 자동 요청을 발송한 날짜.
     *
     * 같은 날짜의 같은 시간에
     * 중복 요청이 생성되는 것을 방지한다.
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
}