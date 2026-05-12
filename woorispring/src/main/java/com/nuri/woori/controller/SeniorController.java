package com.nuri.woori.controller;

import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.JobPreference;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.JobPreferenceRepository;
import com.nuri.woori.repository.SeniorRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/seniors")
@CrossOrigin(origins = "*")
public class SeniorController {

    private final SeniorRepository seniorRepository;
    private final HealthInfoRepository healthInfoRepository;
    private final JobPreferenceRepository jobPreferenceRepository;
    private final GuardianSeniorRepository guardianSeniorRepository;

    public SeniorController(
            SeniorRepository seniorRepository,
            HealthInfoRepository healthInfoRepository,
            JobPreferenceRepository jobPreferenceRepository,
            GuardianSeniorRepository guardianSeniorRepository
    ) {
        this.seniorRepository = seniorRepository;
        this.healthInfoRepository = healthInfoRepository;
        this.jobPreferenceRepository = jobPreferenceRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
    }

    @PostMapping
    public SeniorProfileResponse createSenior(@RequestBody SeniorCreateRequest request) {
        Senior senior = new Senior();
        senior.setName(request.name());
        senior.setAge(toInteger(request.age()));
        senior.setGender(request.gender());
        senior.setPhone(request.phone());
        senior.setAddress(request.region());
        senior.setRegion(request.region());
        senior.setDisabilityGrade(request.disabilityGrade());
        senior.setDisabilityType(request.disabilityType());
        senior.setProfileImageUrl(request.profileImageUrl());

        Senior savedSenior = seniorRepository.save(senior);

        HealthInfo healthInfo = new HealthInfo();
        healthInfo.setSeniorId(savedSenior.getId());
        healthInfo.setHeight(toBigDecimal(request.height()));
        healthInfo.setWeight(toBigDecimal(request.weight()));
        healthInfo.setSmoking(request.smoking());
        healthInfo.setDrinking(request.drinking());
        healthInfo.setMedicineCount(request.medicineCount());
        healthInfo.setMedicationsJson(request.medicationsJson());
        healthInfo.setDiabetes(request.diabetes());
        healthInfo.setHypertension(request.hypertension());
        healthInfo.setHeartDisease(request.heart());
        healthInfo.setJointDisease(request.joint());
        healthInfo.setStroke(request.stroke());
        healthInfo.setKidneyDisease(request.kidney());
        healthInfo.setLungDisease(request.lung());
        healthInfo.setLiverDisease(request.liver());
        healthInfo.setCancer(request.cancer());
        healthInfo.setWalkingAid(request.walkingAid());
        healthInfo.setDementia(request.dementia());
        healthInfo.setVision(request.vision());
        healthInfo.setHearing(request.hearing());
        healthInfo.setRecentFall(request.recentFall());
        healthInfo.setHasSurgery(request.hasSurgery());
        healthInfo.setSurgeryDetail(request.surgeryDetail());
        healthInfo.setOtherDisease(request.otherDisease());
        healthInfo.setMaxHours(request.maxHours());
        healthInfo.setMaxDistance(request.maxDistance());
        healthInfo.setDisabledWork(join(request.disabledWork()));

        HealthInfo savedHealthInfo = healthInfoRepository.save(healthInfo);

        JobPreference jobPreference = new JobPreference();
        jobPreference.setSeniorId(savedSenior.getId());
        jobPreference.setPayType(request.payType());
        jobPreference.setHopeDays(join(request.hopeDays()));
        jobPreference.setHopeJobType(join(request.hopeJobType()));
        jobPreference.setHopeCondition(join(request.hopeCondition()));
        jobPreference.setMemo(request.memo());

        JobPreference savedJobPreference = jobPreferenceRepository.save(jobPreference);

        return new SeniorProfileResponse(savedSenior, savedHealthInfo, savedJobPreference, "보호 대상자");
    }

    @GetMapping
    public List<SeniorProfileResponse> getSeniors() {
        return seniorRepository.findAll()
                .stream()
                .map(this::toProfileResponse)
                .toList();
    }

    @GetMapping("/search")
    public List<SeniorProfileResponse> searchSeniors(@RequestParam String keyword) {
        if (keyword == null || keyword.isBlank()) {
            return List.of();
        }

        return seniorRepository.searchByNameOrPhone(keyword.trim())
                .stream()
                .map(this::toProfileResponse)
                .toList();
    }

    @GetMapping("/guardian/{guardianId}")
    public List<SeniorProfileResponse> getSeniorsByGuardian(@PathVariable Long guardianId) {
        return guardianSeniorRepository.findByGuardianId(guardianId)
                .stream()
                .map(link -> seniorRepository.findById(link.getSeniorId())
                        .map(senior -> toProfileResponse(senior, link.getRelation())))
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .toList();
    }

    @GetMapping("/{id}")
    public SeniorProfileResponse getSenior(@PathVariable Long id) {
        Senior senior = seniorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        return toProfileResponse(senior);
    }

    @PostMapping("/login")
    public SeniorProfileResponse loginSenior(@RequestBody SeniorLoginRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String phone = request.phone() == null ? "" : request.phone().replaceAll("[^0-9]", "");

        Senior senior = seniorRepository.findByNameAndNormalizedPhone(name, phone)
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        senior.setLastLoginAt(LocalDateTime.now());
        Senior savedSenior = seniorRepository.save(senior);

        return toProfileResponse(savedSenior);
    }

    @PostMapping("/find-name")
    public ResponseEntity<FindNameResponse> findName(@RequestBody FindNameRequest request) {
        String phone = normalizePhone(request.phone());

        return seniorRepository.findByNormalizedPhone(phone)
                .map(senior -> ResponseEntity.ok(new FindNameResponse(maskName(senior.getName()))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/find-phone")
    public ResponseEntity<FindPhoneResponse> findPhone(@RequestBody FindPhoneRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String region = request.region() == null ? "" : request.region().trim();

        List<Senior> seniors = seniorRepository.findByNameAndRegion(name, region);

        if (seniors.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Senior senior = seniors.get(0);
        return ResponseEntity.ok(new FindPhoneResponse(maskPhone(senior.getPhone())));
    }

    private String normalizePhone(String phone) {
        if (phone == null) {
            return "";
        }

        return phone.replaceAll("[^0-9]", "");
    }

    private String maskName(String name) {
        if (name == null || name.isBlank()) {
            return "";
        }

        if (name.length() <= 2) {
            return name.charAt(0) + "*";
        }

        return name.charAt(0) + "*" + name.substring(2);
    }

    private String maskPhone(String phone) {
        String digits = normalizePhone(phone);

        if (digits.length() < 8) {
            return phone == null ? "" : phone;
        }

        return digits.substring(0, 3) + "-****-" + digits.substring(digits.length() - 4);
    }

    public record FindNameRequest(
            String phone
    ) {
    }

    public record FindNameResponse(
            String name
    ) {
    }

    public record FindPhoneRequest(
            String name,
            String region
    ) {
    }

    public record FindPhoneResponse(
            String phone
    ) {
    }

    @PutMapping("/{id}")
    public SeniorProfileResponse updateSenior(
            @PathVariable Long id,
            @RequestBody SeniorCreateRequest request
    ) {
        Senior senior = seniorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        senior.setName(request.name());
        senior.setAge(toInteger(request.age()));
        senior.setGender(request.gender());
        senior.setPhone(request.phone());
        senior.setAddress(request.region());
        senior.setRegion(request.region());
        senior.setDisabilityGrade(request.disabilityGrade());
        senior.setDisabilityType(request.disabilityType());
        senior.setProfileImageUrl(request.profileImageUrl());

        Senior savedSenior = seniorRepository.save(senior);

        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(id)
                .orElseGet(HealthInfo::new);

        healthInfo.setSeniorId(id);
        healthInfo.setHeight(toBigDecimal(request.height()));
        healthInfo.setWeight(toBigDecimal(request.weight()));
        healthInfo.setSmoking(request.smoking());
        healthInfo.setDrinking(request.drinking());
        healthInfo.setMedicineCount(request.medicineCount());
        healthInfo.setMedicationsJson(request.medicationsJson());
        healthInfo.setDiabetes(request.diabetes());
        healthInfo.setHypertension(request.hypertension());
        healthInfo.setHeartDisease(request.heart());
        healthInfo.setJointDisease(request.joint());
        healthInfo.setStroke(request.stroke());
        healthInfo.setKidneyDisease(request.kidney());
        healthInfo.setLungDisease(request.lung());
        healthInfo.setLiverDisease(request.liver());
        healthInfo.setCancer(request.cancer());
        healthInfo.setWalkingAid(request.walkingAid());
        healthInfo.setDementia(request.dementia());
        healthInfo.setVision(request.vision());
        healthInfo.setHearing(request.hearing());
        healthInfo.setRecentFall(request.recentFall());
        healthInfo.setHasSurgery(request.hasSurgery());
        healthInfo.setSurgeryDetail(request.surgeryDetail());
        healthInfo.setOtherDisease(request.otherDisease());
        healthInfo.setMaxHours(request.maxHours());
        healthInfo.setMaxDistance(request.maxDistance());
        healthInfo.setDisabledWork(join(request.disabledWork()));

        HealthInfo savedHealthInfo = healthInfoRepository.save(healthInfo);

        JobPreference jobPreference = jobPreferenceRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(id)
                .orElseGet(JobPreference::new);

        jobPreference.setSeniorId(id);
        jobPreference.setPayType(request.payType());
        jobPreference.setHopeDays(join(request.hopeDays()));
        jobPreference.setHopeJobType(join(request.hopeJobType()));
        jobPreference.setHopeCondition(join(request.hopeCondition()));
        jobPreference.setMemo(request.memo());

        JobPreference savedJobPreference = jobPreferenceRepository.save(jobPreference);

        return new SeniorProfileResponse(savedSenior, savedHealthInfo, savedJobPreference, "보호 대상자");
    }

    private SeniorProfileResponse toProfileResponse(Senior senior, String relation) {
        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        JobPreference jobPreference = jobPreferenceRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        return new SeniorProfileResponse(
                senior,
                healthInfo,
                jobPreference,
                relation == null || relation.isBlank() ? "보호 대상자" : relation
        );
    }

    private SeniorProfileResponse toProfileResponse(Senior senior) {
        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        JobPreference jobPreference = jobPreferenceRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        return new SeniorProfileResponse(senior, healthInfo, jobPreference, "보호 대상자");
    }

    private Integer toInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return Integer.parseInt(value);
    }

    private BigDecimal toBigDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return new BigDecimal(value);
    }

    private String join(List<String> values) {
        if (values == null) {
            return null;
        }

        return values.stream()
                .filter(Objects::nonNull)
                .filter(value -> !value.isBlank())
                .reduce((left, right) -> left + "," + right)
                .orElse(null);
    }

    public record SeniorCreateRequest(
            String name,
            String age,
            String gender,
            String region,
            String phone,
            String disabilityGrade,
            String disabilityType,
            String profileImageUrl,
            String height,
            String weight,
            String smoking,
            String drinking,
            String medicineCount,
            String medicationsJson,
            String diabetes,
            String hypertension,
            String heart,
            String joint,
            String stroke,
            String kidney,
            String lung,
            String liver,
            String cancer,
            String walkingAid,
            String dementia,
            String vision,
            String hearing,
            String recentFall,
            String hasSurgery,
            String surgeryDetail,
            String otherDisease,
            String maxHours,
            String maxDistance,
            List<String> disabledWork,
            String payType,
            List<String> hopeDays,
            List<String> hopeJobType,
            List<String> hopeCondition,
            String memo
    ) {
    }

    public record SeniorLoginRequest(
            String name,
            String phone
    ) {
    }

    public record SeniorProfileResponse(
            Senior senior,
            HealthInfo healthInfo,
            JobPreference jobPreference,
            String relation
    ) {
    }
}
