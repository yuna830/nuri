package com.nuri.woorilink.domain.auth.dto;

import lombok.Getter;

@Getter
public class LoginRequest {
    private String loginId;  // 복지사용
    private String phone;    // 어르신/보호자용
    private String password;
}
