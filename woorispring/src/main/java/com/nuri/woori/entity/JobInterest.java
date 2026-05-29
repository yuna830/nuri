package com.nuri.woori.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "job_interests")
public class JobInterest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private String jobId;
    private String jobTitle;
    private String company;
    private String location;
    private String applicationType;
    private String status;
    private LocalDateTime createdAt = LocalDateTime.now();

    // 상세 정보 필드
    private String source;
    private String detailAddress;
    private String jobType;
    private String workTime;
    private String weekHours;
    private String wage;
    private String recruitCount;
    private String fromDate;
    private String toDate;
    private String applyMethod;
    private String contactInfo;

    @Column(columnDefinition = "TEXT")
    private String detail;

    public Long getId() { return id; }

    public Long getSeniorId() { return seniorId; }
    public void setSeniorId(Long seniorId) { this.seniorId = seniorId; }

    public String getJobId() { return jobId; }
    public void setJobId(String jobId) { this.jobId = jobId; }

    public String getJobTitle() { return jobTitle; }
    public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }

    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public String getApplicationType() { return applicationType; }
    public void setApplicationType(String applicationType) { this.applicationType = applicationType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getCreatedAt() { return createdAt; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getDetailAddress() { return detailAddress; }
    public void setDetailAddress(String detailAddress) { this.detailAddress = detailAddress; }

    public String getJobType() { return jobType; }
    public void setJobType(String jobType) { this.jobType = jobType; }

    public String getWorkTime() { return workTime; }
    public void setWorkTime(String workTime) { this.workTime = workTime; }

    public String getWeekHours() { return weekHours; }
    public void setWeekHours(String weekHours) { this.weekHours = weekHours; }

    public String getWage() { return wage; }
    public void setWage(String wage) { this.wage = wage; }

    public String getRecruitCount() { return recruitCount; }
    public void setRecruitCount(String recruitCount) { this.recruitCount = recruitCount; }

    public String getFromDate() { return fromDate; }
    public void setFromDate(String fromDate) { this.fromDate = fromDate; }

    public String getToDate() { return toDate; }
    public void setToDate(String toDate) { this.toDate = toDate; }

    public String getApplyMethod() { return applyMethod; }
    public void setApplyMethod(String applyMethod) { this.applyMethod = applyMethod; }

    public String getContactInfo() { return contactInfo; }
    public void setContactInfo(String contactInfo) { this.contactInfo = contactInfo; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
}
