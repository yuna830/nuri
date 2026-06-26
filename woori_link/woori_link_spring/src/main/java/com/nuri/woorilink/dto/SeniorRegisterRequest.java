package com.nuri.woorilink.dto;

import lombok.Getter;

@Getter
public class SeniorRegisterRequest {
    private String name;
    private String phone;
    private Integer age;
    private String address;
    private String gender;
    private Long guardianId;
}
