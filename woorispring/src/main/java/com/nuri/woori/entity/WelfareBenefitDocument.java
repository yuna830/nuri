package com.nuri.woori.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "welfare_benefit_documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WelfareBenefitDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 500)
    private String externalId;

    @Column(length = 50)
    private String sourceType;

    @Column(length = 500)
    private String sourceName;

    @Column(length = 1000)
    private String sourceUrl;

    private Integer pageNo;

    @Column(length = 1000)
    private String title;

    @Column(length = 500)
    private String organization;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String embeddingJson;

    private LocalDateTime syncedAt;
}
