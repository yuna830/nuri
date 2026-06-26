package com.nuri.woorilink.dto;

import lombok.Getter;

@Getter
public class GuardianPasswordResetRequest {
    private String name;
    private String phone;
    private String newPassword;
}