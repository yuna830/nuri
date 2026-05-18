export const fetchWelfareJobApplications = async () => {
    const response = await fetch("/api/job-interests/welfare");

    if (!response.ok) {
        throw new Error("Failed to load welfare job applications");
    }

    const data = await response.json();

    return Array.isArray(data) ? data : [];
};

export const updateWelfareJobApplicationStatus = async (id, status) => {
    const response = await fetch(`/api/job-interests/${id}/status`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
    });

    if (!response.ok) {
        throw new Error("Failed to update job application status");
    }

    return response.json();
};

export const askWelfareJobRecommendationReason = async ({ seniorId, job }) => {
    const response = await fetch("/api/welfare/jobs/recommendation-reason", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            seniorId,
            job,
        }),
    });

    if (!response.ok) {
        throw new Error("Failed to generate recommendation reason");
    }

    return response.json();
};