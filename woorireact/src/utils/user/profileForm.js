export const CHRONIC = [
  { key: "diabetes", label: "당뇨", levels: ["없음", "경증 (식이요법·경구약)", "중증 (인슐린 투여)"] },
  { key: "hypertension", label: "고혈압", levels: ["없음", "경증 (약 복용·조절 중)", "중증 (합병증 있음)"] },
  { key: "heart", label: "심장질환", levels: ["없음", "경증 (부정맥·협심증 등)", "중증 (심부전·수술 이력)"] },
  { key: "joint", label: "관절질환 (무릎·허리)", levels: ["없음", "경증 (가끔 통증·약 복용)", "중증 (보조기구·수술 이력)"] },
  { key: "stroke", label: "뇌졸중·중풍", levels: ["없음", "경증 (후유증 경미)", "중증 (마비·언어장애 등)"] },
  { key: "kidney", label: "신장질환", levels: ["없음", "경증 (신기능 저하)", "중증 (투석 중)"] },
  { key: "lung", label: "폐·호흡기 질환", levels: ["없음", "경증 (천식·만성기관지염)", "중증 (COPD·산소호흡기)"] },
  { key: "liver", label: "간질환", levels: ["없음", "경증 (지방간·간염 보균)", "중증 (간경화·간암)"] },
  { key: "cancer", label: "암 (과거·현재)", levels: ["없음", "완치·관리 중", "치료 중 (항암·방사선 등)"] },
];

export const WORK_TYPES = [
  "장시간 서기",
  "야외 작업",
  "야간 근무",
  "중량물 운반",
  "컴퓨터 작업",
  "계단 이동",
  "반복 작업",
  "고객 응대",
];

export const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export const JOB_TYPES = [
  "경비·청소",
  "급식·조리 보조",
  "사무 보조",
  "육아 보조",
  "농업·원예",
  "판매·안내",
  "환경 정비",
  "상관없음",
];

export const JOB_CONDITIONS = [
  "실내 근무 선호",
  "오전 근무",
  "오후 근무",
  "주 3일 이하",
  "단기 가능",
  "장기 희망",
];

export const SECTIONS = [
  { id: "personal", label: "인적사항" },
  { id: "body", label: "신체정보" },
  { id: "chronic", label: "만성질환" },
  { id: "mobility", label: "거동·인지·감각" },
  { id: "surgery", label: "낙상·수술" },
  { id: "activity", label: "활동 조건" },
  { id: "job", label: "일자리 희망" },
];

export const defaultForm = {
  name: "",
  age: "",
  gender: "",
  region: "",
  phone: "",
  profileImageUrl: "",
  disabilityGrade: "없음",
  disabilityType: "해당 없음",
  height: "",
  weight: "",
  smoking: "없음 (비흡연)",
  drinking: "없음 (금주)",
  medicineCount: "없음",
  diabetes: "없음",
  hypertension: "없음",
  heart: "없음",
  joint: "없음",
  stroke: "없음",
  kidney: "없음",
  lung: "없음",
  liver: "없음",
  cancer: "없음",
  walkingAid: "없음 (스스로 보행 가능)",
  dementia: "없음",
  vision: "없음",
  hearing: "없음",
  recentFall: "없음",
  hasSurgery: "없음",
  surgeryDetail: "",
  otherDisease: "",
  maxHours: "",
  maxDistance: "",
  disabledWork: [],
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

export const profileToForm = (profile) => {
  const senior = profile.senior ?? {};
  const healthInfo = profile.healthInfo ?? {};
  const jobPreference = profile.jobPreference ?? {};

  return {
    ...defaultForm,
    name: senior.name ?? "",
    age: senior.age ? String(senior.age) : "",
    gender: senior.gender ?? "",
    region: senior.region ?? senior.address ?? "",
    phone: senior.phone ?? "",
    profileImageUrl: senior.profileImageUrl ?? "",
    disabilityGrade: senior.disabilityGrade ?? "없음",
    disabilityType: senior.disabilityType ?? "해당 없음",

    height: healthInfo.height ? String(healthInfo.height) : "",
    weight: healthInfo.weight ? String(healthInfo.weight) : "",
    smoking: healthInfo.smoking ?? "없음 (비흡연)",
    drinking: healthInfo.drinking ?? "없음 (금주)",
    medicineCount: healthInfo.medicineCount ?? "없음",

    diabetes: healthInfo.diabetes ?? "없음",
    hypertension: healthInfo.hypertension ?? "없음",
    heart: healthInfo.heartDisease ?? "없음",
    joint: healthInfo.jointDisease ?? "없음",
    stroke: healthInfo.stroke ?? "없음",
    kidney: healthInfo.kidneyDisease ?? "없음",
    lung: healthInfo.lungDisease ?? "없음",
    liver: healthInfo.liverDisease ?? "없음",
    cancer: healthInfo.cancer ?? "없음",

    walkingAid: healthInfo.walkingAid ?? "없음 (스스로 보행 가능)",
    dementia: healthInfo.dementia ?? "없음",
    vision: healthInfo.vision ?? "없음",
    hearing: healthInfo.hearing ?? "없음",

    recentFall: healthInfo.recentFall ?? "없음",
    hasSurgery: healthInfo.hasSurgery ?? "없음",
    surgeryDetail: healthInfo.surgeryDetail ?? "",
    otherDisease: healthInfo.otherDisease ?? "",

    maxHours: healthInfo.maxHours ?? "",
    maxDistance: healthInfo.maxDistance ?? "",
    disabledWork: splitCsv(healthInfo.disabledWork),

    payType: jobPreference.payType ?? "무관",
    hopeDays: splitCsv(jobPreference.hopeDays),
    hopeJobType: splitCsv(jobPreference.hopeJobType),
    hopeCondition: splitCsv(jobPreference.hopeCondition),
    memo: jobPreference.memo ?? "",
  };
};

export const formToProfile = (profile, form) => ({
  ...profile,
  senior: {
    ...profile.senior,
    name: form.name,
    age: form.age ? Number(form.age) : null,
    gender: form.gender,
    region: form.region,
    address: form.region,
    phone: form.phone,
    profileImageUrl: form.profileImageUrl,
    disabilityGrade: form.disabilityGrade,
    disabilityType: form.disabilityType,
  },
  healthInfo: {
    ...profile.healthInfo,
    height: form.height,
    weight: form.weight,
    smoking: form.smoking,
    drinking: form.drinking,
    medicineCount: form.medicineCount,
    diabetes: form.diabetes,
    hypertension: form.hypertension,
    heartDisease: form.heart,
    jointDisease: form.joint,
    stroke: form.stroke,
    kidneyDisease: form.kidney,
    lungDisease: form.lung,
    liverDisease: form.liver,
    cancer: form.cancer,
    walkingAid: form.walkingAid,
    dementia: form.dementia,
    vision: form.vision,
    hearing: form.hearing,
    recentFall: form.recentFall,
    hasSurgery: form.hasSurgery,
    surgeryDetail: form.surgeryDetail,
    otherDisease: form.otherDisease,
    maxHours: form.maxHours,
    maxDistance: form.maxDistance,
    disabledWork: form.disabledWork.join(","),
  },
  jobPreference: {
    ...profile.jobPreference,
    payType: form.payType,
    hopeDays: form.hopeDays.join(","),
    hopeJobType: form.hopeJobType.join(","),
    hopeCondition: form.hopeCondition.join(","),
    memo: form.memo,
  },
});

export const calcBMI = (height, weight) => {
  const hm = parseFloat(height) / 100;
  const kg = parseFloat(weight);

  if (!hm || !kg || Number.isNaN(hm) || Number.isNaN(kg)) {
    return null;
  }

  const bmi = (kg / (hm * hm)).toFixed(1);
  let status = "정상";
  let color = "#86A788";

  if (bmi < 18.5) {
    status = "저체중";
    color = "#f0a500";
  } else if (bmi < 23) {
    status = "정상";
  } else if (bmi < 25) {
    status = "과체중";
    color = "#f0a500";
  } else {
    status = "비만";
    color = "#e05252";
  }

  return { bmi, status, color };
};
