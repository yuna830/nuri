package com.nuri.woorilink.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
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

    @JsonIgnore
    private String password;

    private String phone;

    private String relationship;
    private String email;

    @Column(nullable = false, unique = true, length = 8)
    private String inviteCode;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
