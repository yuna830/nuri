const FASTAPI_BASE_URL = "http://localhost:8001";

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

function buildQuestionWithSeniorContext(question, senior) {
    const trimmedQuestion = question.trim();
    const seniorContext = formatSeniorContext(senior);

    if (!seniorContext) {
        return trimmedQuestion;
    }

    return [
        seniorContext,
        "",
        "[질문]",
        trimmedQuestion,
        "",
        "[답변 요청]",
        "위 대상자 정보와 검색된 복지 제도 문서를 함께 참고해서 답변해줘.",
        "대상자가 받을 가능성이 있는 제도, 신청 조건, 추가 확인이 필요한 정보를 나눠서 설명해줘.",
        "대상자 정보에 없는 소득, 장애 여부, 독거 여부 등은 확정하지 말고 추가 확인 필요로 표시해줘.",
    ].join("\n");
}

export async function askWelfarePolicyQuestion({ question, senior = null, limit = 5 }) {
    const trimmedQuestion = question?.trim();

    if (!trimmedQuestion) {
        throw new Error("질문을 입력하세요.");
    }

    const questionWithContext = buildQuestionWithSeniorContext(trimmedQuestion, senior);

    const response = await fetch(`${FASTAPI_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            question: questionWithContext,
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