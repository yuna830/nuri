package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.EnergySupportCase;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class EnergySupportCaseUpdateRequest {
    private EnergySupportCase.SupportStatus status;
    private EnergySupportCase.ExistingApplicationStatus existingApplicationStatus;
    private EnergySupportCase.ApplicationIntent applicationIntent;
    private EnergySupportCase.DeclineReason declineReason;
    private String contactMethod;
    private LocalDate nextActionDate;
    private String note;
}
