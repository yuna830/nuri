const FASTAPI_BASE_URL = "http://localhost:8001";
const SPRING_API_BASE_URL = "http://localhost:8181";

// 값이 없거나 빈 문자열인 경우 "미입력"으로 표시하는 함수 추가
function valueOrMissing(value) {
    if (value === null || value === undefined || value === "") {
        return "미입력";
    }

    return value;
}

// 대상자 정보를 질문 맥락에 포함시키는 함수 개선
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

// 질문이 복지 제도 자체에 대한 기본 질문인지 판별하는 함수 추가
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

// 메타 질문 분류 추가 
function isMetaConversationQuestion(question) {
    const text = String(question || "").replace(/\s+/g, "");

    return /저런정보|이런정보|정보가있어야|필요해|좋아|왜필요|뭘입력|어떤정보/.test(text);
}

// 질문에 대상자 정보 맥락을 추가하는 함수 개선
function buildQuestionWithSeniorContext(question, senior) {
    const trimmedQuestion = question.trim();
    const seniorContext = formatSeniorContext(senior);
    const isBasicQuestion = isBasicPolicyQuestion(trimmedQuestion);
    const isMetaQuestion = isMetaConversationQuestion(trimmedQuestion);

    if (!seniorContext) {
        return trimmedQuestion;
    }

    if (isMetaQuestion) {
        return [
            seniorContext,
            "",
            "[질문]",
            trimmedQuestion,
            "",
            "[답변 요청]",
            "이 질문은 복지 제도 추천이 아니라 대화 내용이나 대상자 정보 입력 필요성에 대한 질문입니다.",
            "최근 대화가 있으면 그 맥락을 참고해서 자연스럽게 답하세요.",
            "복지 제도를 새로 추천하지 말고, 어떤 대상자 정보가 왜 필요한지 설명하세요.",
            "답변은 2~4문장으로 짧게 작성하세요.",
        ].join("\n");
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
        "대상자 정보와 검색된 복지 제도 문서를 참고해서 사용자의 질문에만 직접 답변해 주세요.",
        "같은 제도 설명, 신청 조건, 추가 확인 항목을 반복하지 마세요.",
        "관련 제도가 1개면 그 제도만 간단히 설명하고, 별도의 '추천 제도' 섹션을 만들지 마세요.",
        "답변은 5~8문장 또는 짧은 bullet 3~5개로 끝내세요.",
    ].join("\n");
}

// 검색 키워드 생성 함수 추가
function getTargetKeywords(senior) {
    const keywords = ["복지", "지원", "신청", "지원대상"];

    const age = Number(senior?.age || 0);
    const text = [
        senior?.healthStatus,
        senior?.incomeLevel,
        senior?.basicLivelihoodStatus,
        senior?.nearPovertyStatus,
        senior?.livingAlone,
        senior?.householdType,
        senior?.disabilityStatus,
        senior?.longTermCareGrade,
        senior?.jobRequestStatus,
        senior?.region,
    ].filter(Boolean).join(" ");

    if (age >= 65) {
        keywords.push("노인", "어르신", "기초연금", "노인맞춤돌봄", "장기요양", "노인일자리");
    }

    if (age && age < 65) {
        keywords.push("취약계층", "저소득층", "긴급복지", "생계지원", "의료비 지원", "주거지원");
    }

    if (/기초생활|수급|생계급여/.test(text)) {
        keywords.push("기초생활보장", "생계급여", "의료급여", "주거급여", "교육급여");
    }

    if (/차상위/.test(text)) {
        keywords.push("차상위계층", "본인부담경감", "자활", "요금감면");
    }

    if (/독거|1인|단독/.test(text)) {
        keywords.push("돌봄", "안부확인", "응급안전", "방문지원");
    }

    if (/장애|장애인/.test(text)) {
        keywords.push("장애인", "장애수당", "장애인연금", "활동지원", "보조기기");
    }

    if (/한부모/.test(text)) {
        keywords.push("한부모가족", "양육비", "아동양육비");
    }

    if (/실직|구직|취업|일자리/.test(text)) {
        keywords.push("일자리", "취업지원", "국민취업지원제도", "자활근로");
    }

    return keywords.join(" ");
}

// 검색 쿼리 생성 함수 추가
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
        getTargetKeywords(senior),
    ];

    return parts.filter(Boolean).join(" ");
}

// 복지 RAG 질문 API
export async function askWelfarePolicyQuestion({ question, senior = null, history = [], limit = 5 }) {
    const trimmedQuestion = question?.trim();

    if (!trimmedQuestion) {
        throw new Error("질문을 입력하세요.");
    }

    const questionWithContext = buildQuestionWithSeniorContext(trimmedQuestion, senior);

    const historyText = history.length > 0
        ? [
            "[최근 대화]",
            ...history.map((message) => `${message.role === "user" ? "복지사" : "AI"}: ${message.text}`),
            "",
        ].join("\n")
        : "";
    const searchQuery = buildSearchQuery(trimmedQuestion, senior);

    const response = await fetch(`${FASTAPI_BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            question: `${historyText}${questionWithContext}`,
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

// 대화 내역 불러오기 API 추가
export async function fetchWelfarePolicyChatHistory(seniorId) {
    if (!seniorId) return [];

    const response = await fetch(
        `${SPRING_API_BASE_URL}/api/welfare-policy-chat-histories/senior/${seniorId}`
    );

    if (!response.ok) return [];

    return response.json();
}

// 대화 내역 저장 API 추가
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

// 대화 내역 삭제 API 추가
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