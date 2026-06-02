const FASTAPI_BASE_URL = "http://localhost:8001";
const SPRING_API_BASE_URL = "http://localhost:8080";

function valueOrNull(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    return String(value);
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

    const healthInfo = senior.healthInfo || {};
    const jobPreference = senior.jobPreference || {};

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
        height: valueOrNull(healthInfo.height),
        weight: valueOrNull(healthInfo.weight),
        smoking: valueOrNull(healthInfo.smoking),
        drinking: valueOrNull(healthInfo.drinking),
        allergies: valueOrNull(healthInfo.allergies),
        medicineCount: valueOrNull(healthInfo.medicineCount),
        medications: Array.isArray(healthInfo.medications)
            ? healthInfo.medications
            : (() => {
                try {
                    const parsed = JSON.parse(healthInfo.medicationsJson || "[]");
                    return Array.isArray(parsed) ? parsed : [];
                } catch {
                    return [];
                }
            })(),

        incomeLevel: valueOrNull(senior.incomeLevel || senior.income || healthInfo.incomeLevel),
        householdType: valueOrNull(senior.householdType || healthInfo.householdType),
        currentBenefits: toArray(senior.currentBenefits || healthInfo.currentBenefits),
        welfareMemo: valueOrNull(senior.welfareMemo || healthInfo.welfareMemo),

        diseases: [
            healthInfo.diabetes && `당뇨: ${healthInfo.diabetes}`,
            healthInfo.hypertension && `고혈압: ${healthInfo.hypertension}`,
            healthInfo.heartDisease && `심장질환: ${healthInfo.heartDisease}`,
            healthInfo.jointDisease && `관절질환: ${healthInfo.jointDisease}`,
            healthInfo.stroke && `뇌졸중: ${healthInfo.stroke}`,
            healthInfo.kidneyDisease && `신장질환: ${healthInfo.kidneyDisease}`,
            healthInfo.lungDisease && `호흡기질환: ${healthInfo.lungDisease}`,
            healthInfo.liverDisease && `간질환: ${healthInfo.liverDisease}`,
            healthInfo.cancer && `암: ${healthInfo.cancer}`,
        ].filter(Boolean),

        mobilityInfo: [
            healthInfo.walkingAid && `보행 보조기구: ${healthInfo.walkingAid}`,
            healthInfo.dementia && `인지/기억 어려움: ${healthInfo.dementia}`,
            healthInfo.vision && `시력: ${healthInfo.vision}`,
            healthInfo.hearing && `청력: ${healthInfo.hearing}`,
            healthInfo.recentFall && `최근 낙상: ${healthInfo.recentFall}`,
            healthInfo.hasSurgery && `수술 이력: ${healthInfo.hasSurgery}`,
            healthInfo.surgeryDetail && `수술 내용: ${healthInfo.surgeryDetail}`,
            healthInfo.otherDisease && `기타 질환: ${healthInfo.otherDisease}`,
        ].filter(Boolean),

        workLimitations: [
            healthInfo.maxHours && `하루 최대 근무 시간: ${healthInfo.maxHours}`,
            healthInfo.maxDistance && `최대 이동 거리: ${healthInfo.maxDistance}`,
            healthInfo.disabledWork && `어려운 업무: ${healthInfo.disabledWork}`,
            healthInfo.restNeed && `휴식 필요도: ${healthInfo.restNeed}`,
            healthInfo.avoidEnvironment && `피해야 할 환경: ${healthInfo.avoidEnvironment}`,
        ].filter(Boolean),

        jobPreference: {
            payType: valueOrNull(jobPreference.payType),
            hopeDays: valueOrNull(jobPreference.hopeDays),
            hopeJobType: valueOrNull(jobPreference.hopeJobType),
            hopeCondition: valueOrNull(jobPreference.hopeCondition),
            memo: valueOrNull(jobPreference.memo),
        },
        region: valueOrNull(senior.region),
        address: valueOrNull(senior.address),
        livingAlone: valueOrNull(senior.livingAlone),
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
        jobApplications: Array.isArray(senior.jobApplications)
            ? senior.jobApplications.map((job) => ({
                jobTitle: valueOrNull(job.jobTitle),
                organization: valueOrNull(job.organization || job.company),
                status: valueOrNull(job.status),
                location: valueOrNull(job.location),
                requestedAt: valueOrNull(job.requestedAt),
                applicationType: valueOrNull(job.applicationType),
            }))
            : [],
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
