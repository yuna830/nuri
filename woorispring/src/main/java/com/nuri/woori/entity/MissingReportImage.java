package com.nuri.woori.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "missing_report_images")
public class MissingReportImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long missingReportId;

    @Column(length = 500, nullable = false)
    private String imageUrl;

    private Integer sortOrder = 0;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public Long getMissingReportId() {
        return missingReportId;
    }

    public void setMissingReportId(Long missingReportId) {
        this.missingReportId = missingReportId;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}