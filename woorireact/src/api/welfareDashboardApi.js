const WELFARE_API_BASE = "http://localhost:8181";
const WELFARE_SENIORS_CACHE_KEY = "welfare:seniors";
const welfareSeniorsCache = new Map();

const makeSeniorCacheKey = ({ page = 0, size = 6 } = {}) => `${page}-${size}`;

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

export const getCachedWelfareSeniors = ({ page = 0, size = 6 } = {}) => {
    const cacheKey = makeSeniorCacheKey({ page, size });
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

export const fetchWelfareSeniors = async ({ page, size } = {}) => {
    const params = new URLSearchParams();

    if (page !== undefined) {
        params.set("page", page);
    }

    if (size !== undefined) {
        params.set("size", size);
    }

    const queryString = params.toString();
    const cacheKey = makeSeniorCacheKey({ page: page ?? 0, size: size ?? 6 });
    const response = await fetch(`/api/seniors/welfare${queryString ? `?${queryString}` : ""}`);

    if (!response.ok) {
        const cached = getCachedWelfareSeniors({ page: page ?? 0, size: size ?? 6 });
        if (cached) return cached;
        throw new Error("Failed to load welfare seniors");
    }

    const data = await response.json();
    saveSeniorCache(cacheKey, data);
    return data;
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

export const fetchWelfareAlerts = async () => {
    const response = await fetch(`${WELFARE_API_BASE}/api/alerts/welfare`);

    if (!response.ok) {
        return [];
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
};
