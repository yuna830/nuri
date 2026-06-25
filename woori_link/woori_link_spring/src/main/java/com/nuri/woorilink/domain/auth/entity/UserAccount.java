package com.nuri.woorilink.domain.auth.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "wl_user_accounts")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String phone;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private Long referenceId;

    public enum Role {
        SENIOR, GUARDIAN, WELFARE_WORKER
    }
}
