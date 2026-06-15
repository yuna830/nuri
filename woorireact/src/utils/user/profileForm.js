import { mapWelfareInfoForRag } from "./welfareInfoMap.js";
import { FIELD_CATEGORY_MAP } from "../welfare/welfareSummaryStats.js";

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
  "상관없음",
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
  "상관없음",
  "경비/청소",
  "급식/조리 보조",
  "사무 보조",
  "돌봄 보조",
  "작업/수공예",
  "판매/안내",
  "환경 정비",
];

export const JOB_CONDITIONS = [
  "상관없음",
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
export const AVOID_ENVIRONMENTS = ["상관없음", "소음 많은 곳", "먼지 많은 곳", "덥거나 추운 곳", "미끄러운 바닥", "사람 많은 곳", "혼자 하는 작업"];
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
  { id: "welfare", label: "복지정보" },
  { id: "job", label: "활동 및 일자리" },
];

const CATEGORY_TO_SECTION = {
  "인적사항": "personal",
  "신체정보": "body",
  "복약정보": "medication",
  "만성질환": "chronic",
  "거동/인지": "mobility",
  "복지정보": "welfare",
  "활동/일자리": "job",
};

export const getProfileSectionFromInfoRequest = (message = "") => {
  const text = String(message);
  // FIELD_CATEGORY_MAP의 필드명으로 먼저 정확히 매칭 (수술 이력 → 거동/인지 등 올바르게 처리)
  for (const [field, cat] of Object.entries(FIELD_CATEGORY_MAP)) {
    if (text.includes(field)) {
      const section = CATEGORY_TO_SECTION[cat];
      if (section) return section;
    }
  }
  return "personal";
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

export const inferGuardianRelationToSenior = (seniorRelationToGuardian = "", guardianGender = "") => {
  const relation = seniorRelationToGuardian.trim();

  const isFemale = ["여성", "여자", "F", "female"].includes(guardianGender);
  const isMale = ["남성", "남자", "M", "male"].includes(guardianGender);

  const byGender = (femaleLabel, maleLabel, fallbackLabel) => {
    if (isFemale) return femaleLabel;
    if (isMale) return maleLabel;
    return fallbackLabel;
  };

  if (/(엄마|어머니|아빠|아버지|부모)/.test(relation)) {
    return byGender("딸", "아들", "자녀");
  }

  if (/(할머니|할아버지|조모|조부|외할머니|외할아버지)/.test(relation)) {
    return byGender("손녀", "손자", "손주");
  }

  if (/(고모|이모|삼촌|외삼촌|숙모|외숙모|고모부|이모부|큰엄마|작은엄마|큰아빠|작은아빠)/.test(relation)) {
    return "조카";
  }

  return "";
};

// inferGuardianRelationToSenior의 역방향: 보호자 관계 → 어르신 관계
export const inferSeniorRelationFromGuardian = (guardianRelation = "", seniorGender = "") => {
  const relation = guardianRelation.trim();

  const isFemale = ["여성", "여자", "F", "female"].includes(seniorGender);
  const isMale = ["남성", "남자", "M", "male"].includes(seniorGender);

  const byGender = (femaleLabel, maleLabel, fallbackLabel) => {
    if (isFemale) return femaleLabel;
    if (isMale) return maleLabel;
    return fallbackLabel;
  };

  if (/(아들|딸|자녀)/.test(relation)) return byGender("어머니", "아버지", "부모");
  if (/(손자|손녀|손주)/.test(relation)) return byGender("할머니", "할아버지", "조부모");
  if (/조카/.test(relation)) return byGender("고모", "삼촌", "친척");
  if (/(배우자|남편|아내)/.test(relation)) return "배우자";
  if (/(형|오빠|남동생|언니|누나|여동생|형제|자매)/.test(relation)) return byGender("자매", "형제", "형제자매");

  return "";
};

export const buildRegion = ({ city = "", district = "", dong = "", detailAddress = "" }) =>
  [city, district, dong, detailAddress].map((part) => part.trim()).filter(Boolean).join(" ");

export const inferGuardianRelationToSeniorLabel = (seniorRelationToGuardian = "", guardianGender = "") => {
  const relation = seniorRelationToGuardian.trim();
  const gender = String(guardianGender || "").trim().toLowerCase();

  const isFemale = ["여성", "여자", "f", "female"].includes(gender);
  const isMale = ["남성", "남자", "m", "male"].includes(gender);

  const byGender = (femaleLabel, maleLabel, fallbackLabel) => {
    if (isFemale) return femaleLabel;
    if (isMale) return maleLabel;
    return fallbackLabel;
  };

  if (/(엄마|어머니|아빠|아버지|부모)/.test(relation)) {
    return byGender("딸", "아들", "자녀");
  }

  if (/(할머니|할아버지|조모|조부|외할머니|외할아버지)/.test(relation)) {
    return byGender("손녀", "손자", "손주");
  }

  if (/(고모|이모|삼촌|외삼촌|숙모|외숙모|고모부|이모부|큰엄마|작은엄마|큰아빠|작은아빠)/.test(relation)) {
    return "조카";
  }

  return "";
};

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
  hasGuardian: true,
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
  surgeries: [],
  otherDisease: "",
  maxHours: "",
  maxDistance: "",
  disabledWork: [],
  restNeed: "",
  avoidEnvironment: [],
  payType: "",
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

export const createSurgery = () => ({ name: "", date: "", recovery: "" });

const readSurgeries = (healthInfo = {}) => {
  const normalize = (s) => ({ ...createSurgery(), ...s, name: s.name ?? "", date: s.date ?? s.year ?? "", recovery: s.recovery ?? "" });
  if (Array.isArray(healthInfo.surgeries)) return healthInfo.surgeries.map(normalize);
  if (typeof healthInfo.surgeriesJson === "string") {
    try {
      const parsed = JSON.parse(healthInfo.surgeriesJson);
      return Array.isArray(parsed) ? parsed.map(normalize) : [];
    } catch { return []; }
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
  const surgeries = readSurgeries(mergedHealthInfo);
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
    guardianRelation: profile.guardianRelationToSenior ?? senior.guardianRelation ?? profile.relation ?? "",
    seniorRelationToGuardian: senior.seniorRelationToGuardian ?? "",
    socialWorkerName: senior.socialWorkerName ?? profile.socialWorkerName ?? "",
    socialWorkerPhone: senior.socialWorkerPhone ?? profile.socialWorkerPhone ?? "",
    disabilityGrade: senior.disabilityGrade || NONE,
    disabilityType: senior.disabilityType || NONE,
    hasGuardian: senior.hasGuardian !== false, // null/true → true(있음)
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
    medicineCount: mergedHealthInfo.medicineCount || (medications.length ? `${medications.length}개` : NONE),
    medications,
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
    surgeries,
    otherDisease: mergedHealthInfo.otherDisease ?? "",
    maxHours: mergedHealthInfo.maxHours ?? "",
    maxDistance: mergedHealthInfo.maxDistance ?? "",
    disabledWork: splitCsv(mergedHealthInfo.disabledWork),
    restNeed: mergedHealthInfo.restNeed ?? NONE,
    avoidEnvironment: splitCsv(mergedHealthInfo.avoidEnvironment),
    payType: mergedJobPreference.payType ?? "",
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
  const medications = (form.medications || []).filter((medicine) =>
    Object.entries(medicine).some(([key, value]) => key !== "ongoing" && String(value || "").trim())
  );

  const welfareRag = mapWelfareInfoForRag(form);

  const surgeries = (form.surgeries || []).filter((s) =>
    s.name && String(s.name).trim()
  );

  return {
    ...form,
    age: form.birthDate ? String(calculateAge(form.birthDate) || "") : form.age,
    region,
    address: region,
    guardianRelation,
    seniorRelationToGuardian,
    medications,
    medicationsJson: JSON.stringify(medications),
    surgeries,
    surgeriesJson: JSON.stringify(surgeries),
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
      hasGuardian: normalized.hasGuardian,
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
      surgeries: normalized.surgeries,
      surgeriesJson: JSON.stringify(normalized.surgeries),
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
