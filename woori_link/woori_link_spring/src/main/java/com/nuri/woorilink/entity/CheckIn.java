package com.nuri.woorilink.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "wl_check_ins")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CheckIn {

    private static final int DEFAULT_TIMEOUT_MINUTES =
            30;

    @Id
    @GeneratedValue(
            strategy = GenerationType.IDENTITY
    )
    private Long id;

    /**
     * 안부 요청 대상 어르신 ID.
     */
    @Column(
            name = "senior_id",
            nullable = false
    )
    private Long seniorId;

    /**
     * 안부 요청 처리 상태.
     */
    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 20
    )
    private Status status;

    /**
     * 보호자 수동 요청인지
     * 시스템 자동 요청인지 구분한다.
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(
            name = "request_type",
            nullable = false,
            length = 20
    )
    private RequestType requestType =
            RequestType.MANUAL;

    /**
     * 자동 요청이 예정된 날짜.
     *
     * 수동 요청이면 null이다.
     */
    @Column(
            name = "scheduled_date"
    )
    private LocalDate scheduledDate;

    /**
     * 자동 요청이 예정된 시간.
     *
     * 예:
     * scheduledDate = 2026-07-23
     * scheduledTime = 09:00
     *
     * 수동 요청이면 null이다.
     */
    @Column(
            name = "scheduled_time"
    )
    private LocalTime scheduledTime;

    /**
     * 실제 안부 요청이 생성된 시각.
     */
    @Column(
            name = "requested_at",
            nullable = false
    )
    private LocalDateTime requestedAt;

    /**
     * 요청 생성 당시의 응답 제한 시간.
     */
    @Builder.Default
    @Column(
            name = "timeout_minutes",
            nullable = false
    )
    private Integer timeoutMinutes =
            DEFAULT_TIMEOUT_MINUTES;

    /**
     * 어르신이 응답한 시각.
     */
    @Column(
            name = "responded_at"
    )
    private LocalDateTime respondedAt;

    /**
     * 어르신 응답 내용.
     */
    @Column(
            name = "response_message",
            length = 500
    )
    private String responseMessage;

    @CreationTimestamp
    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private LocalDateTime createdAt;

    public enum Status {
        PENDING,
        RESPONDED,
        MISSED
    }

    public enum RequestType {
        MANUAL,
        AUTOMATIC
    }
}