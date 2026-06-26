package com.nuri.woorilink.domain.guardian.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "wl_guardians")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Guardian {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private String phone;
    private String relationship;
    private String email;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
