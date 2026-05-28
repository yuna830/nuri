// 복지사 페이지 공통 대상자 데이터 처리 유틸

const WELFARE_DECISIONS_STORAGE_KEY = "welfareDecisions";
const WELFARE_DECISION_DETAILS_STORAGE_KEY = "welfareDecisionDetails";

const readJsonStorage = (key) => {
    try {
        const saved = JSON.parse(localStorage.getItem(key) || "{}");
        return saved && typeof saved === "object" ? saved : {};
    } catch {
        return {};
    }
};

export const getSavedWelfareDecisions = () =>
    readJsonStorage(WELFARE_DECISIONS_STORAGE_KEY);

export const getSavedWelfareDecisionDetails = () =>
    readJsonStorage(WELFARE_DECISION_DETAILS_STORAGE_KEY);

export const getJobRequestGroup = (senior) =>
    Number(senior.jobRequestCount || 0) > 0 || senior.alertStatus === "일자리 요청"
        ? "요청 있음"
        : "미요청";

export const getJobRequestStatus = (count) =>
    Number(count || 0) > 0 ? `요청 ${Number(count)}건` : "미요청";

export const normalizeAlertStatus = (status) => {
    if (status === "미응답 SOS") {
        return "SOS 요청";
    }

    if (status === "일자리 신청") {
        return "일자리 요청";
    }

    return ["없음", "SOS 요청", "일자리 요청"].includes(status) ? status : "없음";
};

export const normalizeSenior = (senior) => {
    if (!senior) {
        return senior;
    }

    const baseSenior = senior.senior || senior;
    const healthInfo = senior.healthInfo || {};
    const name = senior.name ?? baseSenior.name;
    const region = senior.region ?? baseSenior.region ?? baseSenior.address;
    const healthStatus = senior.healthStatus || healthInfo.healthStatus || baseSenior.healthStatus || "양호";
    const jobRequestCount = Number(senior.jobRequestCount ?? (senior.jobStatus === "미추천" ? 0 : 1));
    const welfareDecision = senior.welfareDecision || "미검토";

    return {
        ...senior,
        id : senior.id ?? baseSenior.id,
        name,
        age : senior.age ?? baseSenior.age,
        gender : senior.gender ?? baseSenior.gender,
        phone : senior.phone ?? baseSenior.phone,
        region,
        healthStatus,
        alertStatus : normalizeAlertStatus(senior.alertStatus),
        workRequestStatus : senior.workRequestStatus || (welfareDecision === "미검토" ? "미검토" : "검토"),
        jobRequestCount,
        jobRequestStatus : senior.jobRequestStatus || getJobRequestStatus(jobRequestCount),
        jobMatchingStatus : senior.jobMatchingStatus || (welfareDecision === "미검토" ? "검토중" : welfareDecision),
        welfareDecision,
        welfareDecisionReason : senior.welfareDecisionReason || "",
        preferredWorkTime : senior.preferredWorkTime || "하루 3시간",
        safeZone : senior.safeZone || {
            placeName : `${name || "대상자"} 자택`,
            radiusMeter : 500,
        },
        lastGps : senior.lastGps || {
            address : region || "위치 미확인",
            latitude : 37.5665,
            longitude : 126.978,
            recordedAt : "기록 없음",
        },
    };
};

export const applySavedWelfareDecisions = (seniors) => {
    const savedDecisions = getSavedWelfareDecisions();
    const savedDecisionDetails = getSavedWelfareDecisionDetails();

    return seniors.map((senior) => {
        const savedDetail = savedDecisionDetails[senior.id];
        const savedDecision = savedDetail?.decision || savedDecisions[senior.id];

        return normalizeSenior({
            ...senior,
            welfareDecision : savedDecision || senior.welfareDecision,
            jobMatchingStatus : savedDecision || senior.jobMatchingStatus,
            welfareDecisionReason : savedDetail?.reason ?? senior.welfareDecisionReason,
        });
    });
};

export const applySavedWelfareDecision = (target) => {
    if (!target) {
        return target;
    }

    const savedDecisions = getSavedWelfareDecisions();
    const savedDecisionDetails = getSavedWelfareDecisionDetails();
    const savedDetail = savedDecisionDetails[target.id];
    const savedDecision = savedDetail?.decision || savedDecisions[target.id];

    return normalizeSenior({
        ...target,
        welfareDecision : savedDecision || target.welfareDecision,
        jobMatchingStatus : savedDecision || target.jobMatchingStatus,
        welfareDecisionReason : savedDetail?.reason ?? target.welfareDecisionReason,
    });
};

export const formatAgeGender = (senior) => {
    if (!senior) {
        return "-";
    }

    const ageText = senior.age == null ? "나이 미입력" : `${senior.age}세`;
    const genderText = senior.gender || "성별 미입력";

    return `${ageText} / ${genderText}`;
};

export const formatSeniorId = (seniorId) => `ID ${String(seniorId).padStart(4, "0")}`;

export const formatGps = (gps) => {
    if (!gps) {
        return "GPS 위치 정보 없음";
    }

    return `${gps.address} (${gps.latitude}, ${gps.longitude})`;
};
