package com.nuri.woorilink.repository;

import com.nuri.woorilink.entity.RegisteredProduct;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RegisteredProductRepository
        extends JpaRepository<RegisteredProduct, Long> {

    /*
     * 어르신별 등록 제품 조회
     */
    List<RegisteredProduct> findBySeniorId(
            Long seniorId
    );

    /*
     * 리콜 상태별 제품 조회
     */
    List<RegisteredProduct> findByRecallStatus(
            RegisteredProduct.RecallStatus recallStatus
    );

    /*
     * 복지사의 담당 어르신 목록에 포함된 리콜 제품 조회
     */
    List<RegisteredProduct>
    findBySeniorIdInAndRecallStatus(
            List<Long> seniorIds,
            RegisteredProduct.RecallStatus recallStatus
    );

    /*
     * 담당 복지사별 후속조치 목록
     */
    List<RegisteredProduct>
    findByAssignedWorkerIdOrderByUpdatedAtDesc(
            Long assignedWorkerId
    );

    /*
     * 후속조치 상태별 목록
     */
    List<RegisteredProduct>
    findByFollowUpStatusOrderByUpdatedAtDesc(
            RegisteredProduct.FollowUpStatus followUpStatus
    );

    /*
     * 담당 복지사와 상태를 함께 사용한 목록
     */
    List<RegisteredProduct>
    findByAssignedWorkerIdAndFollowUpStatusOrderByUpdatedAtDesc(
            Long assignedWorkerId,
            RegisteredProduct.FollowUpStatus followUpStatus
    );

    /*
     * 어르신별 후속조치 목록
     */
    List<RegisteredProduct>
    findBySeniorIdOrderByUpdatedAtDesc(
            Long seniorId
    );
}