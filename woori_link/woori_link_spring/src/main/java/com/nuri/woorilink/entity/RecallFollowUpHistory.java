package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "wl_recall_follow_up_histories",
        indexes = {
                @Index(
                        name = "idx_recall_follow_up_history_product",
                        columnList = "registeredProductId"
                ),
                @Index(
                        name = "idx_recall_follow_up_history_changed_by",
                        columnList = "changedBy"
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecallFollowUpHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /*
     * wl_registered_products.id
     */
    @Column(nullable = false)
    private Long registeredProductId;

    /*
     * 변경 전 상태
     */
    @Enumerated(EnumType.STRING)
    private RegisteredProduct.FollowUpStatus previousStatus;

    /*
     * 변경 후 상태
     */
    @Enumerated(EnumType.STRING)
    private RegisteredProduct.FollowUpStatus newStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ChangeType changeType;

    /*
     * 변경한 복지사 ID
     */
    private Long changedBy;

    @Column(length = 1000)
    private String changeMemo;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public enum ChangeType {
        CREATED,
        STATUS_CHANGED,
        RECORD_UPDATED
    }
}