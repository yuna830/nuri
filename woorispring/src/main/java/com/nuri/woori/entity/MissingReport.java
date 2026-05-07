package com.nuri.woori.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "missing_reports")
public class MissingReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private Long guardianId;

    private String status;

    private Double lastSeenLatitude;
    private Double lastSeenLongitude;
    private String lastSeenAddress;

    @Column(length = 1000)
    private String description;

    private LocalDateTime reportedAt = LocalDateTime.now();
    private LocalDateTime resolvedAt;

    private String imageUrl;

    public Long getId() {
        return id;
    }

    public Long getSeniorId() {
        return seniorId;
    }

    public void setSeniorId(Long seniorId) {
        this.seniorId = seniorId;
    }

    public Long getGuardianId() {
        return guardianId;
    }

    public void setGuardianId(Long guardianId) {
        this.guardianId = guardianId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Double getLastSeenLatitude() {
        return lastSeenLatitude;
    }

    public void setLastSeenLatitude(Double lastSeenLatitude) {
        this.lastSeenLatitude = lastSeenLatitude;
    }

    public Double getLastSeenLongitude() {
        return lastSeenLongitude;
    }

    public void setLastSeenLongitude(Double lastSeenLongitude) {
        this.lastSeenLongitude = lastSeenLongitude;
    }

    public String getLastSeenAddress() {
        return lastSeenAddress;
    }

    public void setLastSeenAddress(String lastSeenAddress) {
        this.lastSeenAddress = lastSeenAddress;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDateTime getReportedAt() {
        return reportedAt;
    }

    public LocalDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(LocalDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }
}
