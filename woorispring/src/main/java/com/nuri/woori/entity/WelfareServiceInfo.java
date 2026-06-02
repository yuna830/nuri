package com.nuri.woori.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "welfare_services")
public class WelfareServiceInfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "service_id", unique = true, nullable = false, length = 100)
    private String serviceId;

    @Column(name = "service_name", nullable = false, length = 500)
    private String serviceName;

    @Column(columnDefinition = "TEXT")
    private String summary;

    private String department;

    private String contact;

    @Column(name = "detail_link", columnDefinition = "TEXT")
    private String detailLink;

    private String lifeCycle;

    private String householdType;

    private String interestTopic;

    private String sourceName;

    @Column(name = "support_target", columnDefinition = "TEXT")
    private String supportTarget;

    @Column(name = "selection_criteria", columnDefinition = "TEXT")
    private String selectionCriteria;

    @Column(name = "support_content", columnDefinition = "TEXT")
    private String supportContent;

    @Column(name = "application_method", columnDefinition = "TEXT")
    private String applicationMethod;

    @Column(name = "required_documents", columnDefinition = "TEXT")
    private String requiredDocuments;

    @Column(name = "detail_synced_at")
    private LocalDateTime detailSyncedAt;

    private LocalDateTime syncedAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getServiceId() {
        return serviceId;
    }

    public void setServiceId(String serviceId) {
        this.serviceId = serviceId;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public String getContact() {
        return contact;
    }

    public void setContact(String contact) {
        this.contact = contact;
    }

    public String getDetailLink() {
        return detailLink;
    }

    public void setDetailLink(String detailLink) {
        this.detailLink = detailLink;
    }

    public String getLifeCycle() {
        return lifeCycle;
    }

    public void setLifeCycle(String lifeCycle) {
        this.lifeCycle = lifeCycle;
    }

    public String getHouseholdType() {
        return householdType;
    }

    public void setHouseholdType(String householdType) {
        this.householdType = householdType;
    }

    public String getInterestTopic() {
        return interestTopic;
    }

    public void setInterestTopic(String interestTopic) {
        this.interestTopic = interestTopic;
    }

    public String getSourceName() {
        return sourceName;
    }

    public void setSourceName(String sourceName) {
        this.sourceName = sourceName;
    }

    public String getSupportTarget() {
        return supportTarget;
    }

    public void setSupportTarget(String supportTarget) {
        this.supportTarget = supportTarget;
    }

    public String getSelectionCriteria() {
        return selectionCriteria;
    }

    public void setSelectionCriteria(String selectionCriteria) {
        this.selectionCriteria = selectionCriteria;
    }

    public String getSupportContent() {
        return supportContent;
    }

    public void setSupportContent(String supportContent) {
        this.supportContent = supportContent;
    }

    public String getApplicationMethod() {
        return applicationMethod;
    }

    public void setApplicationMethod(String applicationMethod) {
        this.applicationMethod = applicationMethod;
    }

    public String getRequiredDocuments() {
        return requiredDocuments;
    }

    public void setRequiredDocuments(String requiredDocuments) {
        this.requiredDocuments = requiredDocuments;
    }

    public LocalDateTime getDetailSyncedAt() {
        return detailSyncedAt;
    }

    public void setDetailSyncedAt(LocalDateTime detailSyncedAt) {
        this.detailSyncedAt = detailSyncedAt;
    }

    public LocalDateTime getSyncedAt() {
        return syncedAt;
    }

    public void setSyncedAt(LocalDateTime syncedAt) {
        this.syncedAt = syncedAt;
    }
}