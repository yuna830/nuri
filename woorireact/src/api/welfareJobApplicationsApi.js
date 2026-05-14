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
