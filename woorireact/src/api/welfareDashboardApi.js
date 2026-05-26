const WELFARE_API_BASE = "http://localhost:8181";

// 복지 대상자 목록 불러오기 API 추가 (페이징 지원)
export const fetchWelfareSeniors = async ({ page, size } = {}) => {
    const params = new URLSearchParams();

    if (page !== undefined) {
        params.set("page", page);
    }

    if (size !== undefined) {
        params.set("size", size);
    }

    const queryString = params.toString();
    const response = await fetch(`/api/seniors/welfare${queryString ? `?${queryString}` : ""}`);

    if (!response.ok) {
        throw new Error("Failed to load welfare seniors");
    }

    return response.json();
};

// 복지 알림 불러오기 API 추가
export const fetchWelfareAlerts = async () => {
    const response = await fetch(`${WELFARE_API_BASE}/api/alerts/welfare`);

    if (!response.ok) {
        return [];
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
};

// 사용자 상세 정보 불러오기 API 추가
export const fetchWelfareSeniorDetail = async (seniorId) => {
    const response = await fetch(`/api/seniors/${seniorId}`);

    if (!response.ok) {
        throw new Error("Failed to load senior detail");
    }

    return response.json();
};

// 복지 대상자 정보 업데이트 요청 API 추가
export const requestSeniorInfoUpdate = async ({
    seniorId,
    missingFields = [],
    toSenior = true,
    toGuardian = true,
}) => {
    const response = await fetch("/api/alerts/info-update-request", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            seniorId,
            missingFields,
            toSenior,
            toGuardian,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to request senior info update");
    }

    return response.json();
};

export const requestGuardianConsultation = async ({ seniorId, message }) => {
    const response = await fetch("/api/alerts/welfare-consult-request", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            seniorId,
            message,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to request guardian consultation");
    }

    return response.json();
};

export const fetchSeniorAlerts = async (seniorId) => {
    const response = await fetch(`/api/alerts/senior/${seniorId}`);

    if (!response.ok) {
        return [];
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
};
