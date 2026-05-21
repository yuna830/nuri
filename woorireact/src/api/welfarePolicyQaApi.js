const FASTAPI_BASE_URL = "http://localhost:8001";
const SPRING_API_BASE_URL = "http://localhost:8181";

function valueOrMissing(value) {
    if (value === null || value === undefined || value === "") {
        return "미입력";
    }

    return value;
}

function formatSeniorContext(senior) {
    if (!senior) {
        return "";
    }

    const safeZone = senior.safeZone || {};
    const lastGps = senior.lastGps || {};

    return [
        "[대상자 정보]",
        `이름: ${valueOrMissing(senior.name)}`,
        `나이: ${valueOrMissing(senior.age)}`,
        `성별: ${valueOrMissing(senior.gender)}`,
        `거주 지역: ${valueOrMissing(senior.region)}`,
        `건강 상태: ${valueOrMissing(senior.healthStatus)}`,
        `복약 정보: ${valueOrMissing(senior.medicationInfo || senior.medicineInfo)}`,
        `소득 정보: ${valueOrMissing(senior.incomeLevel || senior.income)}`,
        `기초생활수급 여부: ${valueOrMissing(senior.basicLivelihoodStatus)}`,
        `차상위 여부: ${valueOrMissing(senior.nearPovertyStatus)}`,
        `독거 여부: ${valueOrMissing(senior.livingAlone)}`,
        `가구 형태: ${valueOrMissing(senior.householdType)}`,
        `장애 여부: ${valueOrMissing(senior.disabilityStatus)}`,
        `장기요양 등급: ${valueOrMissing(senior.longTermCareGrade)}`,
        `일자리 신청 상태: ${valueOrMissing(senior.jobRequestStatus)}`,
        `복지 검토 상태: ${valueOrMissing(senior.workRequestStatus)}`,
        `복지 판정: ${valueOrMissing(senior.welfareDecision)}`,
        `복지 판정 사유: ${valueOrMissing(senior.welfareDecisionReason)}`,
    ].join("\n");
}

function isBasicPolicyQuestion(question) {
    const text = String(question || "").replace(/\s+/g, "");

    const basicQuestionPatterns = [
        /몇살|몇세|나이|연령/,
        /얼마|금액|지원금|최대|최소/,
        /언제부터|기간|시기/,
        /어디서|신청방법|신청|방법/,
        /무엇|뭐야|설명|뜻|기준/,
    ];

    const recommendationPatterns = [
        /받을수|받을수있는|가능한|추천|맞는|해당|대상자.*제도/,
    ];

    return basicQuestionPatterns.some((pattern) => pattern.test(text))
        && !recommendationPatterns.some((pattern) => pattern.test(text));
}

function buildQuestionWithSeniorContext(question, senior) {
    const trimmedQuestion = question.trim();
    const seniorContext = formatSeniorContext(senior);
    const isBasicQuestion = isBasicPolicyQuestion(trimmedQuestion);

    if (!seniorContext) {
        return trimmedQuestion;
    }

    if (isBasicQuestion) {
        return [
            seniorContext,
            "",
            "[질문]",
            trimmedQuestion,
            "",
            "[답변 요청]",
            "이 질문은 특정 대상자에게 맞는 제도 추천이 아니라 복지 제도 자체에 대한 기본 질문입니다.",
            "검색된 문서에서 확인되는 범위 안에서 질문에 직접 답하세요.",
            "대상자 정보는 참고만 하고, 필요하지 않으면 소득·장애·독거·장기요양 등 추가 확인 목록을 억지로 붙이지 마세요.",
            "답변은 2~4문장으로 자연스럽게 설명하세요.",
        ].join("\n");
    }

    return [
        seniorContext,
        "",
        "[질문]",
        trimmedQuestion,
        "",
        "[답변 요청]",
        "대상자 정보와 검색된 복지 제도 문서를 함께 참고해서 답변해 주세요.",
        "대상자가 받을 가능성이 있는 제도, 신청 조건, 추가 확인이 필요한 정보를 설명해 주세요.",
        "대상자 정보에 없는 소득, 장애 여부, 독거 여부 등은 단정하지 말고 추가 확인 필요로 표시해 주세요.",
    ].join("\n");
}

function buildSearchQuery(question, senior) {
    if (!senior) {
        return question.trim();
    }

    const parts = [
        question.trim(),
        senior.age ? `${senior.age}세` : "",
        senior.gender || "",
        senior.region || "",
        senior.healthStatus || "",
        senior.incomeLevel || senior.income || "",
        senior.basicLivelihoodStatus || "",
        senior.nearPovertyStatus || "",
        senior.livingAlone || "",
        senior.householdType || "",
        senior.disabilityStatus || "",
        senior.longTermCareGrade || "",
        "노인 복지 기초연금 노인맞춤돌봄 응급안전안심서비스 장기요양 노인일자리",
    ];

    return parts.filter(Boolean).join(" ");
}

export async function askWelfarePolicyQuestion({ question, senior = null, limit = 5 }) {
    const trimmedQuestion = question?.trim();

    if (!trimmedQuestion) {
        throw new Error("질문을 입력하세요.");
    }

    const questionWithContext = buildQuestionWithSeniorContext(trimmedQuestion, senior);
    const searchQuery = buildSearchQuery(trimmedQuestion, senior);

    const response = await fetch(`${FASTAPI_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            question: questionWithContext,
            search_query: searchQuery,
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
            "Content-Type": "application/json",
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