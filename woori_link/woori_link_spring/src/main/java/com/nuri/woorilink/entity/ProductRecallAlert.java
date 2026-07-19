package com.nuri.woorilink.entity;
import jakarta.persistence.*; import lombok.*; import org.hibernate.annotations.CreationTimestamp; import java.time.LocalDateTime;
@Entity @Table(name="wl_product_recall_alerts", uniqueConstraints=@UniqueConstraint(name="uk_product_recall_alert",columnNames={"registered_product_id","recall_notice_id","alert_type"}))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ProductRecallAlert { @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; private Long registeredProductId; private Long recallNoticeId; private String alertType; private boolean dryRun; @CreationTimestamp private LocalDateTime createdAt; }
