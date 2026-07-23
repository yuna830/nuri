package com.nuri.woorilink.dto;

import lombok.Getter;

@Getter
public class GuardianPasswordChangeRequest {
    private String currentPassword;
    private String newPassword;
}
