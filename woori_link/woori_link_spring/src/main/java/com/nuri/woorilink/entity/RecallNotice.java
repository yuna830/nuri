package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;
import java.time.*;
import java.util.*;

@Entity @Table(name = "wl_recall_notices")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class RecallNotice {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable=false, unique=true) private String recallUid;
    private String productName; private String brandName; private String manufacturerName; private String recallCompanyName;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false) @Builder.Default private List<String> modelNames = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false) @Builder.Default private List<String> barcodeNumbers = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false) @Builder.Default private List<String> certNumbers = new ArrayList<>();
    private String productCategory; private LocalDate publishDate; private LocalDate recallStartDate; private LocalDate recallEndDate;
    @Column(columnDefinition="text") private String defectDescription;
    @Column(columnDefinition="text") private String hazardDescription;
    @Column(columnDefinition="text") private String consumerAction;
    private String inquiryTel;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb", nullable=false) @Builder.Default private List<String> imageUrls = new ArrayList<>();
    @Column(columnDefinition="text") private String additionalConditionText;
    private boolean hasUnstructuredScopeCondition;
    @Builder.Default private String sourceName = "국가기술표준원 제품안전정보센터";
    private String sourceUrl;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") private String listRawResponse;
    @JdbcTypeCode(SqlTypes.JSON) @Column(columnDefinition="jsonb") private String detailRawResponse;
    private String contentHash; private LocalDateTime firstSyncedAt; private LocalDateTime lastSyncedAt;
    @Builder.Default private boolean isActive = true;
    @CreationTimestamp private LocalDateTime createdAt; @UpdateTimestamp private LocalDateTime updatedAt;
}
