package com.nuri.woori.controller;

import com.nuri.woori.entity.Guardian;
import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.JobPreference;
import com.nuri.woori.entity.LocationStatus;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.entity.WelfareWorker;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.GuardianRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.JobPreferenceRepository;
import com.nuri.woori.repository.LocationStatusRepository;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.repository.WelfareWorkerRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
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
    private final LocationStatusRepository locationStatusRepository;
    private final AlertRepository alertRepository;
    private final GuardianRepository guardianRepository;
    private final WelfareWorkerRepository welfareWorkerRepository;

    public SeniorController(
            SeniorRepository seniorRepository,
            HealthInfoRepository healthInfoRepository,
            JobPreferenceRepository jobPreferenceRepository,
            GuardianSeniorRepository guardianSeniorRepository,
            LocationStatusRepository locationStatusRepository,
            AlertRepository alertRepository,
            GuardianRepository guardianRepository,
            WelfareWorkerRepository welfareWorkerRepository
    ) {
        this.seniorRepository = seniorRepository;
        this.healthInfoRepository = healthInfoRepository;
        this.jobPreferenceRepository = jobPreferenceRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
        this.locationStatusRepository = locationStatusRepository;
        this.alertRepository = alertRepository;
        this.guardianRepository = guardianRepository;
        this.welfareWorkerRepository = welfareWorkerRepository;
    }

    @PostMapping
    public SeniorProfileResponse createSenior(@RequestBody SeniorCreateRequest request) {
        Senior senior = new Senior();
        senior.setName(request.name());
        senior.setBirthDate(toLocalDate(request.birthDate()));
        senior.setAge(toAge(request.birthDate(), request.age()));
        senior.setGender(request.gender());
        senior.setPhone(request.phone());
        senior.setAddress(request.region());
        senior.setRegion(request.region());
        senior.setDisabilityGrade(request.disabilityGrade());
        senior.setDisabilityType(request.disabilityType());
        senior.setProfileImageUrl(request.profileImageUrl());
        senior.setActive(true);

        Senior savedSenior = seniorRepository.save(senior);
        HealthInfo savedHealthInfo = healthInfoRepository.save(buildHealthInfo(savedSenior.getId(), request));
        JobPreference savedJobPreference = jobPreferenceRepository.save(buildJobPreference(savedSenior.getId(), request));

        return new SeniorProfileResponse(savedSenior, savedHealthInfo, savedJobPreference, "Guardian", getGuardiansForSenior(savedSenior.getId()), getWelfareWorkerForSenior(savedSenior));
    }

    @GetMapping
    public List<SeniorProfileResponse> getSeniors() {
        return seniorRepository.findAll().stream().map(this::toProfileResponse).toList();
    }

    @GetMapping("/search")
    public List<SeniorProfileResponse> searchSeniors(@RequestParam String keyword) {
        if (keyword == null || keyword.isBlank()) return List.of();
        return seniorRepository.searchByNameOrPhone(keyword.trim()).stream().map(this::toProfileResponse).toList();
    }

    @GetMapping("/search-exact")
    public List<SeniorProfileResponse> searchSeniorExact(@RequestParam String name, @RequestParam String phone) {
        String trimmedName = name == null ? "" : name.trim();
        String normalizedPhone = normalizePhone(phone);
        if (trimmedName.isBlank() || normalizedPhone.isBlank()) return List.of();
        return seniorRepository.findByNameAndNormalizedPhone(trimmedName, normalizedPhone)
                .map(senior -> List.of(toProfileResponse(senior)))
                .orElseGet(List::of);
    }

    @GetMapping("/guardian/{guardianId}")
    public List<SeniorProfileResponse> getSeniorsByGuardian(@PathVariable Long guardianId) {
        return guardianSeniorRepository.findByGuardianId(guardianId)
                .stream()
                .map(link -> seniorRepository.findById(link.getSeniorId()).map(senior -> toProfileResponse(senior, link.getRelation())))
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .toList();
    }

    @GetMapping("/{id}")
    public SeniorProfileResponse getSenior(@PathVariable Long id) {
        Senior senior = seniorRepository.findById(id).orElseThrow(() -> new RuntimeException("Senior not found"));
        return toProfileResponse(senior);
    }

    @PatchMapping("/{id}/welfare-worker")
    public SeniorProfileResponse updateSeniorWelfareWorker(@PathVariable Long id, @RequestBody SeniorWelfareWorkerRequest request) {
        Senior senior = seniorRepository.findById(id).orElseThrow(() -> new RuntimeException("Senior not found"));
        if (request.welfareWorkerId() != null) {
            welfareWorkerRepository.findById(request.welfareWorkerId()).orElseThrow(() -> new RuntimeException("Welfare worker not found"));
        }
        senior.setWelfareWorkerId(request.welfareWorkerId());
        return toProfileResponse(seniorRepository.save(senior));
    }

    @PatchMapping("/{id}/active")
    public SeniorProfileResponse updateSeniorActive(@PathVariable Long id, @RequestBody ActiveRequest request) {
        Senior senior = seniorRepository.findById(id).orElseThrow(() -> new RuntimeException("Senior not found"));
        senior.setActive(Boolean.TRUE.equals(request.active()));
        return toProfileResponse(seniorRepository.save(senior));
    }

    @PostMapping("/login")
    public SeniorProfileResponse loginSenior(@RequestBody SeniorLoginRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String phone = request.phone() == null ? "" : request.phone().replaceAll("[^0-9]", "");
        Senior senior = seniorRepository.findByNameAndNormalizedPhone(name, phone).orElseThrow(() -> new RuntimeException("Senior not found"));
        senior.setLastLoginAt(LocalDateTime.now());
        return toProfileResponse(seniorRepository.save(senior));
    }

    @PostMapping("/find-name")
    public ResponseEntity<FindNameResponse> findName(@RequestBody FindNameRequest request) {
        return seniorRepository.findByNormalizedPhone(normalizePhone(request.phone()))
                .map(senior -> ResponseEntity.ok(new FindNameResponse(maskName(senior.getName()))))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/find-phone")
    public ResponseEntity<FindPhoneResponse> findPhone(@RequestBody FindPhoneRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String region = request.region() == null ? "" : request.region().trim();
        List<Senior> seniors = seniorRepository.findByNameAndRegion(name, region);
        if (seniors.isEmpty()) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(new FindPhoneResponse(maskPhone(seniors.get(0).getPhone())));
    }

    @PutMapping("/{id}")
    public SeniorProfileResponse updateSenior(@PathVariable Long id, @RequestBody SeniorCreateRequest request) {
        Senior senior = seniorRepository.findById(id).orElseThrow(() -> new RuntimeException("Senior not found"));
        senior.setName(request.name());
        senior.setBirthDate(toLocalDate(request.birthDate()));
        senior.setAge(toAge(request.birthDate(), request.age()));
        senior.setGender(request.gender());
        senior.setPhone(request.phone());
        senior.setAddress(request.region());
        senior.setRegion(request.region());
        senior.setDisabilityGrade(request.disabilityGrade());
        senior.setDisabilityType(request.disabilityType());
        senior.setProfileImageUrl(request.profileImageUrl());

        Senior savedSenior = seniorRepository.save(senior);
        HealthInfo healthInfo = healthInfoRepository.findTopBySeniorIdOrderByCreatedAtDesc(id).orElseGet(HealthInfo::new);
        copyHealthInfo(healthInfo, id, request);
        HealthInfo savedHealthInfo = healthInfoRepository.save(healthInfo);

        JobPreference jobPreference = jobPreferenceRepository.findTopBySeniorIdOrderByCreatedAtDesc(id).orElseGet(JobPreference::new);
        copyJobPreference(jobPreference, id, request);
        JobPreference savedJobPreference = jobPreferenceRepository.save(jobPreference);

        return new SeniorProfileResponse(savedSenior, savedHealthInfo, savedJobPreference, "Guardian", getGuardiansForSenior(savedSenior.getId()), getWelfareWorkerForSenior(savedSenior));
    }

    @GetMapping("/welfare")
    public Object getWelfareSeniors(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        if (page == null && size == null) {
            return seniorRepository.findAll(Sort.by(Sort.Direction.ASC, "id")).stream().map(this::toWelfareSeniorListResponse).toList();
        }
        int pageNumber = Math.max(0, page == null ? 0 : page);
        int pageSize = Math.min(50, Math.max(1, size == null ? 6 : size));
        Page<Senior> seniorPage = seniorRepository.findAll(PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.ASC, "id")));
        return new WelfareSeniorPageResponse(seniorPage.getContent().stream().map(this::toWelfareSeniorListResponse).toList(), seniorPage.getTotalElements(), seniorPage.getTotalPages(), seniorPage.getNumber(), seniorPage.getSize());
    }

    private WelfareSeniorListResponse toWelfareSeniorListResponse(Senior senior) {
        HealthInfo healthInfo = healthInfoRepository.findTopBySeniorIdOrderByCreatedAtDesc(senior.getId()).orElse(null);
        LocationStatus latestLocation = locationStatusRepository.findTopBySeniorIdOrderByReceivedAtDesc(senior.getId()).orElse(null);
        boolean hasSosAlert = alertRepository.existsBySeniorIdAndTypeAndIsReadFalse(senior.getId(), "SOS");
        boolean hasSafeZoneExitAlert = alertRepository.existsBySeniorIdAndTypeAndIsReadFalse(senior.getId(), "SAFE_ZONE_EXIT");
        long jobRequestCount = alertRepository.countBySeniorIdAndTypeAndIsReadFalse(senior.getId(), "JOB_REQUEST");
        String alertStatus = hasSosAlert ? "SOS" : jobRequestCount > 0 ? "JOB_REQUEST" : "NONE";
        String locationStatus = hasSafeZoneExitAlert ? "SAFE_ZONE_EXIT" : "NORMAL";
        WelfareWorkerSummaryResponse welfareWorker = getWelfareWorkerForSenior(senior);

        return new WelfareSeniorListResponse(
                senior.getId(), senior.getName(), senior.getAge(), senior.getBirthDate(), senior.getAddress(), senior.getGender(), senior.getPhone(),
                senior.getRegion() == null ? senior.getAddress() : senior.getRegion(),
                healthInfo == null ? null : healthInfo.getHealthStatus(),
                locationStatus, alertStatus, senior.getWorkRequestStatus(), jobRequestCount,
                jobRequestCount > 0 ? "REQUEST " + jobRequestCount : "NONE",
                senior.getWelfareDecision(), senior.getWelfareDecisionReason(), senior.getLastLoginAt(),
                latestLocation == null ? null : latestLocation.getAddress(),
                latestLocation == null ? null : latestLocation.getLatitude(),
                latestLocation == null ? null : latestLocation.getLongitude(),
                latestLocation == null ? null : latestLocation.getReceivedAt(),
                !Boolean.FALSE.equals(senior.getActive()), senior.getWelfareWorkerId(), welfareWorker == null ? null : welfareWorker.name()
        );
    }

    private SeniorProfileResponse toProfileResponse(Senior senior, String relation) {
        HealthInfo healthInfo = healthInfoRepository.findTopBySeniorIdOrderByCreatedAtDesc(senior.getId()).orElse(null);
        JobPreference jobPreference = jobPreferenceRepository.findTopBySeniorIdOrderByCreatedAtDesc(senior.getId()).orElse(null);
        return new SeniorProfileResponse(senior, healthInfo, jobPreference, relation == null || relation.isBlank() ? "Guardian" : relation, getGuardiansForSenior(senior.getId()), getWelfareWorkerForSenior(senior));
    }

    private SeniorProfileResponse toProfileResponse(Senior senior) {
        return toProfileResponse(senior, "Guardian");
    }

    private List<GuardianSummaryResponse> getGuardiansForSenior(Long seniorId) {
        return guardianSeniorRepository.findBySeniorId(seniorId).stream()
                .map(link -> guardianRepository.findById(link.getGuardianId()).map(guardian -> toGuardianSummary(guardian, link.getRelation())))
                .filter(java.util.Optional::isPresent)
                .map(java.util.Optional::get)
                .toList();
    }

    private GuardianSummaryResponse toGuardianSummary(Guardian guardian, String relation) {
        return new GuardianSummaryResponse(guardian.getId(), guardian.getName(), guardian.getPhone(), guardian.getEmail(), relation, !Boolean.FALSE.equals(guardian.getActive()));
    }

    private WelfareWorkerSummaryResponse getWelfareWorkerForSenior(Senior senior) {
        if (senior.getWelfareWorkerId() == null) return null;
        return welfareWorkerRepository.findById(senior.getWelfareWorkerId())
                .map(worker -> new WelfareWorkerSummaryResponse(worker.getId(), worker.getWorkerId(), worker.getName(), worker.getCenter(), worker.getRegion(), worker.getPhone(), worker.getEmail(), !Boolean.FALSE.equals(worker.getActive())))
                .orElse(null);
    }

    private HealthInfo buildHealthInfo(Long seniorId, SeniorCreateRequest request) {
        HealthInfo healthInfo = new HealthInfo();
        copyHealthInfo(healthInfo, seniorId, request);
        return healthInfo;
    }

    private void copyHealthInfo(HealthInfo healthInfo, Long seniorId, SeniorCreateRequest request) {
        healthInfo.setSeniorId(seniorId);
        healthInfo.setHeight(toBigDecimal(request.height()));
        healthInfo.setWeight(toBigDecimal(request.weight()));
        healthInfo.setSmoking(request.smoking());
        healthInfo.setDrinking(request.drinking());
        healthInfo.setAllergies(request.allergies());
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
    }

    private JobPreference buildJobPreference(Long seniorId, SeniorCreateRequest request) {
        JobPreference jobPreference = new JobPreference();
        copyJobPreference(jobPreference, seniorId, request);
        return jobPreference;
    }

    private void copyJobPreference(JobPreference jobPreference, Long seniorId, SeniorCreateRequest request) {
        jobPreference.setSeniorId(seniorId);
        jobPreference.setPayType(request.payType());
        jobPreference.setHopeDays(join(request.hopeDays()));
        jobPreference.setHopeJobType(join(request.hopeJobType()));
        jobPreference.setHopeCondition(join(request.hopeCondition()));
        jobPreference.setMemo(request.memo());
    }

    private String normalizePhone(String phone) {
        return phone == null ? "" : phone.replaceAll("[^0-9]", "");
    }

    private String maskName(String name) {
        if (name == null || name.isBlank()) return "";
        if (name.length() <= 2) return name.charAt(0) + "*";
        return name.charAt(0) + "*" + name.substring(2);
    }

    private String maskPhone(String phone) {
        String digits = normalizePhone(phone);
        if (digits.length() < 8) return phone == null ? "" : phone;
        return digits.substring(0, 3) + "-****-" + digits.substring(digits.length() - 4);
    }

    private Integer toInteger(String value) {
        return value == null || value.isBlank() ? null : Integer.parseInt(value);
    }

    private LocalDate toLocalDate(String value) {
        return value == null || value.isBlank() ? null : LocalDate.parse(value);
    }

    private Integer toAge(String birthDate, String fallbackAge) {
        LocalDate parsedBirthDate = toLocalDate(birthDate);
        return parsedBirthDate != null ? Period.between(parsedBirthDate, LocalDate.now()).getYears() : toInteger(fallbackAge);
    }

    private BigDecimal toBigDecimal(String value) {
        return value == null || value.isBlank() ? null : new BigDecimal(value);
    }

    private String join(List<String> values) {
        if (values == null) return null;
        return values.stream().filter(Objects::nonNull).filter(value -> !value.isBlank()).reduce((left, right) -> left + "," + right).orElse(null);
    }

    public record FindNameRequest(String phone) {}
    public record FindNameResponse(String name) {}
    public record FindPhoneRequest(String name, String region) {}
    public record FindPhoneResponse(String phone) {}
    public record SeniorWelfareWorkerRequest(Long welfareWorkerId) {}
    public record ActiveRequest(Boolean active) {}
    public record WelfareSeniorListResponse(Long id, String name, Integer age, LocalDate birthDate, String address, String gender, String phone, String region, String healthStatus, String locationStatus, String alertStatus, String workRequestStatus, Long jobRequestCount, String jobRequestStatus, String welfareDecision, String welfareDecisionReason, LocalDateTime lastLoginAt, String lastGpsAddress, Double lastGpsLatitude, Double lastGpsLongitude, LocalDateTime lastGpsRecordedAt, Boolean active, Long welfareWorkerId, String welfareWorkerName) {}
    public record WelfareSeniorPageResponse(List<WelfareSeniorListResponse> content, Long totalElements, Integer totalPages, Integer page, Integer size) {}
    public record SeniorCreateRequest(String name, String age, String birthDate, String gender, String region, String phone, String disabilityGrade, String disabilityType, String profileImageUrl, String height, String weight, String smoking, String drinking, String allergies, String medicineCount, String medicationsJson, String diabetes, String hypertension, String heart, String joint, String stroke, String kidney, String lung, String liver, String cancer, String walkingAid, String dementia, String vision, String hearing, String recentFall, String hasSurgery, String surgeryDetail, String otherDisease, String maxHours, String maxDistance, List<String> disabledWork, String payType, List<String> hopeDays, List<String> hopeJobType, List<String> hopeCondition, String memo) {}
    public record SeniorLoginRequest(String name, String phone) {}
    public record SeniorProfileResponse(Senior senior, HealthInfo healthInfo, JobPreference jobPreference, String relation, List<GuardianSummaryResponse> guardians, WelfareWorkerSummaryResponse welfareWorker) {}
    public record GuardianSummaryResponse(Long id, String name, String phone, String email, String relation, Boolean active) {}
    public record WelfareWorkerSummaryResponse(Long id, String workerId, String name, String center, String region, String phone, String email, Boolean active) {}
}
