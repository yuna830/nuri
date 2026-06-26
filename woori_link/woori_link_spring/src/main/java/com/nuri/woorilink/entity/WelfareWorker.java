package com.nuri.woorilink.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_welfare_workers")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class WelfareWorker {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String loginId;

    @JsonIgnore
    private String password;

    private String phone;
    private String organization;
    private String email;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
