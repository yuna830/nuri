package com.nuri.woorilink.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class RecallFollowUpCreateRequest {

    /**
     * wl_registered_products.id
     */
    private Long registeredProductId;

    /**
     * 이전 프론트엔드 호환용 필드입니다.
     *
     * 권한 검증이나 담당자 배정에는 사용하지 않습니다.
     * 실제 담당 복지사는 JWT 사용자 ID를 사용합니다.
     */
    @Deprecated
    private Long welfareWorkerId;

    /**
     * 복지사가 앞으로 진행할 조치
     */
    private String followUpType;

    /**
     * 다음 업무 예정일
     */
    private LocalDate nextActionDate;

    /**
     * 최초 접수 및 배정 메모
     */
    private String note;
}