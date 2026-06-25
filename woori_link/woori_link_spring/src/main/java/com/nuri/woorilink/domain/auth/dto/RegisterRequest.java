package com.nuri.woorilink.domain.auth.dto;

import lombok.Getter;

@Getter
public class RegisterRequest {
    private String name;
    private String phone;
    private String password;
    private String organization;
    private String relationship;
    private String email;
}
