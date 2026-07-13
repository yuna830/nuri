package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_check_ins")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class CheckIn {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private Long seniorId;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Status status;
    @Column(nullable = false) private LocalDateTime requestedAt;
    private LocalDateTime respondedAt;
    @Column(length = 500) private String responseMessage;
    @CreationTimestamp private LocalDateTime createdAt;

    public enum Status { PENDING, RESPONDED, MISSED }
}
