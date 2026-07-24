package com.nuri.woorilink.service;

import com.nuri.woorilink.dto.EnergySupportCaseUpdateRequest;
import com.nuri.woorilink.entity.*;
import com.nuri.woorilink.repository.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.util.AopTestUtils;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Transactional
class EnergySupportWorkflowIntegrationTest {

    @Autowired EnergySupportCaseService service;
    @Autowired SeniorRepository seniorRepository;
    @Autowired EnergySupportCaseRepository caseRepository;
    @Autowired EnergySupportActivityRepository activityRepository;
    @Autowired GasDiscountDetailRepository gasRepository;
    @Autowired ElectricityDiscountDetailRepository electricityRepository;
    @Autowired EnergyVoucherDetailRepository voucherRepository;
    @Autowired EntityManager entityManager;

    @Test
    void validatesAllDetailTypesAndHistoryRules() throws Exception {
        Senior senior = seniorRepository.findAll().stream()
                .filter(value -> "\uCD5C\uC219\uD76C".equals(value.getName()))
                .findFirst()
                .orElseThrow();

        validateVoucher(senior);
        validateElectricity(senior);
        validateElectricitySaveReloadAndHistory(senior);
        validateGas(senior);
        validateCompletionAndHistory(senior);
    }

    private void validateVoucher(Senior senior) throws Exception {
        voucherRepository.findBySeniorId(senior.getId())
                .ifPresent(voucherRepository::delete);
        voucherRepository.flush();
        assertMissing(senior, EnergySupportCase.SupportType.VOUCHER,
                "\uC5D0\uB108\uC9C0\uBC14\uC6B0\uCC98 \uC0C1\uC138 \uC815\uBCF4");
        assertLevel(senior, EnergySupportCase.SupportType.VOUCHER,
                EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED);

        EnergyVoucherDetail detail = EnergyVoucherDetail.builder()
                .seniorId(senior.getId())
                .incomeCriteriaConfirmed(true)
                .livelihoodBenefitTypes("BASIC_LIVELIHOOD")
                .householdCharacteristicConfirmed(true)
                .householdCharacteristics("SENIOR")
                .winterOtherEnergySupportRecipient(false)
                .duplicateSupportDisqualifying(false)
                .build();
        voucherRepository.saveAndFlush(detail);
        assertLevel(senior, EnergySupportCase.SupportType.VOUCHER,
                EnergySupportCase.EligibilityLevel.HIGH);

        detail.setIncomeCriteriaConfirmed(false);
        voucherRepository.saveAndFlush(detail);
        assertLevel(senior, EnergySupportCase.SupportType.VOUCHER,
                EnergySupportCase.EligibilityLevel.LOW);
    }

    private void validateElectricity(Senior senior) throws Exception {
        electricityRepository.findBySeniorId(senior.getId())
                .ifPresent(electricityRepository::delete);
        electricityRepository.flush();
        assertMissing(senior, EnergySupportCase.SupportType.ELECTRICITY,
                "\uC804\uAE30 \uACC4\uC57D \uC815\uBCF4");
        assertLevel(senior, EnergySupportCase.SupportType.ELECTRICITY,
                EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED);

        ElectricityDiscountDetail detail = ElectricityDiscountDetail.builder()
                .seniorId(senior.getId())
                .usesElectricity(true)
                .electricityProvider("KEPCO")
                .customerNumber(null)
                .contractorName("TEST")
                .addressSame(true)
                .recentBillChecked(true)
                .welfareEligible(true)
                .build();
        electricityRepository.saveAndFlush(detail);
        assertMissing(senior, EnergySupportCase.SupportType.ELECTRICITY,
                "\uC804\uAE30 \uACE0\uAC1D\uBC88\uD638");
        assertLevel(senior, EnergySupportCase.SupportType.ELECTRICITY,
                EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED);

        detail.setCustomerNumber("TEST");
        electricityRepository.saveAndFlush(detail);
        List<String> completeMissing = getMissing(
                senior, EnergySupportCase.SupportType.ELECTRICITY);
        assertThat(completeMissing).doesNotContain(
                "\uC804\uAE30 \uACC4\uC57D \uC815\uBCF4",
                "\uC804\uAE30 \uC0AC\uC6A9 \uC5EC\uBD80",
                "\uC804\uAE30 \uACF5\uAE09\uC0AC",
                "\uC804\uAE30 \uACE0\uAC1D\uBC88\uD638",
                "\uACC4\uC57D\uC790\uBA85",
                "\uC8FC\uC18C \uC77C\uCE58 \uC5EC\uBD80",
                "\uC804\uAE30 \uC0AC\uC6A9 \uC8FC\uC18C",
                "\uCD5C\uADFC \uACE0\uC9C0\uC11C \uD655\uC778 \uC5EC\uBD80",
                "\uCD5C\uADFC \uC804\uAE30\uC694\uAE08 \uACE0\uC9C0\uC11C"
        );
        assertLevel(senior, EnergySupportCase.SupportType.ELECTRICITY,
                EnergySupportCase.EligibilityLevel.HIGH);

        detail.setWelfareEligible(false);
        electricityRepository.saveAndFlush(detail);
        assertLevel(senior, EnergySupportCase.SupportType.ELECTRICITY,
                EnergySupportCase.EligibilityLevel.LOW);

        detail.setWelfareEligible(true);
        detail.setAddressSame(false);
        detail.setServiceAddress(null);
        electricityRepository.saveAndFlush(detail);
        assertMissing(senior, EnergySupportCase.SupportType.ELECTRICITY,
                "\uC804\uAE30 \uC0AC\uC6A9 \uC8FC\uC18C");
        assertLevel(senior, EnergySupportCase.SupportType.ELECTRICITY,
                EnergySupportCase.EligibilityLevel.CONFIRMATION_NEEDED);
    }

    private void validateGas(Senior senior) throws Exception {
        gasRepository.findBySeniorId(senior.getId())
                .ifPresent(gasRepository::delete);
        gasRepository.flush();
        assertMissing(senior, EnergySupportCase.SupportType.GAS,
                "\uB3C4\uC2DC\uAC00\uC2A4 \uC0AC\uC6A9 \uC5EC\uBD80");

        GasDiscountDetail detail = GasDiscountDetail.builder()
                .seniorId(senior.getId())
                .usesCityGas(true)
                .gasCompany("TEST")
                .gasCustomerNumber("TEST")
                .gasContractorName("TEST")
                .addressSame(true)
                .recentBillChecked(true)
                .basicOrNearPoor(true)
                .severeDisabilityOrMerit(false)
                .multiChildHousehold(false)
                .energyVoucherRecipient(false)
                .build();
        gasRepository.saveAndFlush(detail);
        assertLevel(senior, EnergySupportCase.SupportType.GAS,
                EnergySupportCase.EligibilityLevel.HIGH);

        detail.setUsesCityGas(false);
        gasRepository.saveAndFlush(detail);
        assertLevel(senior, EnergySupportCase.SupportType.GAS,
                EnergySupportCase.EligibilityLevel.LOW);
    }

    private void validateElectricitySaveReloadAndHistory(Senior senior) {
        EnergySupportCase.SupportType type =
                EnergySupportCase.SupportType.ELECTRICITY;

        EnergySupportCaseUpdateRequest initial = new EnergySupportCaseUpdateRequest();
        initial.setStatus(EnergySupportCase.SupportStatus.CONTACT_SCHEDULED);
        initial.setExistingApplicationStatus(
                EnergySupportCase.ExistingApplicationStatus.NOT_APPLIED);
        initial.setApplicationIntent(
                EnergySupportCase.ApplicationIntent.WANTS_TO_APPLY);
        initial.setContactMethod("PHONE_INITIAL");
        initial.setNextActionDate(LocalDate.now().plusDays(2));
        service.update(senior.getId(), type, initial,
                "WELFARE_WORKER", senior.getWelfareWorkerId());

        long before = activityRepository
                .findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(
                        senior.getId(), type).size();

        EnergySupportCaseUpdateRequest changed = new EnergySupportCaseUpdateRequest();
        changed.setStatus(EnergySupportCase.SupportStatus.ALREADY_APPLIED);
        changed.setExistingApplicationStatus(
                EnergySupportCase.ExistingApplicationStatus.ALREADY_APPLIED);
        changed.setApplicationIntent(EnergySupportCase.ApplicationIntent.UNKNOWN);
        changed.setContactMethod("VISIT");
        changed.setNextActionDate(LocalDate.now().plusDays(7));

        service.update(senior.getId(), type, changed,
                "WELFARE_WORKER", senior.getWelfareWorkerId());
        entityManager.flush();
        entityManager.clear();

        EnergySupportCase reloaded = caseRepository
                .findBySeniorIdAndSupportType(senior.getId(), type)
                .orElseThrow();
        assertThat(reloaded.getStatus())
                .isEqualTo(EnergySupportCase.SupportStatus.ALREADY_APPLIED);
        assertThat(reloaded.getExistingApplicationStatus())
                .isEqualTo(EnergySupportCase.ExistingApplicationStatus.ALREADY_APPLIED);
        assertThat(reloaded.getNextActionDate()).isNull();

        long afterChanged = activityRepository
                .findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(
                        senior.getId(), type).size();
        assertThat(afterChanged).isEqualTo(before + 1);

        service.update(senior.getId(), type, changed,
                "WELFARE_WORKER", senior.getWelfareWorkerId());
        entityManager.flush();
        entityManager.clear();

        EnergySupportCase reloadedAgain = caseRepository
                .findBySeniorIdAndSupportType(senior.getId(), type)
                .orElseThrow();
        assertThat(reloadedAgain.getStatus())
                .isEqualTo(EnergySupportCase.SupportStatus.ALREADY_APPLIED);
        assertThat(activityRepository
                .findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(
                        senior.getId(), type))
                .hasSize((int) afterChanged);
    }

    private void validateCompletionAndHistory(Senior senior) {
        EnergySupportCase.SupportType type = EnergySupportCase.SupportType.GAS;
        EnergySupportCaseUpdateRequest initial = new EnergySupportCaseUpdateRequest();
        initial.setStatus(EnergySupportCase.SupportStatus.CONFIRMATION_NEEDED);
        initial.setExistingApplicationStatus(
                EnergySupportCase.ExistingApplicationStatus.UNKNOWN);
        initial.setApplicationIntent(EnergySupportCase.ApplicationIntent.UNKNOWN);
        initial.setContactMethod("PHONE_INITIAL");
        service.update(senior.getId(), type, initial,
                "WELFARE_WORKER", senior.getWelfareWorkerId());

        long before = activityRepository
                .findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(
                        senior.getId(), type).size();

        EnergySupportCaseUpdateRequest request = new EnergySupportCaseUpdateRequest();
        request.setStatus(EnergySupportCase.SupportStatus.ALREADY_APPLIED);
        request.setExistingApplicationStatus(
                EnergySupportCase.ExistingApplicationStatus.ALREADY_APPLIED);
        request.setApplicationIntent(EnergySupportCase.ApplicationIntent.UNKNOWN);
        request.setNextActionDate(LocalDate.now().plusDays(5));
        request.setContactMethod("PHONE");

        service.update(senior.getId(), type, request,
                "WELFARE_WORKER", senior.getWelfareWorkerId());
        EnergySupportCase saved = caseRepository
                .findBySeniorIdAndSupportType(senior.getId(), type)
                .orElseThrow();
        assertThat(saved.getStatus())
                .isEqualTo(EnergySupportCase.SupportStatus.ALREADY_APPLIED);
        assertThat(saved.getNextActionDate()).isNull();
        assertThat(seniorRepository.findById(senior.getId())
                .orElseThrow()
                .getGasDiscountApplied()).isTrue();

        long afterFirst = activityRepository
                .findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(
                        senior.getId(), type).size();
        assertThat(afterFirst).isEqualTo(before + 1);

        service.update(senior.getId(), type, request,
                "WELFARE_WORKER", senior.getWelfareWorkerId());
        long afterSame = activityRepository
                .findBySeniorIdAndSupportTypeOrderByCreatedAtDesc(
                        senior.getId(), type).size();
        assertThat(afterSame).isEqualTo(afterFirst);

        assertThat(service.getCandidates(
                senior.getWelfareWorkerId(), type,
                EnergySupportCaseService.CandidateScope.ACTIVE))
                .noneMatch(item -> item.seniorId().equals(senior.getId()));
        assertThat(service.getCandidates(
                senior.getWelfareWorkerId(), type,
                EnergySupportCaseService.CandidateScope.COMPLETED))
                .anyMatch(item -> item.seniorId().equals(senior.getId()));
    }

    @SuppressWarnings("unchecked")
    private void assertMissing(
            Senior senior,
            EnergySupportCase.SupportType type,
            String expected
    ) throws Exception {
        assertThat(getMissing(senior, type)).contains(expected);
    }

    @SuppressWarnings("unchecked")
    private List<String> getMissing(
            Senior senior,
            EnergySupportCase.SupportType type
    ) throws Exception {
        Object target = AopTestUtils.getTargetObject(service);
        Method method = EnergySupportCaseService.class.getDeclaredMethod(
                "missingInformation", Senior.class,
                EnergySupportCase.SupportType.class,
                EnergySupportCase.class, GasDiscountDetail.class);
        method.setAccessible(true);
        List<String> missing = (List<String>) method.invoke(
                target, senior, type, null,
                type == EnergySupportCase.SupportType.GAS
                        ? gasRepository.findBySeniorId(senior.getId()).orElse(null)
                        : null);
        return missing;
    }

    private void assertLevel(
            Senior senior,
            EnergySupportCase.SupportType type,
            EnergySupportCase.EligibilityLevel expected
    ) throws Exception {
        Object target = AopTestUtils.getTargetObject(service);
        Method method = EnergySupportCaseService.class.getDeclaredMethod(
                "eligibilityLevel", Senior.class,
                EnergySupportCase.SupportType.class, GasDiscountDetail.class);
        method.setAccessible(true);
        Object level = method.invoke(
                target, senior, type,
                type == EnergySupportCase.SupportType.GAS
                        ? gasRepository.findBySeniorId(senior.getId()).orElse(null)
                        : null);
        assertThat(level).isEqualTo(expected);
    }
}
