package com.nuri.woorilink.dto;

import com.nuri.woorilink.entity.RegisteredProduct;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
public class RecallWorkflowUpdateRequest {
    private RegisteredProduct.ModelMatchStatus modelMatchStatus;
    private RegisteredProduct.CurrentUseStatus currentUseStatus;
    private String contactMethod;
    private Boolean stopGuidanceCompleted;
    private LocalDateTime stopGuidanceCompletedAt;
    private String stopGuidanceMethod;
    private String stopGuidanceTarget;
    private Long stopGuidanceWorkerId;
    private String stopGuidanceMemo;
    private RegisteredProduct.GuardianContactStatus guardianContactStatus;
    private String guardianContactMethod;
    private LocalDateTime guardianContactedAt;
    private String guardianContactMemo;
    private String followUpType;
    private LocalDate nextActionDate;
    private RegisteredProduct.FollowUpProgressStatus followUpProgressStatus;
    private String note;
    private RegisteredProduct.FinalResult finalResult;
    private Boolean createAction;
    private Long welfareWorkerId;
}
