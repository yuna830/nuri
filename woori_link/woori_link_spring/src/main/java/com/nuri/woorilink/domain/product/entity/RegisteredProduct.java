package com.nuri.woorilink.domain.product.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_registered_products")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RegisteredProduct {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;

    @Column(nullable = false)
    private String productName;

    private String manufacturer;
    private String modelNumber;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private RecallStatus recallStatus = RecallStatus.UNKNOWN;

    @Column(length = 1000)
    private String recallReason;

    private LocalDateTime lastCheckedAt;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum RecallStatus {
        UNKNOWN, SAFE, RECALLED
    }
}
