package com.nuri.woorilink.domain.auth.dto;

import lombok.Getter;

@Getter
public class RegisterRequest {
    private String loginId;       // 복지사: 아이디
    private String name;
    private String phone;
    private String password;
    private String organization;  // 복지사: 소속 기관명
    private String relationship;  // 보호자: 어르신과의 관계
    private String email;
}
