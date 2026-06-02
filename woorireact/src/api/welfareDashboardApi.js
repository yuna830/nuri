import { WELFARE_API_BASE } from "../config/api.js";
const WELFARE_SENIORS_CACHE_KEY = "welfare:seniors";
const welfareSeniorsCache = new Map();

const makeSeniorCacheKey = ({ page = 0, size = 6, welfareWorkerId = "all" } = {}) => `${welfareWorkerId || "all"}-${page}-${size}`;

const readSeniorCacheStore = () => {
    try {
        const saved = JSON.parse(sessionStorage.getItem(WELFARE_SENIORS_CACHE_KEY) || "{}");
        return saved && typeof saved === "object" ? saved : {};
    } catch {
        return {};
    }
};

const writeSeniorCacheStore = (store) => {
    try {
        sessionStorage.setItem(WELFARE_SENIORS_CACHE_KEY, JSON.stringify(store));
    } catch {
        return;
    }
};

const saveSeniorCache = (cacheKey, data) => {
    welfareSeniorsCache.set(cacheKey, data);
    writeSeniorCacheStore({
        ...readSeniorCacheStore(),
        [cacheKey]: data,
    });
};

export const getCachedWelfareSeniors = ({ page = 0, size = 6, welfareWorkerId = "all" } = {}) => {
    const cacheKey = makeSeniorCacheKey({ page, size, welfareWorkerId });
    return welfareSeniorsCache.get(cacheKey) || readSeniorCacheStore()[cacheKey] || null;
};

export const getCachedWelfareSeniorById = (seniorId) => {
    const targetId = String(seniorId);
    const allCachedResponses = [
        ...welfareSeniorsCache.values(),
        ...Object.values(readSeniorCacheStore()),
    ];

    for (const cachedResponse of allCachedResponses) {
        const list = Array.isArray(cachedResponse) ? cachedResponse : cachedResponse?.content;
        const senior = Array.isArray(list)
            ? list.find((item) => String(item.id) === targetId)
            : null;

        if (senior) return senior;
    }

    return null;
};

// 복지 대상자 목록 불러오기 API 추가 (페이징 지원)
export const fetchWelfareSeniors = async ({ page, size, welfareWorkerId } = {}) => {
    const params = new URLSearchParams();

    if (page !== undefined) {
        params.set("page", page);
    }

    if (size !== undefined) {
        params.set("size", size);
    }

    if (welfareWorkerId !== undefined && welfareWorkerId !== null && welfareWorkerId !== "") {
        params.set("welfareWorkerId", welfareWorkerId);
    }

    const queryString = params.toString();
    const cacheKey = makeSeniorCacheKey({ page: page ?? 0, size: size ?? 6, welfareWorkerId: welfareWorkerId ?? "all" });
    const response = await fetch(`/api/seniors/welfare${queryString ? `?${queryString}` : ""}`);

    if (!response.ok) {
        const cached = getCachedWelfareSeniors({ page: page ?? 0, size: size ?? 6, welfareWorkerId: welfareWorkerId ?? "all" });
        if (cached) return cached;
        throw new Error("Failed to load welfare seniors");
    }

    const data = await response.json();
    saveSeniorCache(cacheKey, data);
    return data;
};

export const searchSeniorExact = async ({ name, phone }) => {
    const params = new URLSearchParams({
        name: name || "",
        phone: phone || "",
    });
    const response = await fetch(`/api/seniors/search-exact?${params.toString()}`);

    if (!response.ok) {
        return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
};

export const assignWelfareSenior = async ({ seniorId, welfareWorkerId }) => {
    const response = await fetch(`/api/seniors/${seniorId}/welfare-worker`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ welfareWorkerId }),
    });

    if (!response.ok) {
        throw new Error("Failed to assign welfare senior");
    }

    return response.json();
};

export const fetchWelfareSeniorDetail = async (seniorId) => {
    const endpoints = [
        `/api/seniors/${seniorId}`,
        `/api/seniors/welfare/${seniorId}`,
    ];

    let lastError = null;

    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error(`Failed to load senior detail: ${response.status}`);
            }

            return response.json();
        } catch (error) {
            lastError = error;
        }
    }

    const cached = getCachedWelfareSeniorById(seniorId);
    if (cached) return cached;

    throw lastError || new Error("Failed to load senior detail");
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
