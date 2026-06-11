export const FILTER_GROUPS = [
    { key: "healthStatus", label: "건강 상태", options: ["양호", "주의", "위험"] },
    { key: "alertStatus", label: "알림 상태", options: ["없음", "미응답 SOS", "일자리 신청"] },
    { key: "regionDistrict", label: "거주 지역", options: [] },
    { key: "workRequestStatus", label: "확인여부", options: ["검토", "미검토"] },
];

export const SEOUL_DISTRICTS = [
    "강남구", "강동구", "강북구", "강서구", "관악구",
    "광진구", "구로구", "금천구", "노원구", "도봉구",
    "동대문구", "동작구", "마포구", "서대문구", "서초구",
    "성동구", "성북구", "송파구", "양천구", "영등포구",
    "용산구", "은평구", "종로구", "중구", "중랑구",
];

export const createEmptyFilters = () =>
    FILTER_GROUPS.reduce((filters, group) => ({
        ...filters,
        [group.key]: [],
    }), {});

export const getRegionDistrict = (region) => {
    const match = String(region || "").match(/[가-힣]+구/);
    return match ? match[0] : "기타";
};

export const formatLastAccessText = (value) => {
    if (!value) {
        return "기록 없음";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (diffMs < 0) {
        return "방금 전";
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
        return "방금 전";
    }

    if (diffMinutes < 60) {
        return `${diffMinutes}분 전`;
    }

    if (diffHours < 24) {
        return `${diffHours}시간 전`;
    }

    return `${diffDays}일 전`;
};

export const getSeniorReviewStatus = (senior) =>
    senior.workRequestStatus || "미검토";

export const formatSeniorNameInfo = (senior) => {
    const gender = senior.gender ? senior.gender.slice(0, 1) : "";
    const age = senior.age ? senior.age : "";

    if (!gender && !age) {
        return `${senior.name}(정보 미입력)`;
    }

    if (!gender) {
        return `${senior.name}(${age})`;
    }

    if (!age) {
        return `${senior.name}(${gender})`;
    }

    return `${senior.name}(${gender}, ${age})`;
};

export const mapWelfareSenior = (item) => ({
    id: item.id,
    name: item.name,
    age: item.age,
    birthDate: item.birthDate,
    gender: item.gender,
    phone: item.phone,

    address: item.address,
    region: item.region || "주소 미등록",

    guardianName: item.guardianName,
    guardianPhone: item.guardianPhone,
    guardianId: item.guardianId,
    hasGuardian: item.hasGuardian === true || item.hasGuardian === "true",
    hasDisabilityInfo: item.hasDisabilityInfo === true,
    hasBodyInfo: item.hasBodyInfo === true,
    hasHealthInfo: item.hasHealthInfo === true,
    hasMedicationInfo: item.hasMedicationInfo === true,
    hasWelfareInfo: item.hasWelfareInfo === true,

    healthInfo: item.healthInfo,
    healthStatus: item.healthStatus || "양호",

    // 개별 프로필 필드 (API가 내려주는 경우 활용, 없으면 has...Info 플래그로 폴백)
    // item.healthInfo 중첩 객체도 폴백으로 확인 (상세 API 응답 형식 대응)
    disabilityGrade: item.disabilityGrade,
    disabilityType: item.disabilityType,
    smoking: item.smoking ?? item.healthInfo?.smoking,
    drinking: item.drinking ?? item.healthInfo?.drinking,
    height: item.height ?? item.healthInfo?.height,
    weight: item.weight ?? item.healthInfo?.weight,
    medicineCount: item.medicineCount,
    diabetes: item.diabetes ?? item.healthInfo?.diabetes,
    hypertension: item.hypertension ?? item.healthInfo?.hypertension,
    heart: item.heartDisease ?? item.heart ?? item.healthInfo?.heartDisease,
    joint: item.jointDisease ?? item.joint ?? item.healthInfo?.jointDisease,
    stroke: item.stroke ?? item.healthInfo?.stroke,
    kidney: item.kidneyDisease ?? item.kidney ?? item.healthInfo?.kidneyDisease,
    lung: item.lungDisease ?? item.respiratoryDisease ?? item.lung ?? item.healthInfo?.lungDisease,
    liver: item.liverDisease ?? item.liver ?? item.healthInfo?.liverDisease,
    cancer: item.cancer ?? item.healthInfo?.cancer,
    walkingAid: item.walkingAid ?? item.healthInfo?.walkingAid,
    dementia: item.dementia ?? item.healthInfo?.dementia,
    vision: item.vision ?? item.healthInfo?.vision,
    hearing: item.hearing ?? item.healthInfo?.hearing,
    recentFall: item.recentFall ?? item.healthInfo?.recentFall,
    hasSurgery: item.hasSurgery ?? item.healthInfo?.hasSurgery,
    surgeriesJson: item.surgeriesJson ?? item.healthInfo?.surgeriesJson ?? item.surgeries ?? "",
    livingCostStatus: item.livingCostStatus,
    householdType: item.householdType,
    pensionStatus: item.pensionStatus,
    housingType: item.housingType,
    maxHours: item.maxHours,
    maxDistance: item.maxDistance,
    restNeed: item.restNeed,
    payType: item.payType,

    locationStatus: item.locationStatus || "정상",
    alertStatus: item.alertStatus || "없음",
    workRequestStatus: item.workRequestStatus || "미검토",
    jobRequestCount: Number(item.jobRequestCount || 0),
    jobRequestStatus: item.jobRequestStatus || "미요청",
    welfareDecision: item.welfareDecision || "미검토",
    welfareDecisionReason: item.welfareDecisionReason || "",
    lastAccess: formatLastAccessText(item.lastLoginAt),
});

const EMERGENCY_ALERT_STATUSES = [
    "미응답 SOS",
    "보호자 미응답 SOS",
    "낙상 의심",
    "안전구역 이탈",
    "위험 알림",
];

const isEmergencyPendingSenior = (senior) => {
    const alertStatus = senior.alertStatus || "";
    const alertHandled = senior.alertHandled || senior.alertResolved || senior.isAlertResolved;

    return EMERGENCY_ALERT_STATUSES.some((status) => alertStatus.includes(status)) && !alertHandled;
};

const hasMissingRequiredInfo = (senior) => {
    const requiredValues = [
        senior.phone,
        senior.address || senior.region,
        senior.guardianName || senior.guardianPhone || senior.guardianId,
        senior.healthInfo || senior.healthStatus,
        senior.birthDate || senior.age,
        senior.gender,
    ];

    return requiredValues.some((value) => value === undefined || value === null || String(value).trim() === "");
};

export const getSummaryCounts = (seniors) => ({
    totalSeniors: seniors.length,
    emergencyRequired: seniors.filter(isEmergencyPendingSenior).length,
    missingInfo: seniors.filter(hasMissingRequiredInfo).length,
});

export const getBadgeClass = (type, value) => {
    const normalizedValue = String(value || "").toUpperCase();

    if (type === "alert" && normalizedValue.includes("SOS")) {
        return "wd-badge alert-sos";
    }

    if (type === "alert" && (normalizedValue === "NONE" || normalizedValue === "없음")) {
        return "wd-badge alert-none";
    }

    const classMap = {
        health: { "양호": "health-good", "주의": "health-caution", "위험": "health-danger" },
        alert: {
            "없음": "alert-none",
            "미응답 SOS": "alert-sos",
            "일자리 신청": "alert-job",
        },
        workRequest: { "검토": "work-reviewed", "미검토": "work-unreviewed" },
    };

    return `wd-badge ${classMap[type]?.[value] || "alert-none"}`;
};
