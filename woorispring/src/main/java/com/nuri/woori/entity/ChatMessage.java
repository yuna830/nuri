package com.nuri.woori.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;
    private String roomType;
    private String senderRole;
    private Long senderId;
    private String senderName;

    @Column(length = 1000)
    private String message;

    private String attachmentUrl;
    private String attachmentType;
    private String attachmentName;

    private LocalDateTime createdAt = LocalDateTime.now();

    private Boolean unreadForSenior = false;
    private Boolean unreadForGuardian = false;
    private Boolean unreadForWelfare = false;

    public Long getId() {
        return id;
    }

    public Long getSeniorId() {
        return seniorId;
    }

    public void setSeniorId(Long seniorId) {
        this.seniorId = seniorId;
    }

    public String getRoomType() {
        return roomType;
    }

    public void setRoomType(String roomType) {
        this.roomType = roomType;
    }

    public String getSenderRole() {
        return senderRole;
    }

    public void setSenderRole(String senderRole) {
        this.senderRole = senderRole;
    }

    public Long getSenderId() {
        return senderId;
    }

    public void setSenderId(Long senderId) {
        this.senderId = senderId;
    }

    public String getSenderName() {
        return senderName;
    }

    public void setSenderName(String senderName) {
        this.senderName = senderName;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public String getAttachmentUrl() {
        return attachmentUrl;
    }

    public void setAttachmentUrl(String attachmentUrl) {
        this.attachmentUrl = attachmentUrl;
    }

    public String getAttachmentType() {
        return attachmentType;
    }

    public void setAttachmentType(String attachmentType) {
        this.attachmentType = attachmentType;
    }

    public String getAttachmentName() {
        return attachmentName;
    }

    public void setAttachmentName(String attachmentName) {
        this.attachmentName = attachmentName;
    }

    public Boolean getUnreadForSenior() {
        return unreadForSenior;
    }

    public void setUnreadForSenior(Boolean unreadForSenior) {
        this.unreadForSenior = unreadForSenior;
    }

    public Boolean getUnreadForGuardian() {
        return unreadForGuardian;
    }

    public void setUnreadForGuardian(Boolean unreadForGuardian) {
        this.unreadForGuardian = unreadForGuardian;
    }

    public Boolean getUnreadForWelfare() {
        return unreadForWelfare;
    }

    public void setUnreadForWelfare(Boolean unreadForWelfare) {
        this.unreadForWelfare = unreadForWelfare;
    }
}
