package com.nuri.woorilink.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "wl_gas_discount_details",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_gas_discount_detail_senior",
                        columnNames = "senior_id"
                )
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GasDiscountDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 어르신 ID
     *
     * Senior 엔티티와 직접 연관관계를 맺지 않고
     * 기존 EnergySupportCase 구조와 동일하게 Long ID만 저장한다.
     */
    @Column(
            name = "senior_id",
            nullable = false
    )
    private Long seniorId;

    /**
     * 도시가스 사용 여부
     *
     * null  : 아직 확인하지 않음
     * true  : 도시가스 사용
     * false : 도시가스 미사용
     */
    @Column(name = "uses_city_gas")
    private Boolean usesCityGas;

    /**
     * 도시가스 사용 용도
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "gas_use_type")
    private GasUseType gasUseType;

    /**
     * 난방 방식
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "gas_heating_type")
    private GasHeatingType gasHeatingType;

    /**
     * 도시가스 공급 회사명
     *
     * 예:
     * 서울도시가스
     * 삼천리
     * 예스코
     */
    @Column(
            name = "gas_company",
            length = 100
    )
    private String gasCompany;

    /**
     * 도시가스 고객번호
     */
    @Column(
            name = "gas_customer_number",
            length = 100
    )
    private String gasCustomerNumber;

    /**
     * 도시가스 계약자명
     */
    @Column(
            name = "gas_contractor_name",
            length = 100
    )
    private String gasContractorName;

    /**
     * 실제 거주 주소와 도시가스 사용 주소 일치 여부
     *
     * null  : 미확인
     * true  : 일치
     * false : 불일치
     */
    @Column(name = "address_same")
    private Boolean addressSame;

    /**
     * 도시가스가 실제 사용되는 주소
     *
     * 주소가 일치하지 않을 때 입력
     */
    @Column(
            name = "gas_service_address",
            length = 255
    )
    private String gasServiceAddress;

    /**
     * 최근 도시가스 고지서 확인 여부
     */
    @Column(name = "recent_bill_checked")
    private Boolean recentBillChecked;

    /**
     * 장애인·국가유공자 등 경감 대상 여부
     */
    @Column(name = "severe_disability_or_merit")
    private Boolean severeDisabilityOrMerit;

    /**
     * 기초생활수급자·차상위계층 여부
     */
    @Column(name = "basic_or_near_poor")
    private Boolean basicOrNearPoor;

    /**
     * 다자녀 가구 여부
     */
    @Column(name = "multi_child_household")
    private Boolean multiChildHousehold;

    /**
     * 에너지바우처 수급 여부
     */
    @Column(name = "energy_voucher_recipient")
    private Boolean energyVoucherRecipient;

    /**
     * 복지사가 추가로 확인한 메모
     */
    @Column(length = 1000)
    private String note;

    /**
     * 마지막 수정자 역할
     *
     * SENIOR
     * GUARDIAN
     * WELFARE_WORKER
     * SYSTEM
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "updated_by_role")
    private UpdatedByRole updatedByRole;

    /**
     * 마지막 수정자 ID
     */
    @Column(name = "updated_by_id")
    private Long updatedById;

    @CreationTimestamp
    @Column(
            name = "created_at",
            updatable = false
    )
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum GasUseType {
        /**
         * 취사만 사용
         */
        COOKING,

        /**
         * 난방만 사용
         */
        HEATING,

        /**
         * 취사와 난방 모두 사용
         */
        COOKING_AND_HEATING,

        /**
         * 기타
         */
        OTHER
    }

    public enum GasHeatingType {
        /**
         * 개별난방
         */
        INDIVIDUAL,

        /**
         * 중앙난방
         */
        CENTRAL,

        /**
         * 지역난방
         */
        DISTRICT,

        /**
         * 난방에 도시가스를 사용하지 않음
         */
        NOT_USED,

        /**
         * 기타
         */
        OTHER
    }

    public enum UpdatedByRole {
        SENIOR,
        GUARDIAN,
        WELFARE_WORKER,
        SYSTEM
    }
}