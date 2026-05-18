const WELFARE_POLICY_QA_API_URL = "/api/welfare-rag/ask";

const normalizeSenior = (senior) => {
    if (!senior) {
        return null;
    }

    return {
        id: senior.id ?? null,
        name: senior.name ?? "",
        age: senior.age ?? null,
        gender: senior.gender ?? "",
        region: senior.region ?? senior.address ?? "",
        address: senior.address ?? senior.region ?? "",
        healthStatus: senior.healthStatus ?? "",
        diseaseInfo: senior.diseaseInfo ?? "",
        walkingStatus: senior.walkingStatus ?? "",
        jobRequestStatus: senior.jobRequestStatus ?? "",
        workRequestStatus: senior.workRequestStatus ?? "",
        welfareDecision: senior.welfareDecision ?? "",
        welfareDecisionReason: senior.welfareDecisionReason ?? "",
    };
};

export async function askWelfarePolicyQuestion({ question, senior = null }) {
    const trimmedQuestion = question?.trim();

    if (!trimmedQuestion) {
        throw new Error("질문을 입력해주세요.");
    }

    const response = await fetch(WELFARE_POLICY_QA_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            question: trimmedQuestion,
            senior: normalizeSenior(senior),
        }),
    });

    if (!response.ok) {
        throw new Error("제도 Q&A 답변을 불러오지 못했습니다.");
    }

    const data = await response.json();

    return {
        answer: data.answer || "",
        evidence: Array.isArray(data.evidence) ? data.evidence : [],
    };
}
