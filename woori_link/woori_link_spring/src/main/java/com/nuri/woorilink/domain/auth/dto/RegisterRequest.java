package com.nuri.woorilink.domain.auth.dto;

import com.nuri.woorilink.domain.auth.entity.UserAccount.Role;
import lombok.Getter;

@Getter
public class RegisterRequest {
    private String phone;
    private String password;
    private Role role;
    private Long referenceId;
}
