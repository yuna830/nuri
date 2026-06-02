export const WELFARE_INFO_MAP = {
  livingCostStatus: {
    "잘 모르겠어요": {
      incomeLevel: "확인 필요",
      basicLivelihoodStatus: "확인 필요",
      nearPovertyStatus: "확인 필요",
    },
    "수입이 거의 없어요": {
      incomeLevel: "저소득 가능성",
      basicLivelihoodStatus: "확인 필요",
      nearPovertyStatus: "확인 필요",
    },
    "기초연금 정도만 받아요": {
      incomeLevel: "기초연금 중심",
      basicPensionStatus: "수급 가능성 높음",
    },
    "가족에게 일부 도움을 받아요": {
      incomeLevel: "가족 지원 있음",
    },
    "연금이나 월급 수입이 있어요": {
      incomeLevel: "일반 소득 있음",
    },
    "생계비/의료비/주거비 지원을 받고 있어요": {
      incomeLevel: "공적 지원 수급 가능성",
      basicLivelihoodStatus: "수급 가능성 있음",
      medicalCoverageType: "의료급여 가능성 있음",
    },
  },

  householdType: {
    "잘 모르겠어요": {
      householdType: "확인 필요",
      livingAlone: "확인 필요",
    },
    "혼자 살아요": {
      householdType: "독거 가구",
      livingAlone: "예",
    },
    "배우자와 살아요": {
      householdType: "부부 가구",
      livingAlone: "아니오",
    },
    "자녀/가족과 살아요": {
      householdType: "가족 동거",
      livingAlone: "아니오",
    },
    "시설이나 요양원에 있어요": {
      householdType: "시설 거주",
      livingAlone: "아니오",
    },
    "기타": {
      householdType: "기타",
      livingAlone: "확인 필요",
    },
  },

  pensionStatus: {
    "잘 모르겠어요": {
      pensionStatus: "확인 필요",
      basicPensionStatus: "확인 필요",
      nationalPensionStatus: "확인 필요",
    },
    "기초연금을 받고 있어요": {
      pensionStatus: "기초연금 수급",
      basicPensionStatus: "수급 중",
      nationalPensionStatus: "확인 필요",
    },
    "국민연금을 받고 있어요": {
      pensionStatus: "국민연금 수급",
      basicPensionStatus: "확인 필요",
      nationalPensionStatus: "수급 중",
    },
    "기초연금과 국민연금을 모두 받고 있어요": {
      pensionStatus: "기초연금 및 국민연금 수급",
      basicPensionStatus: "수급 중",
      nationalPensionStatus: "수급 중",
    },
    "신청했지만 기다리는 중이에요": {
      pensionStatus: "연금 신청 대기",
      basicPensionStatus: "신청 대기",
      nationalPensionStatus: "신청 대기",
    },
    "신청한 적 없어요": {
      pensionStatus: "연금 미신청",
      basicPensionStatus: "미신청",
      nationalPensionStatus: "미신청 또는 해당 없음",
    },
  },

  housingType: {
    "잘 모르겠어요": { housingType: "확인 필요" },
    "자가": { housingType: "자가" },
    "전세": { housingType: "전세" },
    "월세": { housingType: "월세" },
    "공공임대": { housingType: "공공임대" },
    "시설이나 요양원": { housingType: "시설 거주" },
    "기타": { housingType: "기타" },
  },

  currentBenefits: {
    "잘 모르겠어요": { currentBenefits: ["확인 필요"] },
    "받고 있는 지원이 없어요": { currentBenefits: [] },
    "기초연금": {
      currentBenefits: ["기초연금"],
      basicPensionStatus: "수급 중",
    },
    "생계비/의료비/주거비 지원": {
      currentBenefits: ["생계비/의료비/주거비 지원"],
      basicLivelihoodStatus: "수급 가능성 있음",
      medicalCoverageType: "의료급여 또는 공적 지원 가능성 있음",
    },
    "장기요양 서비스": {
      currentBenefits: ["장기요양 서비스"],
      longTermCareStatus: "이용 중",
    },
    "장애 관련 지원": {
      currentBenefits: ["장애 관련 지원"],
      disabilityStatus: "장애 관련 지원 이용 중",
    },
    "노인 일자리": {
      currentBenefits: ["노인 일자리"],
      seniorJobProgramStatus: "참여 중 또는 참여 경험 있음",
    },
    "노인맞춤돌봄서비스": {
      currentBenefits: ["노인맞춤돌봄서비스"],
      careServiceStatus: "이용 중",
    },
    "응급안전안심서비스": {
      currentBenefits: ["응급안전안심서비스"],
      emergencySafetyServiceStatus: "이용 중",
    },
  },

  careNeeds: {
    "잘 모르겠어요": { careNeeds: ["확인 필요"] },
    "특별히 없어요": { careNeeds: [] },
    "식사 준비": { careNeeds: ["식사 준비 도움"] },
    "청소/빨래": { careNeeds: ["청소/빨래 도움"] },
    "목욕/위생": { careNeeds: ["목욕/위생 도움"] },
    "병원 동행": { careNeeds: ["병원 동행 필요"] },
    "외출/장보기": { careNeeds: ["외출/장보기 도움"] },
    "약 챙기기": { careNeeds: ["복약 관리 도움"] },
    "안부 확인": { careNeeds: ["안부 확인 필요"] },
  },
};

export function mapWelfareInfoForRag(form) {
  const result = {};

  const merge = (mapped) => {
    if (!mapped) return;
    Object.entries(mapped).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        result[key] = [...new Set([...(result[key] || []), ...value])];
        return;
      }
      if (value !== undefined && value !== null && value !== "") {
        result[key] = value;
      }
    });
  };

  merge(WELFARE_INFO_MAP.livingCostStatus[form.livingCostStatus]);
  merge(WELFARE_INFO_MAP.householdType[form.householdType]);
  merge(WELFARE_INFO_MAP.pensionStatus[form.pensionStatus]);
  merge(WELFARE_INFO_MAP.housingType[form.housingType]);

  (form.currentBenefits || []).forEach((item) => {
    merge(WELFARE_INFO_MAP.currentBenefits[item]);
  });

  (form.careNeeds || []).forEach((item) => {
    merge(WELFARE_INFO_MAP.careNeeds[item]);
  });

  if (form.welfareMemo?.trim()) {
    result.welfareMemo = form.welfareMemo.trim();
  }

  result.needsGuardianCheck = [
    form.livingCostStatus,
    form.householdType,
    form.pensionStatus,
    form.housingType,
    ...(form.currentBenefits || []),
    ...(form.careNeeds || []),
  ].includes("잘 모르겠어요");

  result.guardianCheckFields = [
    form.livingCostStatus === "잘 모르겠어요" && "생활비 상황",
    form.householdType === "잘 모르겠어요" && "가구 형태",
    form.pensionStatus === "잘 모르겠어요" && "연금 수급 상태",
    form.housingType === "잘 모르겠어요" && "주거 형태",
    (form.currentBenefits || []).includes("잘 모르겠어요") && "현재 받고 있는 복지 혜택",
    (form.careNeeds || []).includes("잘 모르겠어요") && "도움이 필요한 일",
  ].filter(Boolean);

  return result;
}
