package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.GasDiscountDetailDto;
import com.nuri.woorilink.dto.GasDiscountDetailRequest;
import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.service.EnergySupportAccessService;
import com.nuri.woorilink.service.GasDiscountDetailService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
        "/api/energy-support/gas"
)
@RequiredArgsConstructor
public class GasDiscountDetailController {

    private final GasDiscountDetailService
            gasDiscountDetailService;
    private final EnergySupportAccessService accessService;

    /**
     * 어르신 도시가스 상세 정보 조회
     *
     * GET
     * /api/energy-support/gas/{seniorId}
     */
    @GetMapping("/{seniorId}")
    public ResponseEntity<GasDiscountDetailDto> getGasDetail(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateReadAccess(user, seniorId);
        GasDiscountDetailDto detail =
                gasDiscountDetailService
                        .getBySeniorId(
                                seniorId
                        );

        /*
         * 아직 저장된 상세 정보가 없는 경우에도
         * 프론트가 404 오류로 처리하지 않도록
         * 200 OK와 빈 응답을 반환한다.
         */
        return ResponseEntity.ok(
                detail
        );
    }

    /**
     * 어르신 도시가스 상세 정보 생성 또는 수정
     *
     * PUT
     * /api/energy-support/gas/{seniorId}
     */
    @PutMapping("/{seniorId}")
    public ResponseEntity<GasDiscountDetailDto> saveGasDetail(
            @PathVariable Long seniorId,
            @RequestBody GasDiscountDetailRequest request,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateWriteAccess(user, seniorId);
        request.setUpdatedByRole(accessService.getUpdatedByRole(user));
        request.setUpdatedById(user.getUserId());
        GasDiscountDetailDto saved =
                gasDiscountDetailService
                        .saveOrUpdate(
                                seniorId,
                                request
                        );

        return ResponseEntity.ok(
                saved
        );
    }

    /**
     * 어르신 도시가스 상세 정보 삭제
     *
     * DELETE
     * /api/energy-support/gas/{seniorId}
     *
     * 개발 및 잘못 등록된 데이터 초기화 용도.
     * 운영 화면에는 삭제 버튼을 제공하지 않는 것을 권장한다.
     */
    @DeleteMapping("/{seniorId}")
    public ResponseEntity<Void> deleteGasDetail(
            @PathVariable Long seniorId,
            @AuthenticationPrincipal AuthenticatedUser user
    ) {
        accessService.validateWelfareWorker(user);
        accessService.validateDetailAccess(user, seniorId);
        gasDiscountDetailService
                .deleteBySeniorId(
                        seniorId
                );

        return ResponseEntity
                .noContent()
                .build();
    }
}
