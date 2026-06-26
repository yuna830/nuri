package com.nuri.woorilink.dto;

import lombok.Getter;

@Getter
public class GuardianRegisterRequest {
    private String name;
    private String phone;
    private String password;
    private String relationship;
    private String email;
}
