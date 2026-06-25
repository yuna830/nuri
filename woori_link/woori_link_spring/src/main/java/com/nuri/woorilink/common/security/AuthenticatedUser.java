package com.nuri.woorilink.common.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AuthenticatedUser {
    private final String phone;
    private final String role;
    private final Long userId;
}
