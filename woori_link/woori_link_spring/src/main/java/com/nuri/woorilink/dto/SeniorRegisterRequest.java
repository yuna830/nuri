package com.nuri.woorilink.dto;

import lombok.Getter;

import java.time.LocalDate;

@Getter
public class SeniorRegisterRequest {

    private String name;
    private String phone;
    private LocalDate birthDate;
    private String address;
    private String gender;
    private String inviteCode;
}
