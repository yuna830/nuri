package com.nuri.woori.controller;

import com.nuri.woori.entity.HealthInfo;
import com.nuri.woori.entity.JobPreference;
import com.nuri.woori.entity.Senior;
import com.nuri.woori.entity.SafeZones;
import com.nuri.woori.controller.SeniorController.FindNameResponse;
import com.nuri.woori.entity.Guardian;
import com.nuri.woori.entity.GuardianSenior;
import com.nuri.woori.entity.LocationStatus;
import com.nuri.woori.entity.WelfareWorker;
import com.nuri.woori.repository.AlertRepository;
import com.nuri.woori.repository.LocationStatusRepository;
import com.nuri.woori.repository.GuardianRepository;
import com.nuri.woori.repository.GuardianSeniorRepository;
import com.nuri.woori.repository.HealthInfoRepository;
import com.nuri.woori.repository.JobPreferenceRepository;
import com.nuri.woori.repository.SeniorRepository;
import com.nuri.woori.repository.WelfareWorkerRepository;
import com.nuri.woori.repository.SafeZonesRepository;
import com.nuri.woori.repository.WelfareWorkerRepository;
import com.nuri.woori.service.HealthStatusMlService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

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
    private final SafeZonesRepository safeZonesRepository;
    private final HealthInfoRepository healthInfoRepository;
    private final JobPreferenceRepository jobPreferenceRepository;
    private final GuardianRepository guardianRepository;
    private final GuardianSeniorRepository guardianSeniorRepository;
    private final LocationStatusRepository locationStatusRepository;
    private final AlertRepository alertRepository;
    private final WelfareWorkerRepository welfareWorkerRepository;
    private final HealthStatusMlService healthStatusMlService;

    public SeniorController(
            SeniorRepository seniorRepository,
            SafeZonesRepository safeZonesRepository,
            HealthInfoRepository healthInfoRepository,
            JobPreferenceRepository jobPreferenceRepository,
            GuardianRepository guardianRepository,
            GuardianSeniorRepository guardianSeniorRepository,
            LocationStatusRepository locationStatusRepository,
            AlertRepository alertRepository,
            WelfareWorkerRepository welfareWorkerRepository,
            HealthStatusMlService healthStatusMlService) {
        this.seniorRepository = seniorRepository;
        this.safeZonesRepository = safeZonesRepository;
        this.healthInfoRepository = healthInfoRepository;
        this.jobPreferenceRepository = jobPreferenceRepository;
        this.guardianRepository = guardianRepository;
        this.guardianSeniorRepository = guardianSeniorRepository;
        this.locationStatusRepository = locationStatusRepository;
        this.alertRepository = alertRepository;
        this.welfareWorkerRepository = welfareWorkerRepository;
        this.healthStatusMlService = healthStatusMlService;
    }

    @PostMapping
    public SeniorProfileResponse createSenior(@RequestBody SeniorCreateRequest request) {
        if (request.phone() != null && !request.phone().isBlank()) {
            String normalizedPhone = normalizePhone(request.phone());
            seniorRepository.findByNormalizedPhone(normalizedPhone).ifPresent(existing -> {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "이미 등록된 전화번호입니다.");
            });
        }
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

        Senior savedSenior = seniorRepository.save(senior);

        HealthInfo healthInfo = new HealthInfo();
        healthInfo.setSeniorId(savedSenior.getId());
        healthInfo.setHeight(toBigDecimal(request.height()));
        healthInfo.setWeight(toBigDecimal(request.weight()));
        healthInfo.setSmoking(request.smoking());
        healthInfo.setDrinking(request.drinking());
        healthInfo.setAllergies(request.allergies());
        healthInfo.setIncomeLevel(request.incomeLevel());
        healthInfo.setLivingCostStatus(request.livingCostStatus());
        healthInfo.setHouseholdType(request.householdType());
        healthInfo.setPensionStatus(request.pensionStatus());
        healthInfo.setHousingType(request.housingType());
        healthInfo.setCurrentBenefits(join(request.currentBenefits()));
        healthInfo.setCareNeeds(join(request.careNeeds()));
        healthInfo.setWelfareMemo(request.welfareMemo());
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
        healthInfo.setRestNeed(request.restNeed());
        healthInfo.setAvoidEnvironment(join(request.avoidEnvironment()));
        HealthStatusMlService.HealthEvaluation healthEvaluation =
                healthStatusMlService.evaluateWithDetails(savedSenior, healthInfo);
        healthInfo.setHealthStatus(healthEvaluation.status());

        HealthInfo savedHealthInfo = healthInfoRepository.save(healthInfo);

        JobPreference jobPreference = new JobPreference();
        jobPreference.setSeniorId(savedSenior.getId());
        jobPreference.setPayType(request.payType());
        jobPreference.setHopeDays(join(request.hopeDays()));
        jobPreference.setHopeJobType(join(request.hopeJobType()));
        jobPreference.setHopeCondition(join(request.hopeCondition()));
        jobPreference.setMemo(request.memo());

        JobPreference savedJobPreference = jobPreferenceRepository.save(jobPreference);

        return new SeniorProfileResponse(
                savedSenior,
                savedHealthInfo,
                savedJobPreference,
                "보호 대상자",
                null,
                "",
                "",
                null,
                null,
                null,
                "",
                "",
                "",
                healthEvaluation);
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

    @GetMapping("/search-exact")
    public List<SeniorProfileResponse> searchSeniorExact(
            @RequestParam String name,
            @RequestParam String phone) {
        String trimmedName = name == null ? "" : name.trim();
        String normalizedPhone = normalizePhone(phone);

        if (trimmedName.isBlank() || normalizedPhone.isBlank()) {
            return List.of();
        }

        return seniorRepository.findByNameAndNormalizedPhone(trimmedName, normalizedPhone)
                .map(senior -> List.of(toProfileResponse(senior)))
                .orElseGet(List::of);
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

        return toProfileResponseWithHealthEvaluation(senior);
    }

//    @PatchMapping("/{id}/welfare-worker")
//    public SeniorProfileResponse updateSeniorWelfareWorker(
//            @PathVariable Long id,
//            @RequestBody SeniorWelfareWorkerRequest request
//    ) {
//        Senior senior = seniorRepository.findById(id)
//                .orElseThrow(() -> new RuntimeException("Senior not found"));
//
//        if (request.welfareWorkerId() != null) {
//            welfareWorkerRepository.findById(request.welfareWorkerId())
//                    .orElseThrow(() -> new RuntimeException("Welfare worker not found"));
//        }
//
//        senior.setWelfareWorkerId(request.welfareWorkerId());
//        Senior savedSenior = seniorRepository.save(senior);
//
//        return toProfileResponse(savedSenior);
//    }
    @PostMapping("/login")
    public SeniorProfileResponse loginSenior(@RequestBody SeniorLoginRequest request) {
        String name = request.name() == null ? "" : request.name().trim();
        String phone = request.phone() == null ? "" : request.phone().replaceAll("[^0-9]", "");

        Senior senior = seniorRepository.findByNameAndNormalizedPhone(name, phone)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Senior not found"));

        if (Boolean.FALSE.equals(senior.getActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Inactive account");
        }

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

    private boolean isFilled(String value) {
        return value != null && !value.isBlank();
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
            String phone) {
    }

    public record FindNameResponse(
            String name) {
    }

    public record FindPhoneRequest(
            String name,
            String region) {
    }

    public record FindPhoneResponse(
            String phone) {
    }

    @PutMapping("/{id}")
    public SeniorProfileResponse updateSenior(
            @PathVariable Long id,
            @RequestBody SeniorCreateRequest request) {
        Senior senior = seniorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Senior not found"));

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
        if (request.fallApiUrl() != null) {
            senior.setFallApiUrl(request.fallApiUrl().isBlank() ? null : request.fallApiUrl().trim());
        }

        Senior savedSenior = seniorRepository.save(senior);

        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(id)
                .orElseGet(HealthInfo::new);

        healthInfo.setSeniorId(id);
        healthInfo.setHeight(toBigDecimal(request.height()));
        healthInfo.setWeight(toBigDecimal(request.weight()));
        healthInfo.setSmoking(request.smoking());
        healthInfo.setDrinking(request.drinking());
        healthInfo.setAllergies(request.allergies());
        healthInfo.setIncomeLevel(request.incomeLevel());
        healthInfo.setLivingCostStatus(request.livingCostStatus());
        healthInfo.setHouseholdType(request.householdType());
        healthInfo.setPensionStatus(request.pensionStatus());
        healthInfo.setHousingType(request.housingType());
        healthInfo.setCurrentBenefits(join(request.currentBenefits()));
        healthInfo.setCareNeeds(join(request.careNeeds()));
        healthInfo.setWelfareMemo(request.welfareMemo());
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
        healthInfo.setRestNeed(request.restNeed());
        healthInfo.setAvoidEnvironment(join(request.avoidEnvironment()));
        HealthStatusMlService.HealthEvaluation healthEvaluation =
                healthStatusMlService.evaluateWithDetails(savedSenior, healthInfo);
        healthInfo.setHealthStatus(healthEvaluation.status());

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

        return new SeniorProfileResponse(
                savedSenior,
                savedHealthInfo,
                savedJobPreference,
                "보호 대상자",
                null,
                "",
                "",
                null,
                null,
                null,
                "",
                "",
                "",
                healthEvaluation);
    }

    @PatchMapping("/{id}/decision")
    public SeniorProfileResponse updateWelfareDecision(
            @PathVariable Long id,
            @RequestBody WelfareDecisionRequest request) {
        Senior senior = seniorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        senior.setWelfareDecision(request.decision());
        senior.setWelfareDecisionReason(request.reason());
        senior.setWorkRequestStatus("검토");

        Senior savedSenior = seniorRepository.save(senior);

        return toProfileResponse(savedSenior);
    }

    @PatchMapping("/{id}/fall-api-url")
    public ResponseEntity<Void> updateFallApiUrl(
            @PathVariable Long id,
            @RequestBody java.util.Map<String, String> body) {
        Senior senior = seniorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Senior not found"));
        String url = body.get("fallApiUrl");
        senior.setFallApiUrl(url == null || url.isBlank() ? null : url.trim());
        seniorRepository.save(senior);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/{id}/requested-info")
    public SeniorProfileResponse updateRequestedInfo(
            @PathVariable Long id,
            @RequestBody SeniorRequestedInfoUpdateRequest request) {
        Senior senior = seniorRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Senior not found"));

        if (request.gender() != null) {
            senior.setGender(request.gender());
        }

        if (request.phone() != null) {
            senior.setPhone(request.phone());
        }

        if (request.birthDate() != null) {
            senior.setBirthDate(toLocalDate(request.birthDate()));
            senior.setAge(toAge(request.birthDate(), null));
        }

        if (request.region() != null) {
            senior.setRegion(request.region());
            senior.setAddress(request.region());
        }

        if (request.profileImageUrl() != null) {
            senior.setProfileImageUrl(request.profileImageUrl());
        }

        if (request.guardianName() != null) {
            senior.setGuardianName(request.guardianName());
        }

        if (request.disabilityGrade() != null) {
            senior.setDisabilityGrade(request.disabilityGrade());
        }

        if (request.disabilityType() != null) {
            senior.setDisabilityType(request.disabilityType());
        }

        if (request.guardianRelation() != null) {
            senior.setGuardianRelation(request.guardianRelation());
        }

        Senior savedSenior = seniorRepository.save(senior);

        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(id)
                .orElseGet(HealthInfo::new);

        healthInfo.setSeniorId(id);

        if (request.incomeLevel() != null) {
            healthInfo.setIncomeLevel(request.incomeLevel());
        }

        if (request.householdType() != null) {
            healthInfo.setHouseholdType(request.householdType());
        }

        if (request.diabetes() != null) {
            healthInfo.setDiabetes(request.diabetes());
        }

        if (request.hypertension() != null) {
            healthInfo.setHypertension(request.hypertension());
        }

        if (request.heartDisease() != null) {
            healthInfo.setHeartDisease(request.heartDisease());
        }

        if (request.jointDisease() != null) {
            healthInfo.setJointDisease(request.jointDisease());
        }

        if (request.stroke() != null) {
            healthInfo.setStroke(request.stroke());
        }

        if (request.kidneyDisease() != null) {
            healthInfo.setKidneyDisease(request.kidneyDisease());
        }

        if (request.lungDisease() != null) {
            healthInfo.setLungDisease(request.lungDisease());
        }

        if (request.liverDisease() != null) {
            healthInfo.setLiverDisease(request.liverDisease());
        }

        if (request.cancer() != null) {
            healthInfo.setCancer(request.cancer());
        }

        if (request.walkingAid() != null) {
            healthInfo.setWalkingAid(request.walkingAid());
        }

        if (request.dementia() != null) {
            healthInfo.setDementia(request.dementia());
        }

        if (request.vision() != null) {
            healthInfo.setVision(request.vision());
        }

        if (request.hearing() != null) {
            healthInfo.setHearing(request.hearing());
        }

        if (request.recentFall() != null) {
            healthInfo.setRecentFall(request.recentFall());
        }

        if (request.hasSurgery() != null) {
            healthInfo.setHasSurgery(request.hasSurgery());
        }

        if (request.surgeryDetail() != null) {
            healthInfo.setSurgeryDetail(request.surgeryDetail());
        }

        if (request.otherDisease() != null) {
            healthInfo.setOtherDisease(request.otherDisease());
        }

        if (request.medicationsJson() != null) {
            healthInfo.setMedicationsJson(request.medicationsJson());
            healthInfo.setMedicineCount(request.medicationsJson().isBlank() ? "없음" : "1개 이상");
        }

        healthInfo.setHealthStatus(healthStatusMlService.evaluate(savedSenior, healthInfo));
        healthInfoRepository.save(healthInfo);

        return toProfileResponse(savedSenior);
    }

    public record SeniorRequestedInfoUpdateRequest(
            String gender,
            String phone,
            String birthDate,
            String region,
            String profileImageUrl,
            String incomeLevel,
            String householdType,
            String disabilityGrade,
            String disabilityType,
            String diabetes,
            String hypertension,
            String heartDisease,
            String jointDisease,
            String stroke,
            String kidneyDisease,
            String lungDisease,
            String liverDisease,
            String cancer,
            String walkingAid,
            String dementia,
            String vision,
            String hearing,
            String recentFall,
            String hasSurgery,
            String surgeryDetail,
            String otherDisease,
            String medicationsJson,
            String guardianName,
            String guardianRelation) {
    }

    @GetMapping("/welfare")
    public Object getWelfareSeniors(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Long welfareWorkerId) {
        if (page == null && size == null) {
            List<Senior> seniors = welfareWorkerId == null
                    ? seniorRepository.findAll(Sort.by(Sort.Direction.DESC, "id"))
                    : seniorRepository.findByWelfareWorkerIdOrderByIdDesc(welfareWorkerId);

            return seniors
                    .stream()
                    .map(this::toWelfareSeniorListResponse)
                    .toList();
        }

        int pageNumber = Math.max(0, page == null ? 0 : page);
        int pageSize = Math.min(50, Math.max(1, size == null ? 6 : size));
        PageRequest pageRequest = PageRequest.of(pageNumber, pageSize, Sort.by(Sort.Direction.DESC, "id"));
        Page<Senior> seniorPage = welfareWorkerId == null
                ? seniorRepository.findAll(pageRequest)
                : seniorRepository.findByWelfareWorkerId(welfareWorkerId, pageRequest);

        return new WelfareSeniorPageResponse(
                seniorPage.getContent()
                        .stream()
                        .map(this::toWelfareSeniorListResponse)
                        .toList(),
                seniorPage.getTotalElements(),
                seniorPage.getTotalPages(),
                seniorPage.getNumber(),
                seniorPage.getSize());
    }

    @PatchMapping("/{id}/welfare-worker")
    public ResponseEntity<SeniorProfileResponse> updateSeniorWelfareWorker(
            @PathVariable Long id,
            @RequestBody SeniorWelfareWorkerRequest request) {
        return seniorRepository.findById(id)
                .map(senior -> {
                    senior.setWelfareWorkerId(request.welfareWorkerId());
                    Senior savedSenior = seniorRepository.save(senior);
                    return ResponseEntity.ok(toProfileResponse(savedSenior));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    private WelfareSeniorListResponse toWelfareSeniorListResponse(Senior senior) {
        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        JobPreference jobPreference = jobPreferenceRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        LocationStatus latestLocation = locationStatusRepository
                .findTopBySeniorIdOrderByReceivedAtDesc(senior.getId())
                .orElse(null);

        boolean hasGuardian = !guardianSeniorRepository.findBySeniorId(senior.getId()).isEmpty();

        boolean hasSosAlert = alertRepository
                .existsBySeniorIdAndTypeAndIsReadFalse(senior.getId(), "SOS");

        boolean hasSafeZoneExitAlert = alertRepository
                .existsBySeniorIdAndTypeAndIsReadFalse(senior.getId(), "SAFE_ZONE_EXIT");

        long jobRequestCount = alertRepository
                .countBySeniorIdAndTypeAndIsReadFalse(senior.getId(), "JOB_REQUEST");

        String alertStatus = hasSosAlert
                ? "미응답 SOS"
                : jobRequestCount > 0 ? "일자리 요청" : "없음";

        String locationStatus = hasSafeZoneExitAlert ? "안전구역 이탈" : "정상";

        return new WelfareSeniorListResponse(
                senior.getId(),
                senior.getName(),
                senior.getAge(),
                senior.getBirthDate(),
                senior.getAddress(),
                senior.getGender(),
                senior.getPhone(),
                senior.getRegion() == null ? senior.getAddress() : senior.getRegion(),
                healthInfo == null ? null : healthInfo.getHealthStatus(),
                locationStatus,
                alertStatus,
                senior.getWorkRequestStatus(),
                jobRequestCount,
                jobRequestCount > 0 ? "요청 " + jobRequestCount + "건" : "미요청",
                senior.getWelfareDecision(),
                senior.getWelfareDecisionReason(),
                senior.getLastLoginAt(),
                latestLocation == null ? null : latestLocation.getAddress(),
                latestLocation == null ? null : latestLocation.getLatitude(),
                latestLocation == null ? null : latestLocation.getLongitude(),
                latestLocation == null ? null : latestLocation.getReceivedAt(),
                hasGuardian,
                isFilled(senior.getDisabilityGrade()) && isFilled(senior.getDisabilityType()),
                healthInfo != null && healthInfo.getHeight() != null && healthInfo.getWeight() != null,
                healthInfo != null &&
                    isFilled(healthInfo.getSmoking()) && isFilled(healthInfo.getDrinking()) &&
                    isFilled(healthInfo.getDiabetes()) && isFilled(healthInfo.getHypertension()) &&
                    isFilled(healthInfo.getHeartDisease()) && isFilled(healthInfo.getJointDisease()) &&
                    isFilled(healthInfo.getStroke()) && isFilled(healthInfo.getKidneyDisease()) &&
                    isFilled(healthInfo.getLungDisease()) && isFilled(healthInfo.getLiverDisease()) &&
                    isFilled(healthInfo.getCancer()) && isFilled(healthInfo.getWalkingAid()) &&
                    isFilled(healthInfo.getDementia()) && isFilled(healthInfo.getVision()) &&
                    isFilled(healthInfo.getHearing()) && isFilled(healthInfo.getRecentFall()),
                healthInfo != null && isFilled(healthInfo.getMedicineCount()),
                healthInfo != null &&
                        isFilled(healthInfo.getLivingCostStatus()) && isFilled(healthInfo.getHouseholdType()) &&
                        isFilled(healthInfo.getPensionStatus()) && isFilled(healthInfo.getHousingType()),
                    senior.getGuardianName(),    
                    senior.getGuardianPhone());
    }

    public record WelfareSeniorListResponse(
            Long id,
            String name,
            Integer age,
            LocalDate birthDate,
            String address,
            String gender,
            String phone,
            String region,
            String healthStatus,
            String locationStatus,
            String alertStatus,
            String workRequestStatus,
            Long jobRequestCount,
            String jobRequestStatus,
            String welfareDecision,
            String welfareDecisionReason,
            LocalDateTime lastLoginAt,
            String lastGpsAddress,
            Double lastGpsLatitude,
            Double lastGpsLongitude,
            LocalDateTime lastGpsRecordedAt,
            Boolean hasGuardian,
            Boolean hasDisabilityInfo,
            Boolean hasBodyInfo,
            Boolean hasHealthInfo,
            Boolean hasMedicationInfo,
            Boolean hasWelfareInfo,
            String guardianName,
            String guardianPhone) {
    }

    public record SeniorWelfareWorkerRequest(
            Long welfareWorkerId) {
    }

    public record WelfareDecisionRequest(
            String decision,
            String reason) {
    }

    public record WelfareSeniorPageResponse(
            List<WelfareSeniorListResponse> content,
            Long totalElements,
            Integer totalPages,
            Integer page,
            Integer size) {
    }

    private SeniorProfileResponse toProfileResponse(Senior senior, String relation) {
        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        JobPreference jobPreference = jobPreferenceRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        SafeZones safeZone = safeZonesRepository.findBySeniorIdOrderByIdAsc(senior.getId())
                .stream()
                .findFirst()
                .orElse(null);

        LocationStatus latestLocation = locationStatusRepository
                .findTopBySeniorIdOrderByReceivedAtDesc(senior.getId())
                .orElse(null);
        WelfareWorker welfareWorker = findWelfareWorker(senior);

        return new SeniorProfileResponse(
                senior,
                healthInfo,
                jobPreference,
                relation == null || relation.isBlank() ? "보호 대상자" : relation,
                null,
                "",
                "",
                safeZone,
                latestLocation,
                welfareWorker == null ? null : welfareWorker.getId(),
                welfareWorker == null ? "" : welfareWorker.getName(),
                welfareWorker == null ? "" : welfareWorker.getPhone(),
                welfareWorker == null ? "" : welfareWorker.getCenter(),
                null);
    }

    private SeniorProfileResponse toProfileResponse(Senior senior) {
        HealthInfo healthInfo = healthInfoRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        JobPreference jobPreference = jobPreferenceRepository
                .findTopBySeniorIdOrderByCreatedAtDesc(senior.getId())
                .orElse(null);

        GuardianSenior link = guardianSeniorRepository.findBySeniorId(senior.getId())
                .stream()
                .findFirst()
                .orElse(null);

        Guardian guardian = link == null
                ? null
                : guardianRepository.findById(link.getGuardianId()).orElse(null);

        SafeZones safeZone = safeZonesRepository.findBySeniorIdOrderByIdAsc(senior.getId())
                .stream()
                .findFirst()
                .orElse(null);

        LocationStatus latestLocation = locationStatusRepository
                .findTopBySeniorIdOrderByReceivedAtDesc(senior.getId())
                .orElse(null);
        WelfareWorker welfareWorker = findWelfareWorker(senior);

        return new SeniorProfileResponse(
                senior,
                healthInfo,
                jobPreference,
                link == null ? "" : link.getRelation(),
                guardian == null ? null : guardian.getId(),
                guardian == null ? "" : guardian.getName(),
                guardian == null ? "" : guardian.getPhone(),
                safeZone,
                latestLocation,
                welfareWorker == null ? null : welfareWorker.getId(),
                welfareWorker == null ? "" : welfareWorker.getName(),
                welfareWorker == null ? "" : welfareWorker.getPhone(),
                welfareWorker == null ? "" : welfareWorker.getCenter(),
                null);
    }

    private SeniorProfileResponse toProfileResponseWithHealthEvaluation(Senior senior) {
        SeniorProfileResponse response = toProfileResponse(senior);
        return new SeniorProfileResponse(
                response.senior(),
                response.healthInfo(),
                response.jobPreference(),
                response.relation(),
                response.guardianId(),
                response.guardianName(),
                response.guardianPhone(),
                response.safeZone(),
                response.lastGps(),
                response.welfareWorkerId(),
                response.socialWorkerName(),
                response.socialWorkerPhone(),
                response.socialWorkerCenter(),
                healthStatusMlService.evaluateWithDetails(response.senior(), response.healthInfo()));
    }

    private WelfareWorker findWelfareWorker(Senior senior) {
        if (senior == null || senior.getWelfareWorkerId() == null) {
            return null;
        }

        return welfareWorkerRepository.findById(senior.getWelfareWorkerId()).orElse(null);
    }

    private Integer toInteger(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return Integer.parseInt(value);
    }

    private LocalDate toLocalDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        return LocalDate.parse(value);
    }

    private Integer toAge(String birthDate, String fallbackAge) {
        LocalDate parsedBirthDate = toLocalDate(birthDate);
        if (parsedBirthDate != null) {
            return Period.between(parsedBirthDate, LocalDate.now()).getYears();
        }

        return toInteger(fallbackAge);
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
            String birthDate,
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
            String allergies,
            String incomeLevel,
            String livingCostStatus,
            String householdType,
            String pensionStatus,
            String housingType,
            List<String> currentBenefits,
            List<String> careNeeds,
            String welfareMemo,
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
            String restNeed,
            List<String> avoidEnvironment,
            String payType,
            List<String> hopeDays,
            List<String> hopeJobType,
            List<String> hopeCondition,
            String memo,
            String fallApiUrl) {
    }

    public record SeniorLoginRequest(
            String name,
            String phone) {
    }

    public record SeniorProfileResponse(
            Senior senior,
            HealthInfo healthInfo,
            JobPreference jobPreference,
            String relation,
            Long guardianId,
            String guardianName,
            String guardianPhone,
            SafeZones safeZone,
            LocationStatus lastGps,
            Long welfareWorkerId,
            String socialWorkerName,
            String socialWorkerPhone,
            String socialWorkerCenter,
            HealthStatusMlService.HealthEvaluation healthEvaluation) {
    }
}
