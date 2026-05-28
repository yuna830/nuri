package com.nuri.woori.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "alerts")
public class Alert {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private Long guardianId;

    private String type;
    private String title;

    @Column(length = 1000)
    private String message;

    private String imageUrl;

    private Double latitude;
    private Double longitude;

    private Boolean isRead = false;

    private LocalDateTime createdAt = LocalDateTime.now();

    private String guardianResponseType;
    private String guardianScheduleAt;
    private LocalDateTime guardianRespondedAt;

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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public Boolean getIsRead() {
        return isRead;
    }

    public void setIsRead(Boolean read) {
        isRead = read;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getGuardianResponseType() {
        return guardianResponseType;
    }

    public void setGuardianResponseType(String guardianResponseType) {
        this.guardianResponseType = guardianResponseType;
    }

    public String getGuardianScheduleAt() {
        return guardianScheduleAt;
    }

    public void setGuardianScheduleAt(String guardianScheduleAt) {
        this.guardianScheduleAt = guardianScheduleAt;
    }

    public LocalDateTime getGuardianRespondedAt() {
        return guardianRespondedAt;
    }

    public void setGuardianRespondedAt(LocalDateTime guardianRespondedAt) {
        this.guardianRespondedAt = guardianRespondedAt;
    }
}
