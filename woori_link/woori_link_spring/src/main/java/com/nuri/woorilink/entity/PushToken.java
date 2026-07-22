package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UpdateTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "wl_push_tokens", uniqueConstraints = @UniqueConstraint(columnNames = "token"))
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PushToken {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false) private String role;
    @Column(nullable = false) private Long userId;
    @Column(nullable = false, length = 512) private String token;
    @UpdateTimestamp private LocalDateTime updatedAt;
}
