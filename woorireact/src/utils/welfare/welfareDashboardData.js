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
    gender: item.gender,
    phone: item.phone,
    region: item.region || "주소 미등록",
    healthStatus: item.healthStatus || "양호",
    locationStatus: item.locationStatus || "정상",
    alertStatus: item.alertStatus || "없음",
    workRequestStatus: item.workRequestStatus || "미검토",
    jobRequestCount: Number(item.jobRequestCount || 0),
    jobRequestStatus: item.jobRequestStatus || "미요청",
    welfareDecision: item.welfareDecision || "미검토",
    welfareDecisionReason: item.welfareDecisionReason || "",
    lastAccess: formatLastAccessText(item.lastLoginAt),
});

export const getSummaryCounts = (seniors) => ({
    total: seniors.length,
    jobApplicants: seniors.filter((senior) => Number(senior.jobRequestCount || 0) > 0).length,
    pendingReview: seniors.filter((senior) => getSeniorReviewStatus(senior) === "미검토").length,
    completedReview: seniors.filter((senior) => getSeniorReviewStatus(senior) === "검토").length,
});

export const getBadgeClass = (type, value) => {
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
