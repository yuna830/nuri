const WELFARE_API_BASE = "http://localhost:8181";

export const fetchWelfareSeniors = async () => {
    const response = await fetch("/api/seniors/welfare");

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