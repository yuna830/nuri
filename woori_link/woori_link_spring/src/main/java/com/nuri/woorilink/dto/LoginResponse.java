package com.nuri.woorilink.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private String role;
    private Long userId;
    private String name;
}
