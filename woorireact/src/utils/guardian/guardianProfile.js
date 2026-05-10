export const DEFAULT_CENTER = {
  lat: 37.4979,
  lng: 127.0276,
  address: "서울시 강남구 역삼동",
};

export const isMeaningfulValue = (value) => {
  return value && value !== "없음" && !String(value).startsWith("없음");
};

export const makeConditionText = (healthInfo) => {
  if (!healthInfo) {
    return "등록된 건강정보 없음";
  }

  const conditions = [
    isMeaningfulValue(healthInfo.dementia) && `치매: ${healthInfo.dementia}`,
    isMeaningfulValue(healthInfo.hypertension) && `고혈압: ${healthInfo.hypertension}`,
    isMeaningfulValue(healthInfo.diabetes) && `당뇨: ${healthInfo.diabetes}`,
    isMeaningfulValue(healthInfo.heartDisease) && `심장질환: ${healthInfo.heartDisease}`,
    isMeaningfulValue(healthInfo.jointDisease) && `관절질환: ${healthInfo.jointDisease}`,
    isMeaningfulValue(healthInfo.stroke) && `뇌졸중: ${healthInfo.stroke}`,
    isMeaningfulValue(healthInfo.kidneyDisease) && `신장질환: ${healthInfo.kidneyDisease}`,
    isMeaningfulValue(healthInfo.lungDisease) && `호흡기질환: ${healthInfo.lungDisease}`,
  ].filter(Boolean);

  return conditions.length > 0 ? conditions.join(", ") : "특이 질환 없음";
};

export const mapSeniorProfileToElder = (profile) => {
  const senior = profile.senior ?? {};
  const healthInfo = profile.healthInfo ?? null;
  const address = senior.address || senior.region || DEFAULT_CENTER.address;

  return {
    id: senior.id,
    name: senior.name || "이름 없음",
    relation: profile.relation || "보호 대상자",
    status: "unknown",
    age: senior.age ? `${senior.age}세` : "-",
    gender: senior.gender || "-",
    address,
    profileImageUrl: senior.profileImageUrl || "",
    condition: makeConditionText(healthInfo),
    battery: 75,
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