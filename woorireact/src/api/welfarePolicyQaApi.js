const FASTAPI_BASE_URL = "http://localhost:8001";
const SPRING_API_BASE_URL = "http://localhost:8181";

function valueOrNull(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return value;
}

function toArray(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    if (!value) {
        return [];
    }

    return String(value)
        .split(/[,\n·]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function buildWelfareProfile(senior) {
    if (!senior) {
        return null;
    }

    return {
        name: valueOrNull(senior.name),
        displayNameAliases: senior.name
            ? [
                senior.name,
                `${senior.name}님`,
                `${senior.name} 사용자`,
                `${senior.name} 어르신`,
                `${senior.name} 대상자`,
                `${senior.name} 보호대상자`,
            ]
            : [],
        age: senior.age ? Number(String(senior.age).replace(/[^0-9]/g, "")) : null,
        gender: valueOrNull(senior.gender),
        region: valueOrNull(senior.region),
        address: valueOrNull(senior.address),
        incomeLevel: valueOrNull(senior.incomeLevel || senior.income),
        householdType: valueOrNull(senior.householdType),
        livingAlone: valueOrNull(senior.livingAlone),
        diseases: toArray(senior.diseases || senior.healthStatus || senior.majorDiseases),
        medicationInfo: valueOrNull(senior.medicationInfo || senior.medicineInfo),
        basicLivelihoodStatus: valueOrNull(senior.basicLivelihoodStatus),
        nearPovertyStatus: valueOrNull(senior.nearPovertyStatus),
        disabilityStatus: valueOrNull(
            senior.disabilityStatus ||
            senior.disabilityType ||
            senior.disabilityGrade
        ),
        longTermCareGrade: valueOrNull(senior.longTermCareGrade),
        jobRequestStatus: valueOrNull(senior.jobRequestStatus),
        currentBenefits: toArray(senior.currentBenefits),
        welfareMemo: valueOrNull(senior.welfareMemo),
    };
}

function inferQuestionMode(question) {
    const text = String(question || "").replace(/\s+/g, "");

    if (/내상황|맞는|받을수|받을수있는|추천|대상자|이분|어르신|가능한복지|신청가능|해당/.test(text)) {
        return "recommend";
    }

    return "qa";
}

export async function askWelfarePolicyQuestion({
    question,
    senior = null,
    history = [],
    limit = 5,
    mode = null,
    audience = "worker",
}) {
    const trimmedQuestion = question?.trim();

    if (!trimmedQuestion) {
        throw new Error("질문을 입력해 주세요.");
    }

    const response = await fetch(`${FASTAPI_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
            question: trimmedQuestion,
            mode: mode || inferQuestionMode(trimmedQuestion),
            audience,
            profile: buildWelfareProfile(senior),
            history: history.slice(-6).map((message) => ({
                role: message.role === "assistant" ? "assistant" : "user",
                text: message.text || "",
            })),
            limit,
        }),
    });

    if (!response.ok) {
        throw new Error("복지 RAG 답변을 불러오지 못했습니다.");
    }

    const data = await response.json();

    return {
        answer: data.answer || "",
        evidence: Array.isArray(data.sources) ? data.sources : [],
    };
}

export async function fetchWelfarePolicyChatHistory(seniorId) {
    if (!seniorId) return [];

    const response = await fetch(
        `${SPRING_API_BASE_URL}/api/welfare-policy-chat-histories/senior/${seniorId}`
    );

    if (!response.ok) return [];

    return response.json();
}

export async function saveWelfarePolicyChatHistory({
    seniorId,
    workerId,
    question,
    answer,
    evidence,
}) {
    const response = await fetch(`${SPRING_API_BASE_URL}/api/welfare-policy-chat-histories`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
            seniorId,
            workerId,
            question,
            answer,
            evidenceJson: JSON.stringify(evidence || []),
        }),
    });

    if (!response.ok) {
        throw new Error("복지 Q&A 대화 내역 저장에 실패했습니다.");
    }

    return response.json();
}

export async function deleteWelfarePolicyChatHistory(seniorId) {
    if (!seniorId) return;

    const response = await fetch(
        `${SPRING_API_BASE_URL}/api/welfare-policy-chat-histories/senior/${seniorId}`,
        {
            method: "DELETE",
        }
    );

    if (!response.ok) {
        throw new Error("복지 Q&A 대화 내역 삭제에 실패했습니다.");
    }
}
