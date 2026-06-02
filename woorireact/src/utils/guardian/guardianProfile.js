export const DEFAULT_CENTER = {
  lat: 37.4979,
  lng: 127.0276,
  address: "서울특별시 강남구 역삼동",
};

export const isMeaningfulValue = (value) => {
  return value && value !== "없음" && !String(value).startsWith("없음");
};

export const readMedications = (healthInfo = {}) => {
  if (Array.isArray(healthInfo.medications)) return healthInfo.medications;
  if (typeof healthInfo.medicationsJson === "string") {
    try {
      const parsed = JSON.parse(healthInfo.medicationsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const makeConditionText = (healthInfo) => {
  if (!healthInfo) {
    return "등록된 건강정보 없음";
  }

  const conditions = [
    isMeaningfulValue(healthInfo.dementia) && `치매/인지: ${healthInfo.dementia}`,
    isMeaningfulValue(healthInfo.hypertension) && `고혈압: ${healthInfo.hypertension}`,
    isMeaningfulValue(healthInfo.diabetes) && `당뇨: ${healthInfo.diabetes}`,
    isMeaningfulValue(healthInfo.heartDisease) && `심장질환: ${healthInfo.heartDisease}`,
    isMeaningfulValue(healthInfo.jointDisease) && `관절질환: ${healthInfo.jointDisease}`,
    isMeaningfulValue(healthInfo.stroke) && `뇌졸중: ${healthInfo.stroke}`,
    isMeaningfulValue(healthInfo.kidneyDisease) && `신장질환: ${healthInfo.kidneyDisease}`,
    isMeaningfulValue(healthInfo.lungDisease) && `호흡기질환: ${healthInfo.lungDisease}`,
    isMeaningfulValue(healthInfo.otherDisease) && healthInfo.otherDisease,
  ].filter(Boolean);

  return conditions.length > 0 ? conditions.join(", ") : "특이 질환 없음";
};

export const formatLastLogin = (value) => {
  if (!value) return "기록 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const mapSeniorProfileToElder = (profile) => {
  const senior = profile.senior ?? {};
  const healthInfo = profile.healthInfo ?? null;
  const jobPreference = profile.jobPreference ?? {};
  const address = senior.address || senior.region || DEFAULT_CENTER.address;
  const medications = readMedications(healthInfo ?? {});

  return {
    id: senior.id,
    name: senior.name || "이름 없음",
    relation: profile.relation || senior.guardianRelation || "보호 대상자",
    seniorRelationToGuardian: senior.seniorRelationToGuardian || "",
    guardianName: senior.guardianName || profile.guardianName || "",
    socialWorkerName: senior.socialWorkerName || profile.socialWorkerName || "",
    socialWorkerPhone: senior.socialWorkerPhone || profile.socialWorkerPhone || "",
    status: "unknown",
    age: senior.age ? `${senior.age}세` : "-",
    birthDate: senior.birthDate || "",
    gender: senior.gender || "-",
    phone: senior.phone || "",
    address,
    city: senior.city || "",
    district: senior.district || "",
    dong: senior.dong || "",
    detailAddress: senior.detailAddress || "",
    profileImageUrl: senior.profileImageUrl || "",
    lastLoginAt: senior.lastLoginAt || profile.lastLoginAt || "",
    lastLoginText: formatLastLogin(senior.lastLoginAt || profile.lastLoginAt),
    condition: makeConditionText(healthInfo),
    medications,
    medicineCount: healthInfo?.medicineCount || (medications.length ? `${medications.length}개` : "없음"),
    incomeLevel: healthInfo?.incomeLevel || senior.incomeLevel || "",
    householdType: healthInfo?.householdType || senior.householdType || "",
    healthInfo,
    jobPreference,
    center: {
      lat: DEFAULT_CENTER.lat,
      lng: DEFAULT_CENTER.lng,
    },
    radius: 500,
    currentLocation: null,
    lastNormalLocation: null,
    alerts: [],
    routeHistory: [],
  };
};
