package com.nuri.woorilink.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class RecallFollowUpCreateRequest {

    /*
     * wl_registered_products.id
     */
    private Long registeredProductId;

    /*
     * 담당 복지사 ID
     */
    private Long welfareWorkerId;

    /*
     * 복지사가 앞으로 진행할 조치
     */
    private String followUpType;

    /*
     * 다음 업무 예정일
     */
    private LocalDate nextActionDate;

    /*
     * 최초 접수 및 배정 메모
     */
    private String note;
}