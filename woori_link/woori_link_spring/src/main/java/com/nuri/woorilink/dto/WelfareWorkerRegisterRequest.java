package com.nuri.woorilink.dto;

import lombok.Getter;

@Getter
public class WelfareWorkerRegisterRequest {
    private String loginId;
    private String name;
    private String phone;
    private String password;
    private String organization;
    private String email;
}
