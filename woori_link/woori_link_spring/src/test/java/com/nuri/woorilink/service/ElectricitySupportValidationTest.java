package com.nuri.woorilink.service;

import com.nuri.woorilink.entity.ElectricityDiscountDetail;
import com.nuri.woorilink.entity.EnergySupportCase;
import com.nuri.woorilink.entity.Senior;
import com.nuri.woorilink.repository.ElectricityDiscountDetailRepository;
import com.nuri.woorilink.repository.SeniorRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.AopTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class ElectricitySupportValidationTest {

    @Autowired
    private EnergySupportCaseService service;

    @Autowired
    private SeniorRepository seniorRepository;

    @Autowired
    private ElectricityDiscountDetailRepository detailRepository;

    @Test
    void validatesElectricityScenariosForChoiSookHee() throws Exception {
        Senior senior = seniorRepository.findAll().stream()
                .filter(value -> "최숙희".equals(value.getName()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("최숙희 대상자를 찾을 수 없습니다."));

        detailRepository.findBySeniorId(senior.getId())
                .ifPresent(detailRepository::delete);
        detailRepository.flush();
        assertMissing(senior, "전기 계약 정보");

        ElectricityDiscountDetail detail = completeDetail(senior.getId());

        detail.setCustomerNumber(null);
        save(detail);
        assertMissing(senior, "전기 고객번호");

        detail.setCustomerNumber("TEST-CUSTOMER");
        detail.setContractorName(null);
        save(detail);
        assertMissing(senior, "계약자명");

        detail.setContractorName("최숙희");
        detail.setAddressSame(null);
        save(detail);
        assertMissing(senior, "주소 일치 여부");

        detail.setAddressSame(false);
        detail.setServiceAddress(null);
        save(detail);
        assertMissing(senior, "전기 사용 주소");

        detail.setAddressSame(true);
        detail.setRecentBillChecked(null);
        save(detail);
        assertMissing(senior, "최근 고지서 확인 여부");

        detail.setRecentBillChecked(true);
        detail.setWelfareEligible(true);
        save(detail);
        assertLevel(senior, EnergySupportCase.EligibilityLevel.HIGH);

        detail.setWelfareEligible(false);
        save(detail);
        assertLevel(senior, EnergySupportCase.EligibilityLevel.LOW);
    }

    private ElectricityDiscountDetail completeDetail(Long seniorId) {
        return ElectricityDiscountDetail.builder()
                .seniorId(seniorId)
                .usesElectricity(true)
                .electricityProvider("한국전력")
                .customerNumber("TEST-CUSTOMER")
                .contractorName("최숙희")
                .addressSame(true)
                .recentBillChecked(true)
                .welfareEligible(true)
                .build();
    }

    private void save(ElectricityDiscountDetail detail) {
        detailRepository.saveAndFlush(detail);
    }

    @SuppressWarnings("unchecked")
    private void assertMissing(Senior senior, String expected) throws Exception {
        Method method = EnergySupportCaseService.class.getDeclaredMethod(
                "missingInformation",
                Senior.class,
                EnergySupportCase.SupportType.class,
                EnergySupportCase.class,
                com.nuri.woorilink.entity.GasDiscountDetail.class
        );
        method.setAccessible(true);
        EnergySupportCaseService target =
                AopTestUtils.getTargetObject(service);
        List<String> missing = (List<String>) method.invoke(
                target,
                senior,
                EnergySupportCase.SupportType.ELECTRICITY,
                null,
                null
        );
        assertThat(missing).contains(expected);
    }

    private void assertLevel(
            Senior senior,
            EnergySupportCase.EligibilityLevel expected
    ) throws Exception {
        Method method = EnergySupportCaseService.class.getDeclaredMethod(
                "eligibilityLevel",
                Senior.class,
                EnergySupportCase.SupportType.class,
                com.nuri.woorilink.entity.GasDiscountDetail.class
        );
        method.setAccessible(true);
        EnergySupportCaseService target =
                AopTestUtils.getTargetObject(service);
        Object level = method.invoke(
                target,
                senior,
                EnergySupportCase.SupportType.ELECTRICITY,
                null
        );
        assertThat(level).isEqualTo(expected);
    }
}
