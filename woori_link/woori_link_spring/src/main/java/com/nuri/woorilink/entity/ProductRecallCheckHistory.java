package com.nuri.woorilink.entity;
import jakarta.persistence.*; import lombok.*; import org.hibernate.annotations.JdbcTypeCode; import org.hibernate.annotations.CreationTimestamp; import org.hibernate.type.SqlTypes;
import java.time.*; import java.util.*;
@Entity @Table(name="wl_product_recall_check_history") @Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class ProductRecallCheckHistory {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; private Long registeredProductId; private Long recallNoticeId;
 @Enumerated(EnumType.STRING) private RegisteredProduct.RecallDecisionStatus decisionStatus;
 @Enumerated(EnumType.STRING) private RegisteredProduct.RecallCheckStatus checkStatus;
 private String queryType; private String queryValue;
 @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") @Builder.Default private List<String> matchedFields=new ArrayList<>();
 @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") @Builder.Default private List<String> mismatchedFields=new ArrayList<>();
 @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") @Builder.Default private List<String> missingFields=new ArrayList<>();
 @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") @Builder.Default private Map<String,Object> productSnapshot=Map.of();
 @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") @Builder.Default private List<String> candidateRecallUids=new ArrayList<>();
 @Column(columnDefinition="text") private String decisionReason; private String externalResultCode;
 @Column(columnDefinition="text") private String externalResultMessage; private String errorCode;
 @Column(columnDefinition="text") private String errorMessage; private LocalDateTime checkedAt; @CreationTimestamp private LocalDateTime createdAt;
}
