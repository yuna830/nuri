package com.nuri.woorilink.dto;

import lombok.Getter;

@Getter
public class WelfarePasswordResetRequest {
    private String loginId;
    private String name;
    private String phone;
    private String newPassword;
}
