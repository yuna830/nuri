package com.nuri.woori.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * 보호자가 미리 등록해두는 어르신 얼굴 사진.
 * 실종 신고가 접수되면 이 사진들이 얼굴 인식 비교 대상으로 사용된다.
 */
@Entity
@Table(name = "senior_face_photos")
public class SeniorFacePhoto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long seniorId;

    @Column(length = 500, nullable = false)
    private String imageUrl;

    private LocalDateTime createdAt = LocalDateTime.now();

    public Long getId() {
        return id;
    }

    public Long getSeniorId() {
        return seniorId;
    }

    public void setSeniorId(Long seniorId) {
        this.seniorId = seniorId;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
