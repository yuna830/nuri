import { mapWelfareInfoForRag } from "./welfareInfoMap.js";

export const NONE = "없음";

export const CHRONIC = [
  { key: "diabetes", label: "당뇨", levels: [NONE, "약이나 식단으로 관리 중", "최근 조절이 어렵거나 도움이 필요함"] },
  { key: "hypertension", label: "고혈압", levels: [NONE, "약으로 관리 중", "최근 혈압 변동이 크거나 도움이 필요함"] },
  { key: "heart", label: "심장질환", levels: [NONE, "정기 진료/약으로 관리 중", "숨참/가슴통증 등으로 활동 제한"] },
  { key: "joint", label: "관절질환", levels: [NONE, "가끔 통증이 있으나 보행 가능", "통증 때문에 보행/작업 제한"] },
  { key: "stroke", label: "뇌졸중", levels: [NONE, "후유증이 조금 있으나 일상 가능", "마비/언어 등으로 도움이 필요함"] },
  { key: "kidney", label: "신장질환", levels: [NONE, "정기 진료로 관리 중", "투석/잦은 치료가 필요함"] },
  { key: "lung", label: "호흡기질환", levels: [NONE, "가끔 숨참/기침이 있음", "호흡 문제로 활동 제한"] },
  { key: "liver", label: "간질환", levels: [NONE, "정기 진료로 관리 중", "치료/생활 제한이 필요함"] },
  { key: "cancer", label: "암", levels: [NONE, "완치 후 관리 중", "현재 치료 중"] },
];

export const WORK_TYPES = [
  "장시간 서있기",
  "실외 작업",
  "야간 근무",
  "무거운 물건 운반",
  "컴퓨터 작업",
  "계단 이동",
  "반복 작업",
  "고객 응대",
];

export const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export const JOB_TYPES = [
  "경비/청소",
  "급식/조리 보조",
  "사무 보조",
  "돌봄 보조",
  "작업/수공예",
  "판매/안내",
  "환경 정비",
  "상관없음",
];

export const JOB_CONDITIONS = [
  "실내 근무 선호",
  "안전 근무",
  "오후 근무",
  "주 3일 이하",
  "단기 가능",
  "앉아서 근무",
];

export const DISABILITY_GRADES = [NONE, "1급", "2급", "3급", "4급", "5급", "6급"];
export const DISABILITY_TYPES = [NONE, "지체장애", "시각장애", "청각장애", "언어장애", "지적장애", "정신장애", "기타"];
export const MEDICINE_COUNTS = [NONE, "1~2개", "3~5개", "6개 이상"];
export const VISION_LEVELS = [NONE, "글씨가 조금 흐림", "큰 글씨만 보임", "거의 보이지 않음"];
export const HEARING_LEVELS = [NONE, "작은 소리가 잘 안 들림", "큰 소리로 말해야 들림", "거의 들리지 않음"];
export const REST_NEEDS = [
  NONE,
  "30분마다 5분",
  "1시간마다 5분",
  "1시간마다 10분",
  "2시간마다 10분",
  "2시간마다 15분",
  "3시간마다 15분",
  "필요할 때 짧게 쉬기",
];
export const AVOID_ENVIRONMENTS = ["소음 많은 곳", "먼지 많은 곳", "덥거나 추운 곳", "미끄러운 바닥", "사람 많은 곳", "혼자 하는 작업"];
export const LIVING_COST_STATUSES = [
  "잘 모르겠어요",
  "수입이 거의 없어요",
  "기초연금 정도만 받아요",
  "가족에게 일부 도움을 받아요",
  "연금이나 월급 수입이 있어요",
  "생계비/의료비/주거비 지원을 받고 있어요",
];
export const HOUSEHOLD_TYPES = [
  "잘 모르겠어요",
  "혼자 살아요",
  "배우자와 살아요",
  "자녀/가족과 살아요",
  "시설이나 요양원에 있어요",
  "기타",
];
export const CURRENT_BENEFITS = [
  "잘 모르겠어요",
  "받고 있는 지원이 없어요",
  "기초연금",
  "생계비/의료비/주거비 지원",
  "장기요양 서비스",
  "장애 관련 지원",
  "노인 일자리",
  "노인맞춤돌봄서비스",
  "응급안전안심서비스",
];
export const PENSION_STATUSES = [
  "잘 모르겠어요",
  "기초연금을 받고 있어요",
  "국민연금을 받고 있어요",
  "기초연금과 국민연금을 모두 받고 있어요",
  "신청했지만 기다리는 중이에요",
  "신청한 적 없어요",
];
export const HOUSING_TYPES = [
  "잘 모르겠어요",
  "자가",
  "전세",
  "월세",
  "공공임대",
  "시설이나 요양원",
  "기타",
];
export const CARE_NEEDS = [
  "잘 모르겠어요",
  "특별히 없어요",
  "식사 준비",
  "청소/빨래",
  "목욕/위생",
  "병원 동행",
  "외출/장보기",
  "약 챙기기",
  "안부 확인",
];
export const SECTIONS = [
  { id: "personal", label: "인적사항" },
  { id: "body", label: "신체정보" },
  { id: "medication", label: "복약정보" },
  { id: "chronic", label: "만성질환" },
  { id: "mobility", label: "거동/인지" },
  { id: "activity", label: "활동조건" },
  { id: "welfare", label: "복지정보" },
  { id: "job", label: "일자리" },
];

const INFO_REQUEST_SECTION_RULES = [
  {
    section: "personal",
    pattern: /인적사항|이름|생년월일|성별|연락처|전화번호|주소/,
  },
  {
    section: "body",
    pattern: /신체정보|키|몸무게|BMI|흡연|음주|알레르기|신체/,
  },
  {
    section: "medication",
    pattern: /복약정보|복약|복용|약|복용 시작일|복용 간격|하루 복용 횟수|medicine/i,
  },
  {
    section: "chronic",
    pattern: /만성질환|만성|질환|당뇨|고혈압|심장질환|관절질환|수술|건강|chronic/i,
  },
  {
    section: "mobility",
    pattern: /거동\/인지\/감각|거동|인지|감각|보행|기억|판단|시력|청력|낙상|mobility/i,
  },
  {
    section: "welfare",
    pattern: /복지정보|복지|소득|가구|혜택|참고사항|welfare/i,
  },
  {
    section: "activity",
    pattern: /활동 조건|활동|이동 가능 거리|이동|쉬는 시간|쉬는|하기 어려운 작업|작업|환경|activity/i,
  },
  {
    section: "job",
    pattern: /일자리 희망조건|일자리|희망 급여|희망 요일|희망 직종|희망 근무|근무 형태|급여|직종|job/i,
  },
];

export const getProfileSectionFromInfoRequest = (message = "") => {
  const text = String(message);
  const matchedRule = INFO_REQUEST_SECTION_RULES.find((rule) => rule.pattern.test(text));
  return matchedRule?.section || "personal";
};

export const createMedicine = () => ({
  name: "",
  startDate: "",
  endDate: "",
  ongoing: false,
  interval: "",
  dailyCount: "",
  alertEnabled: false,
});

export const getMedicineMinimumCount = (medicineCount) => {
  if (medicineCount === "1~2개") return 1;
  if (medicineCount === "3~5개") return 3;
  if (medicineCount === "6개 이상") return 6;
  return 0;
};

export const syncMedicationsWithCount = (medications = [], medicineCount = NONE) => {
  const minimumCount = getMedicineMinimumCount(medicineCount);
  if (minimumCount === 0) return [];

  const next = medications.map((medicine) => ({
    ...createMedicine(),
    ...medicine,
  }));

  while (next.length < minimumCount) {
    next.push(createMedicine());
  }

  return next;
};

export const inferSeniorRelationFromGuardian = (guardianRelation = "", seniorGender = "") => {
  const relation = guardianRelation.trim();

  if (relation.includes("할머니") || relation.includes("할아버지")) {
    return seniorGender === "여성" ? "손녀" : seniorGender === "남성" ? "손자" : "손자/손녀";
  }

  if (relation.includes("어머니") || relation.includes("아버지") || relation.includes("부모")) {
    return "자녀";
  }

  return "";
};

export const buildRegion = ({ city = "", district = "", dong = "", detailAddress = "" }) =>
  [city, district, dong, detailAddress].map((part) => part.trim()).filter(Boolean).join(" ");

export const splitRegion = (region = "") => {
  const parts = String(region)
    .replaceAll(",", " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    city: parts[0] || "",
    district: parts[1] || "",
    dong: parts[2] || "",
    detailAddress: parts.slice(3).join(" "),
  };
};

export const defaultForm = {
  name: "",
  age: "",
  birthDate: "",
  gender: "",
  region: "",
  city: "",
  district: "",
  dong: "",
  detailAddress: "",
  phone: "",
  profileImageUrl: "",
  lastLoginAt: "",
  guardianName: "",
  guardianRelation: "",
  seniorRelationToGuardian: "",
  socialWorkerName: "",
  socialWorkerPhone: "",
  disabilityGrade: "",
  disabilityType: "",
  height: "",
  weight: "",
  smoking: "",
  drinking: "",
  allergies: "",
  livingCostStatus: "",
  householdType: "",
  currentBenefits: [],
  pensionStatus: "",
  housingType: "",
  careNeeds: [],
  welfareMemo: "",
  medicineCount: "",
  medications: [],
  diabetes: "",
  hypertension: "",
  heart: "",
  joint: "",
  stroke: "",
  kidney: "",
  lung: "",
  liver: "",
  cancer: "",
  walkingAid: "",
  dementia: "",
  vision: "",
  hearing: "",
  recentFall: "",
  hasSurgery: "",
  surgeryDetail: "",
  otherDisease: "",
  maxHours: "",
  maxDistance: "",
  disabledWork: [],
  restNeed: "",
  avoidEnvironment: [],
  payType: "무관",
  hopeDays: [],
  hopeJobType: [],
  hopeCondition: [],
  memo: "",
};

export const splitCsv = (value) => {
  if (!value) return [];

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const readMedications = (healthInfo = {}) => {
  const normalize = (medicine) => ({
    ...createMedicine(),
    ...medicine,
    startDate: medicine.startDate ?? "",
    endDate: medicine.endDate ?? "",
    ongoing: Boolean(medicine.ongoing),
    alertEnabled: Boolean(medicine.alertEnabled),
  });

  if (Array.isArray(healthInfo.medications)) {
    return healthInfo.medications.map(normalize);
  }
  if (typeof healthInfo.medicationsJson === "string") {
    try {
      const parsed = JSON.parse(healthInfo.medicationsJson);
      return Array.isArray(parsed) ? parsed.map(normalize) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const profileToForm = (profile = {}) => {
  const senior = profile.senior ?? {};
  const healthInfo = profile.healthInfo ?? {};
  const jobPreference = profile.jobPreference ?? {};
  const flatInfo = { ...profile, ...senior };
  const mergedHealthInfo = { ...flatInfo, ...healthInfo };
  const mergedJobPreference = { ...flatInfo, ...jobPreference };
  const medications = readMedications(mergedHealthInfo);
  const savedRegion = senior.region ?? senior.address ?? "";
  const splitAddress = splitRegion(savedRegion);
  const city = senior.city ?? splitAddress.city;
  const district = senior.district ?? splitAddress.district;
  const dong = senior.dong ?? splitAddress.dong;
  const detailAddress = senior.detailAddress ?? splitAddress.detailAddress;
  const region = savedRegion || buildRegion({ city, district, dong, detailAddress });

  return {
    ...defaultForm,
    name: senior.name ?? "",
    age: senior.age ? String(senior.age) : "",
    birthDate: senior.birthDate ?? "",
    gender: senior.gender ?? "",
    region,
    city,
    district,
    dong,
    detailAddress,
    phone: senior.phone ?? "",
    profileImageUrl: senior.profileImageUrl ?? "",
    lastLoginAt: senior.lastLoginAt ?? profile.lastLoginAt ?? "",
    guardianName: senior.guardianName ?? profile.guardianName ?? "",
    guardianRelation: senior.guardianRelation ?? profile.relation ?? "",
    seniorRelationToGuardian: senior.seniorRelationToGuardian ?? "",
    socialWorkerName: senior.socialWorkerName ?? profile.socialWorkerName ?? "",
    socialWorkerPhone: senior.socialWorkerPhone ?? profile.socialWorkerPhone ?? "",
    disabilityGrade: senior.disabilityGrade ?? NONE,
    disabilityType: senior.disabilityType ?? NONE,
    height: mergedHealthInfo.height ? String(mergedHealthInfo.height) : "",
    weight: mergedHealthInfo.weight ? String(mergedHealthInfo.weight) : "",
    smoking: mergedHealthInfo.smoking ?? NONE,
    drinking: mergedHealthInfo.drinking ?? NONE,
    allergies: mergedHealthInfo.allergies ?? "",
    livingCostStatus: mergedHealthInfo.livingCostStatus ?? "",
    householdType: mergedHealthInfo.householdType ?? "",
    currentBenefits: splitCsv(mergedHealthInfo.currentBenefits),
    pensionStatus: mergedHealthInfo.pensionStatus ?? "",
    housingType: mergedHealthInfo.housingType ?? "",
    careNeeds: splitCsv(mergedHealthInfo.careNeeds),
    welfareMemo: mergedHealthInfo.welfareMemo ?? "",
    medicineCount: mergedHealthInfo.medicineCount ?? (medications.length ? `${medications.length}개` : NONE),
    medications: syncMedicationsWithCount(medications, mergedHealthInfo.medicineCount ?? (medications.length ? `${medications.length}개` : NONE)),
    diabetes: mergedHealthInfo.diabetes ?? NONE,
    hypertension: mergedHealthInfo.hypertension ?? NONE,
    heart: mergedHealthInfo.heartDisease ?? mergedHealthInfo.heart ?? NONE,
    joint: mergedHealthInfo.jointDisease ?? mergedHealthInfo.joint ?? NONE,
    stroke: mergedHealthInfo.stroke ?? NONE,
    kidney: mergedHealthInfo.kidneyDisease ?? mergedHealthInfo.kidney ?? NONE,
    lung: mergedHealthInfo.lungDisease ?? mergedHealthInfo.respiratoryDisease ?? mergedHealthInfo.lung ?? NONE,
    liver: mergedHealthInfo.liverDisease ?? mergedHealthInfo.liver ?? NONE,
    cancer: mergedHealthInfo.cancer ?? NONE,
    walkingAid: mergedHealthInfo.walkingAid ?? NONE,
    dementia: mergedHealthInfo.dementia ?? NONE,
    vision: mergedHealthInfo.vision ?? NONE,
    hearing: mergedHealthInfo.hearing ?? NONE,
    recentFall: mergedHealthInfo.recentFall ?? NONE,
    hasSurgery: mergedHealthInfo.hasSurgery ?? NONE,
    surgeryDetail: mergedHealthInfo.surgeryDetail ?? "",
    otherDisease: mergedHealthInfo.otherDisease ?? "",
    maxHours: mergedHealthInfo.maxHours ?? "",
    maxDistance: mergedHealthInfo.maxDistance ?? "",
    disabledWork: splitCsv(mergedHealthInfo.disabledWork),
    restNeed: mergedHealthInfo.restNeed ?? NONE,
    avoidEnvironment: splitCsv(mergedHealthInfo.avoidEnvironment),
    payType: mergedJobPreference.payType ?? "무관",
    hopeDays: splitCsv(mergedJobPreference.hopeDays),
    hopeJobType: splitCsv(mergedJobPreference.hopeJobType),
    hopeCondition: splitCsv(mergedJobPreference.hopeCondition),
    memo: mergedJobPreference.memo ?? "",
  };
};

export const normalizeForm = (form) => {
  const region = buildRegion(form) || form.region;
  const guardianRelation = form.guardianRelation || "";
  const seniorRelationToGuardian =
    form.seniorRelationToGuardian ||
    inferSeniorRelationFromGuardian(guardianRelation, form.gender);
  const medications = syncMedicationsWithCount(form.medications || [], form.medicineCount).filter((medicine) =>
    Object.entries(medicine).some(([key, value]) => key !== "ongoing" && String(value || "").trim())
  );

  const welfareRag = mapWelfareInfoForRag(form);

  return {
    ...form,
    age: form.birthDate ? String(calculateAge(form.birthDate) || "") : form.age,
    region,
    address: region,
    guardianRelation,
    seniorRelationToGuardian,
    medications,
    medicationsJson: JSON.stringify(medications),
    lastLoginAt: form.lastLoginAt || new Date().toISOString(),
    // UI 선택값 (복원용)
    careNeeds: (form.careNeeds || []).join(","),
    currentBenefits: (form.currentBenefits || []).join(","),
    // RAG 변환 필드
    incomeLevel: welfareRag.incomeLevel ?? "",
    livingAlone: welfareRag.livingAlone ?? "",
    needsGuardianCheck: welfareRag.needsGuardianCheck ?? false,
    guardianCheckFields: (welfareRag.guardianCheckFields || []).join(","),
    heartDisease: form.heart,
    jointDisease: form.joint,
    kidneyDisease: form.kidney,
    lungDisease: form.lung,
    respiratoryDisease: form.lung,
    liverDisease: form.liver,
  };
};

export const formToProfile = (profile, form) => {
  const normalized = normalizeForm(form);

  return {
    ...profile,
    senior: {
      ...profile.senior,
      name: normalized.name,
      age: normalized.age ? Number(normalized.age) : null,
      birthDate: normalized.birthDate,
      gender: normalized.gender,
      region: normalized.region,
      address: normalized.region,
      city: normalized.city,
      district: normalized.district,
      dong: normalized.dong,
      detailAddress: normalized.detailAddress,
      phone: normalized.phone,
      profileImageUrl: normalized.profileImageUrl,
      lastLoginAt: normalized.lastLoginAt,
      guardianName: normalized.guardianName,
      guardianRelation: normalized.guardianRelation,
      seniorRelationToGuardian: normalized.seniorRelationToGuardian,
      socialWorkerName: normalized.socialWorkerName,
      socialWorkerPhone: normalized.socialWorkerPhone,
      disabilityGrade: normalized.disabilityGrade,
      disabilityType: normalized.disabilityType,
    },
    healthInfo: {
      ...profile.healthInfo,
      height: normalized.height,
      weight: normalized.weight,
      smoking: normalized.smoking,
      drinking: normalized.drinking,
      allergies: normalized.allergies,
      livingCostStatus: normalized.livingCostStatus,
      householdType: normalized.householdType,
      currentBenefits: Array.isArray(normalized.currentBenefits) ? normalized.currentBenefits.join(",") : normalized.currentBenefits,
      pensionStatus: normalized.pensionStatus,
      housingType: normalized.housingType,
      careNeeds: normalized.careNeeds,
      welfareMemo: normalized.welfareMemo,
      incomeLevel: normalized.incomeLevel,
      livingAlone: normalized.livingAlone,
      needsGuardianCheck: normalized.needsGuardianCheck,
      guardianCheckFields: normalized.guardianCheckFields,
      medicineCount: normalized.medicineCount,
      medications: normalized.medications,
      medicationsJson: JSON.stringify(normalized.medications),
      diabetes: normalized.diabetes,
      hypertension: normalized.hypertension,
      heartDisease: normalized.heart,
      jointDisease: normalized.joint,
      stroke: normalized.stroke,
      kidneyDisease: normalized.kidney,
      lungDisease: normalized.lung,
      liverDisease: normalized.liver,
      cancer: normalized.cancer,
      walkingAid: normalized.walkingAid,
      dementia: normalized.dementia,
      vision: normalized.vision,
      hearing: normalized.hearing,
      recentFall: normalized.recentFall,
      hasSurgery: normalized.hasSurgery,
      surgeryDetail: normalized.surgeryDetail,
      otherDisease: normalized.otherDisease,
      maxHours: normalized.maxHours,
      maxDistance: normalized.maxDistance,
      disabledWork: normalized.disabledWork.join(","),
      restNeed: normalized.restNeed,
      avoidEnvironment: normalized.avoidEnvironment.join(","),
    },
    jobPreference: {
      ...profile.jobPreference,
      payType: normalized.payType,
      hopeDays: normalized.hopeDays.join(","),
      hopeJobType: normalized.hopeJobType.join(","),
      hopeCondition: normalized.hopeCondition.join(","),
      memo: normalized.memo,
    },
  };
};

export const calculateAge = (birthDate) => {
  if (!birthDate) return null;

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age;
};

export const calcBMI = (height, weight, gender = "") => {
  const hm = parseFloat(height) / 100;
  const kg = parseFloat(weight);

  if (!hm || !kg || Number.isNaN(hm) || Number.isNaN(kg)) {
    return null;
  }

  const bmi = Number((kg / (hm * hm)).toFixed(1));
  const genderGuide = String(gender).includes("여")
    ? "여성은 같은 BMI라도 체지방률이 높게 나올 수 있어 허리둘레와 함께 확인하면 좋아요."
    : String(gender).includes("남")
      ? "남성은 근육량이 많으면 BMI가 높게 나올 수 있어 허리둘레와 함께 확인하면 좋아요."
      : "BMI는 참고 지표라 성별, 근육량, 허리둘레를 함께 보는 게 좋아요.";

  if (bmi < 18.5) return { bmi, status: "저체중", color: "#4f8fb8", guide: genderGuide };
  if (bmi < 23) return { bmi, status: "정상", color: "#5f9f72", guide: genderGuide };
  if (bmi < 25) return { bmi, status: "과체중", color: "#d89b2b", guide: genderGuide };
  return { bmi, status: "비만", color: "#d95757", guide: genderGuide };
};
