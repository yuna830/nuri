package com.nuri.woorilink.domain.auth.dto;

import lombok.Getter;

@Getter
public class LoginRequest {
    private String phone;
    private String password;
}
