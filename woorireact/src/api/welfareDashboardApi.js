const WELFARE_API_BASE = "http://localhost:8181";

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

export const fetchWelfareAlerts = async () => {
    const response = await fetch(`${WELFARE_API_BASE}/api/alerts/welfare`);

    if (!response.ok) {
        return [];
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
};
