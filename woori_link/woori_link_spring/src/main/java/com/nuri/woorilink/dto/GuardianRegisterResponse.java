package com.nuri.woorilink.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class GuardianRegisterResponse {
    private Long guardianId;
    private String inviteCode;
}
